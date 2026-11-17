import { invariant, snapshotSource } from './errors.mjs';
export const preferenceDefinitions = Object.freeze({
    workInterval: ['WorkInterval', 1500], shortBreakInterval: ['ShortBreakInterval', 300], longBreakInterval: ['LongBreakInterval', 900], longBreakPomodoros: ['LongBreakPomodoros', 4],
    autoWorkEnabled: ['AutoWork', false], autoBreakEnabled: ['AutoBreak', false], banBreakEnabled: ['BanBreak', false],
    completeSoundEnabled: ['TskCmpSnd', true], newTaskOnTop: ['NewTskOnTop', true], isCountdown: ['Countdown', true],
    showFinishedTasksInToday: ['ShowFinishedTasksInToday', true], forestEnabled: ['Forest', true],
    workAlarm: ['WorkAlarm', 'alm_Timer'], breakAlarm: ['BreakAlarm', 'alm_Timer'], bgMusic: ['BgMusic', 'bgm_Mute'],
    ringtoneVolume: ['RtnVol', 100], whiteNoiseVolume: ['WNVol', 100], projectRegionWidth: ['ProjectRegionWidth', 280],
    language: ['FocusTodo.language', 'auto'], externalNetwork: ['FocusTodo.externalNetwork', false], isDarkMode: ['DarkMode', null],
    widgetOrder: ['AllWidgets', [0,1,2]], visibleWidgets: ['Widgets', [0,1,2]], widgetExpanded: ['WidgetExpanded', true],
});
export function createPreferencesService({ data, storage, now, randomUUID, encodeBase64, decodeBase64, onError, onIntent = () => {} }) {
    const read = () => {
        const result = {};
        for (const [field, [key, fallback]] of Object.entries(preferenceDefinitions)) {
            const raw = storage.getItem(key);
            let value = raw;
            if (field === 'widgetOrder' || field === 'visibleWidgets') value = raw === null || field==='widgetOrder'&&!raw ? [...fallback] : [...new Set(String(raw).split(',').filter(value=>value!=='').map(Number).filter(value=>[0,1,2].includes(value)))];
            else if (field === 'isDarkMode') value = raw ? raw === 'true' : null;
            else if (typeof fallback === 'boolean') value = !raw ? fallback : raw === 'true';
            else if (typeof fallback === 'number') {
                value = Number(raw) || fallback;
                if (['ringtoneVolume','whiteNoiseVolume'].includes(field)) value = raw === null ? 100 : Math.max(0, Math.min(100, Number(raw)));
                if (field === 'projectRegionWidth') value = Math.round(Math.max(180, Math.min(380, Number(raw) || 280)));
            } else {
                value = raw || fallback;
                if (['workAlarm','breakAlarm'].includes(field) && !value.includes('alm_')) value = fallback;
                if (field === 'bgMusic' && !value.includes('bgm_')) value = fallback;
            }
            result[field] = value;
        }
        const deadline = parseFloat(storage.getItem('DefaultDeadline'));
        const today = new Date(now()); today.setHours(23,59,59,999);
        result.defaultDeadline = Number.isNaN(deadline) ? today.getTime() : deadline;
        result.groupEnabled = false; result.rankingListEnabled = false;
        return result;
    };
    const state = snapshotSource(read(), onError);
    const refresh = () => { state.publish(read()); return state.getSnapshot(); };
    const set = async (field, value) => {
        const definition = preferenceDefinitions[field]; invariant(definition || field === 'defaultDeadline', 'Unknown preference');
        if (field === 'language') invariant(['auto','en','zh-CN'].includes(value), 'Unsupported language');
        if (typeof definition?.[1] === 'boolean') invariant(typeof value === 'boolean', 'Boolean preference required');
        if (['workInterval','shortBreakInterval','longBreakInterval'].includes(field)) invariant(Number.isInteger(value) && value >= 1 && value <= 28800, 'Invalid timer duration');
        if (field === 'longBreakPomodoros') invariant(Number.isInteger(value) && value >= 1 && value <= 100, 'Invalid break cadence');
        if (['ringtoneVolume','whiteNoiseVolume'].includes(field)) invariant(Number.isFinite(value) && value >= 0 && value <= 100, 'Invalid volume');
        if (field === 'projectRegionWidth') { invariant(Number.isFinite(value), 'Invalid sidebar width'); value = Math.round(Math.max(180, Math.min(380, value))); }
        if (['workAlarm','breakAlarm','bgMusic'].includes(field)) invariant(typeof value === 'string' && /^[A-Za-z0-9_]+$/.test(value) && value.startsWith(field === 'bgMusic' ? 'bgm_' : 'alm_'), 'Invalid audio preference');
        if (field === 'isDarkMode') invariant(value === null || typeof value === 'boolean', 'Invalid theme preference');
        if (field === 'defaultDeadline') invariant(Number.isFinite(value) && Math.abs(value) <= 8.64e15, 'Invalid default deadline');
        if (field === 'widgetOrder' || field === 'visibleWidgets') invariant(Array.isArray(value) && value.every(item=>[0,1,2].includes(item)) && new Set(value).size===value.length, 'Invalid timer widgets');
        if (Object.is(state.getSnapshot()[field], value)) return state.getSnapshot();
        onIntent(field, value);
        await data.themeStorageOperation(() => value === null ? storage.removeItem(definition[0]) : storage.setItem(definition?.[0] || 'DefaultDeadline', Array.isArray(value)?value.join(','):String(value)));
        const result = refresh(); data.changed('settings'); return result;
    };
    const profile = () => {
        let name = '';
        try { name = decodeBase64(storage.getItem('cookie.NAME') || ''); } catch (_) { /* Initialization repairs malformed local names. */ }
        return { name, avatar: storage.getItem('Portrait') || '', account: storage.getItem('cookie.ACCT') || '' };
    };
    return Object.freeze({
        getSnapshot: state.getSnapshot, subscribe: state.subscribe, refresh, set, profile,
        async setWidgetLayout(order, visible) {
            for (const values of [order,visible]) invariant(Array.isArray(values)&&values.every(value=>[0,1,2].includes(value))&&new Set(values).size===values.length,'Invalid timer widgets');
            invariant(visible.every(value=>order.includes(value)),'Visible timer widgets must belong to the ordered list');
            await data.themeStorageOperation(()=>{storage.setItem('AllWidgets',order.join(','));storage.setItem('Widgets',visible.join(','));});
            const result=refresh();data.changed('settings');return result;
        },
        goals() { const raw = storage.getItem('Goals'); const rows = raw ? JSON.parse(raw) : [{time:0,type:'TIME',value:180,default:true}]; invariant(Array.isArray(rows) && rows.every(row=>Number.isFinite(row.time)&&Number.isFinite(row.value)&&row.value>=0), 'Invalid daily goals'); return rows; },
        setGoal: minutes => data.themeStorageOperation(()=>{ invariant(Number.isInteger(minutes)&&minutes>=0&&minutes<=1440,'Invalid daily goal'); const rows = JSON.parse(storage.getItem('Goals')||'[]'), time=now(); invariant(Array.isArray(rows),'Invalid daily goals'); const last=rows.at(-1); if(last && time-last.time<86400000)rows.pop(); rows.push({time,type:'TIME',value:minutes,sync:false}); storage.setItem('Goals',JSON.stringify(rows)); data.changed('settings'); }),
        timerConfig: task => ({ interval: task?.pomodoroInterval || state.getSnapshot().workInterval,
            shortBreak: state.getSnapshot().shortBreakInterval, longBreak: state.getSnapshot().longBreakInterval,
            longEvery: state.getSnapshot().longBreakPomodoros, autoWork: state.getSnapshot().autoWorkEnabled,
            autoBreak: state.getSnapshot().autoBreakEnabled, banBreak: state.getSnapshot().banBreakEnabled }),
        async initializeIdentity(localName) {
            await data.themeStorageOperation(() => {
                const values = { ExpiredDate: '0', Version: '6.5', 'cookie.ACCT': encodeBase64('local@local'), 'cookie.NAME': encodeBase64(localName),
                    'cookie.PID': 'local-' + randomUUID(), 'cookie.UID': 'local-' + randomUUID(), 'cookie.JSESSIONID': randomUUID() };
                for (const [key, value] of Object.entries(values)) if (!storage.getItem(key) || key === 'ExpiredDate') storage.setItem(key, value);
                if (!profile().name) storage.setItem('cookie.NAME', encodeBase64(localName));
            });
        },
        async saveProfile(field, value) {
            invariant(['name','avatar'].includes(field), 'Unknown profile field');
            if (field === 'name') invariant(typeof value === 'string' && value.trim() && value.trim().length <= 50, 'Name must contain 1–50 characters');
            else invariant(typeof value === 'string' && value.length <= 512 * 1024 && /^data:image\/(?:png|jpeg|gif);base64,[A-Za-z0-9+/]+=*$/.test(value), 'Invalid avatar');
            await data.themeStorageOperation(() => storage.setItem(field === 'name' ? 'cookie.NAME' : 'Portrait', field === 'name' ? encodeBase64(value.trim()) : value));
            return profile();
        },
        dispose: state.dispose,
    });
}
