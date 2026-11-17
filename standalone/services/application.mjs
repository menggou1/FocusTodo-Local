import { createDataService } from './data.mjs';
import { createTimerCore } from '../domain/timer-core.mjs';
import { createBackupCodec } from './backup-codec.mjs';
import { createThemeJournal } from './theme-journal.mjs';
import { createScopedStorage, dataDatabaseName, dataStoragePrefix } from './scoped-storage.mjs';
import { createTimerService } from './timer.mjs';
import { createPreferencesService } from './preferences.mjs';
import { createLanguageService } from './language.mjs';
import { createBusinessService } from './business.mjs';
import { createNetworkService } from './network.mjs';
import { createWallpaperService } from './wallpaper.mjs';
import { createAudioService } from './audio.mjs';
import { createNotificationService, createReminderService } from './notifications.mjs';
import { createForestService } from './forest.mjs';
import { releaseMetadata, createReleaseService } from '../domain/release.mjs';
import { invariant } from './errors.mjs';
import { layoutEvents, deadlineInSevenDays } from '../domain/calendar.mjs';
import catalog from '../shared/catalog.json' with { type: 'json' };
import releaseConfig from '../../release.json' with { type: 'json' };

/** Frozen C contracts; browser resources/lifecycle are injected at the edge. */
export async function createCoreServices({ storage: physicalStorage, indexedDB, now, randomUUID, random,
    appVersion, databaseName = dataDatabaseName, storagePrefix = dataStoragePrefix, releaseConfig: metadataSource = releaseConfig, encodeBase64, decodeBase64 = value => decodeURIComponent(escape(atob(value))),
    compression, locks, channel, saveBackup, translate, languages = ['en'],
    origin = 'http://127.0.0.1', fetch: transport = () => Promise.reject(new Error('Network transport unavailable')),
    createAudio, image = () => Promise.reject(new Error('Image converter unavailable')), notification, notificationIcon,
    visible = () => true, focus = () => {}, setTimeout: schedule = setTimeout, clearTimeout: cancel = clearTimeout,
    observe = () => () => {}, onEvent = () => {}, onError = () => {}, fault }) {
    const storage = createScopedStorage(physicalStorage, storagePrefix), releases = releaseMetadata(metadataSource);
    invariant(!appVersion || appVersion === releases.version, 'Application/release metadata mismatch');
    const report = error => { try { onError(error); } catch (_) { /* Observer. */ } };
    const core = createTimerCore({ translate }), codec = createBackupCodec({ compression, translate });
    const themeFactory = createThemeJournal({ now, random, translate });
    let timer, data, settings, business, audio, reminders, ready = false, disposed = false, halted = false, poll;
    const journal = themeFactory.create({ get: key => storage.getItem(key), set: (key, value) => storage.setItem(key, value), remove: key => storage.removeItem(key),
        assertWritable() { invariant(!data.maintenance, 'Recover data maintenance before changing themes', 'conflict'); } });
    const refresh = async () => {
        if (disposed || halted || !ready || data.maintenance) return;
        settings.refresh(); await Promise.all([business.refresh(), timer.refresh()]); reminders.refresh();
    };
    data = createDataService({ indexedDB, storage, databaseName, allowLegacyData: databaseName === 'PomodoroDB6' && storagePrefix === '', timerCore: core, backupCodec: codec,
        now, randomUUID, appVersion: appVersion || releases.version, encodeBase64, locks, channel, saveBackup, translate, fault,
        recoverTheme: () => journal.recover(),
        emit(type, detail) {
            if (type === 'maintenance' || type === 'versionchange' || type === 'blocked') audio?.suspend();
            if (['versionchange','blocked','invalidated'].includes(type)) { halted = true; cancel(poll); network?.cancel(); }
            if (ready && !data.maintenance && ['timer-changed','tasks-changed','calendar-changed','settings-changed'].includes(type)) Promise.resolve().then(refresh).catch(report);
            onEvent(type, detail);
        },
    });
    settings = createPreferencesService({ data, storage, now, randomUUID, encodeBase64, decodeBase64, onError: report,
        onIntent(field, value) { if (field === 'externalNetwork' && !value) { network.cancel();wallpaper.cancel(); } } });
    const language = createLanguageService({ settings, catalog, languages, encodeBase64 });
    const notifications = createNotificationService({ api: notification, focus, onError: report, icon: notificationIcon });
    business = createBusinessService({ data, core, now, randomUUID, settings, onError: report, fault });
    if (createAudio) audio = createAudioService({ createAudio, locks, settings, visible, onError: report, notice: message => onEvent('notice', message), setTimeout: schedule, clearTimeout: cancel });
    timer = createTimerService({ data, core, now, randomUUID, onError: report, onCommit(result) {
        for (const event of result.events) {
            const preferences = settings.getSnapshot(), alarm = event.type === 'work' ? preferences.workAlarm : preferences.breakAlarm;
            audio?.effect(alarm + '.mp3'); notifications.show(language.text(event.type === 'work' ? '专注完成' : '休息结束'), 'FocusTodo');
        }
    } });
    const unsubscribeTimer = timer.subscribe(() => audio?.setTimerState(timer.getSnapshot()?.state || 'initial'));
    const themes = Object.freeze({ read: journal.read,
        async commit(changes, guard = () => true) {
            const expected = journal.read();
            return data.themeStorageOperation(() => {
                const actual = journal.read();
                invariant(Object.keys(expected).every(key => expected[key] === actual[key]), 'Theme changed; refresh and retry', 'conflict');
                invariant(guard(), 'Theme operation cancelled', 'cancelled');
                const result = journal.commit(changes); data.changed('settings'); return result;
            });
        },
    });
    const network = createNetworkService({ fetch: transport, origin, settings, setTimeout: schedule, clearTimeout: cancel });
    const wallpaper = createWallpaperService({ themes, settings, network, image, parseImage: themeFactory.bingImageFromResponse, now, randomUUID });
    reminders = createReminderService({ business, storage, data, notifications, now, setTimeout: schedule, clearTimeout: cancel, onError: report, title: () => language.locale.startsWith('zh') ? '任务到时提醒' : 'Task reminder' });
    const release = createReleaseService({ metadata: releases, storage, data, language });
    const forest = createForestService({ data, storage, now });
    const unobserve = observe({ refresh: () => refresh().catch(report), suspend: () => audio?.suspend(),
        resume: () => { audio?.resume(); refresh().catch(report); }, visibility: () => { audio?.update(); if (visible()) refresh().catch(report); } });
    const dispose = () => {
        disposed = true; ready = false; cancel(poll); unobserve(); unsubscribeTimer();
        wallpaper.dispose(); network.dispose(); reminders.dispose(); notifications.dispose(); audio?.dispose();
        business.dispose(); settings.dispose(); timer.dispose(); data.dispose();
    };
    try {
        await data.initialize(); await data.themeStorageOperation(() => journal.recover());
        settings.refresh(); await settings.initializeIdentity(language.text('本地用户'));
        await timer.recover(); await business.refresh(); reminders.refresh(); ready = true;
        const polling = async () => {
            if (disposed || halted) return;
            try {
                if (!data.maintenance) {
                    if (!channel && visible()) await refresh();
                    const session = timer.getSnapshot();
                    if (session && core.running(session)) await timer.command({type:'tick',expectedSession:session.sessionId});
                }
            } catch (error) { report(error); }
            if (!disposed && !halted) { poll = schedule(polling, 1000); poll?.unref?.(); }
        };
        poll = schedule(polling, 1000); poll?.unref?.();
    } catch (error) { dispose(); throw error; }
    return Object.freeze({
        repository: data, timer, settings, language, business, themes, wallpaper, network, notifications, reminders, release, audio, forest,
        calendar: Object.freeze({ layoutEvents, deadlineInSevenDays: (value = now()) => deadlineInSevenDays(value),
            events(start, end) {
                invariant(Number.isFinite(start) && Number.isFinite(end) && end > start, 'Invalid calendar range');
                const value = business.getSnapshot();
                return [...value.schedules.map(row=>({type:'schedule',...row})),...value.records.map(row=>({type:'focus',...row}))]
                    .filter(row=>row.state!==-1&&Number.isFinite(row.endDate)&&row.interval>0&&row.endDate>start&&row.endDate-row.interval*1000<end)
                    .map(({type,...record})=>({id:record.id,type,start:record.endDate-record.interval*1000,end:record.endDate,record}));
            },
            createTask: input => data.createCalendarTask(input).then(async result=>{await business.refresh();return result}),
            put: (record, expected) => data.putSchedule(record, expected).then(async result=>{await business.refresh();return result}),
        }),
        refresh, suspend: () => audio?.suspend(), resume: () => audio?.resume(),
        async startForTask(taskId, subtaskId = '', mode = settings.getSnapshot().isCountdown ? 'countdown' : 'countup') {
            await business.refresh(); const task = business.getSnapshot().tasks.find(row => row.id === taskId && row.state === 0 && !row.isFinished);
            invariant(task, 'Task no longer available', 'conflict');
            if (subtaskId) invariant(business.getSnapshot().subtasks.some(row => row.id === subtaskId && row.taskId === taskId && row.state === 0 && !row.isFinished), 'Subtask no longer available', 'conflict');
            return timer.command({ type: timer.getSnapshot()?.taskId === taskId && timer.getSnapshot()?.subtaskId === subtaskId ? 'start' : 'switchTask', taskId, subtaskId, mode,
                config: settings.timerConfig(task), expectedSession: timer.getSnapshot()?.sessionId });
        },
        backup: Object.freeze({ export: async options => codec.encode(await data.snapshot(), options),
            async inspect(input) { const decoded = await codec.decode(input); data.validate(decoded.data); return decoded; },
            async reset() { wallpaper.cancel();network.cancel();audio?.suspend();try { const backup=await data.reset();await refresh();return backup; } finally { if (!data.maintenance && !halted) audio?.resume(); } },
            async restore(input, options) { const decoded = await codec.decode(input); wallpaper.cancel(); network.cancel(); audio?.suspend();
                try { const backup = await data.replace(decoded.data, options); await refresh(); return backup; } finally { if (!data.maintenance && !halted) audio?.resume(); } },
        }),
        dispose,
    });
}
