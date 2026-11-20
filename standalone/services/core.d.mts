import type { SnapshotSource } from '../app/contracts';

export type StoreName = 'Project' | 'Task' | 'Subtask' | 'Pomodoro' | 'Schedule' | 'Group' | 'GroupUser' | 'Message' | 'TimerSession' | 'LocalMeta';
export type CompatibleRecord = { [key: string]: unknown };
export interface TimerConfig {
    interval: number; shortBreak: number; longBreak: number; longEvery: number;
    autoWork: boolean; autoBreak: boolean; banBreak: boolean;
}
export interface Recovery {
    from: number; to: number; priorState: 'work' | 'rest'; detectedAt: number;
    clockChanged?: boolean; source?: 'import';
}
export interface TimerSession {
    id: 'active'; sessionId: string; revision: number;
    state: 'initial' | 'work' | 'rest' | 'pause' | 'waitingForRest' | 'recovery';
    mode: 'countup' | 'countdown'; taskId: string; subtaskId: string; config: Readonly<TimerConfig>;
    cursorAt: number; observedAt: number; phaseElapsed: number; totalSeconds: number; recordedSeconds: number;
    spans: readonly { start: number; end: number }[]; sequence: number; blockSequence: number;
    completed: number; pendingRecovery: Readonly<Recovery> | null; pausedFrom?: 'rest';
}
export interface TimerAction {
    type: 'start' | 'pause' | 'resume' | 'rest' | 'stop' | 'mode' | 'switchTask' | 'detach' | 'configure' | 'flush' | 'resolve' | 'tick';
    sessionId?: string; expectedSession?: string; mode?: 'countup' | 'countdown';
    taskId?: string; subtaskId?: string; config?: Partial<TimerConfig>; completed?: number;
    gapMs?: number; cutoff?: number; continue?: boolean; paused?: boolean;
}
export interface TimerResult {
    session: TimerSession; records: CompatibleRecord[];
    events: { type: 'work' | 'break'; at: number }[]; recovered: boolean;
}
export interface BackupSnapshot {
    meta: { app: 'FocusTodo'; exportVersion: 1 | 2; dbVersion: number; dbName?: string;
        exportDate?: string; patch?: string; scope?: 'full' | 'without-wallpapers' };
    indexedDB: Partial<Record<StoreName, CompatibleRecord[]>>;
    localStorage: Record<string, string>;
}
export interface BackupOptions { format?: 'json' | 'gzip'; includeWallpapers?: boolean }
export interface BackupInspection {
    data: BackupSnapshot; format: 'json' | 'gzip'; scope: 'full' | 'without-wallpapers'; decodedBytes: number;
}
export interface EncodedBackup {
    data: BackupSnapshot; bytes: Uint8Array; rawBytes: number; size: number;
    format: 'json' | 'gzip'; fallback: boolean; extension: '.json' | '.json.gz';
    scope: 'full' | 'without-wallpapers'; mime: 'application/gzip' | 'application/json';
}
export type TransactionBody<T> = (tx: IDBTransaction, done: (value: T) => void, fail: (error: Error) => void) => void;
/** Repository is for other services. Components consume domain commands/snapshots. */
export interface DataRepository {
    readonly DB_NAME: 'PomodoroDB6'; readonly DB_VERSION: 3;
    readonly BASE: readonly StoreName[]; readonly DATA: readonly StoreName[]; readonly ALL: readonly StoreName[];
    readonly maintenance: boolean;
    initialize(): Promise<void>;
    changed(type: string): void;
    read<T>(stores: StoreName[], body: TransactionBody<T>): Promise<T>;
    write<T>(stores: StoreName[], body: TransactionBody<T>): Promise<T>;
    defaultProjects(now?: number): CompatibleRecord[];
    validate(input: unknown): BackupSnapshot;
    snapshot(): Promise<BackupSnapshot>;
    replace(input: unknown, options?: { backup?: boolean }): Promise<BackupSnapshot>;
    reset(): Promise<BackupSnapshot>;
    timerAction(action: TimerAction, now: number): Promise<TimerResult>;
    session(): Promise<TimerSession | null>;
    putPomodoro(record: CompatibleRecord): Promise<CompatibleRecord>;
    createCalendarTask(input: { name: string; count: number; interval: number; startTime: number;
        projectId: string; shortBreak?: number; addToTop?: boolean }): Promise<{ task: CompatibleRecord; schedules: CompatibleRecord[] }>;
    putSchedule(record: CompatibleRecord, expected?: CompatibleRecord): Promise<CompatibleRecord>;
    themeStorageOperation<T>(body: () => T | Promise<T>): Promise<T>;
    dispose(): void;
}
export type ThemeState = { themes: string | null; active: string | null; theme: string | null };
export interface Entity extends CompatibleRecord { id: string; name?: string; state?: number; order?: number }
export interface BusinessSnapshot {
    projects: readonly Readonly<Entity>[]; tasks: readonly Readonly<Entity>[]; subtasks: readonly Readonly<Entity>[];
    schedules: readonly Readonly<Entity>[]; records: readonly Readonly<Entity>[]; sessions: readonly Readonly<TimerSession>[];
}
export type BusinessCommand =
    | { type: 'addProject' | 'addTask' | 'addSubtask' | 'addSchedule' | 'addRecord'; values: CompatibleRecord }
    | { type: 'updateProject' | 'updateTask' | 'updateSubtask' | 'updateSchedule' | 'updateRecord'; id: string; changes: CompatibleRecord; expected?: CompatibleRecord }
    | { type: 'removeProject' | 'removeSubtask' | 'removeSchedule' | 'removeRecord' | 'completeTask' | 'uncompleteTask' | 'toggleSubtask'; id: string; expected?: CompatibleRecord }
    | { type: 'removeTask'; id: string; preserveHistory?: boolean; repeat?: 'current'; expected?: CompatibleRecord }
    | { type: 'setProjectHidden'; id: string; hidden: boolean; expected?: CompatibleRecord }
    | { type: 'reorderProjects'; snapshot: {id: string; order: number}[]; from: string; to: string }
    | { type: 'restoreProjectOrder' };
export interface Report { time: number; count: number; byTask: Record<string, number>; byProject: Record<string, number> }
export interface PreferenceState {
    workInterval: number; shortBreakInterval: number; longBreakInterval: number; longBreakPomodoros: number;
    autoWorkEnabled: boolean; autoBreakEnabled: boolean; banBreakEnabled: boolean; completeSoundEnabled: boolean;
    newTaskOnTop: boolean; isCountdown: boolean; showFinishedTasksInToday: boolean; forestEnabled: boolean;
    workAlarm: string; breakAlarm: string; bgMusic: string; ringtoneVolume: number; whiteNoiseVolume: number;
    projectRegionWidth: number; language: 'auto' | 'en' | 'zh-CN'; externalNetwork: boolean; isDarkMode: boolean | null; defaultDeadline: number;
    widgetOrder: readonly number[]; visibleWidgets: readonly number[]; widgetExpanded: boolean;
    groupEnabled: false; rankingListEnabled: false;
}
export type WritablePreference = Exclude<keyof PreferenceState, 'groupEnabled' | 'rankingListEnabled'>;
export interface AudioService {
    update(): void; setTimerState(state: string): void; effect(file: string, volume?: number): void;
    audition(file: string, volume?: number): void; auditionVolume(value: number): void; volumeTip(value: number): void; stopAudition(): void;
    previewWhiteNoiseVolume(value: number | null): void;
    suspend(): void; resume(): void; dispose(): void;
}
export interface CoreServices {
    readonly repository: DataRepository;
    readonly timer: SnapshotSource<Readonly<TimerSession> | null> & {
        refresh(): Promise<Readonly<TimerSession> | null>;
        recover(): Promise<Readonly<TimerSession> | null>;
        command(action: TimerAction): Promise<TimerResult>;
        view(): { state: string; interval: number; elapse: number; startTime: number; breakpoint: number } | null;
        dispose(): void;
    };
    readonly themes: { read(): ThemeState; commit(changes: Partial<ThemeState>): Promise<ThemeState> };
    readonly settings: SnapshotSource<Readonly<PreferenceState>> & {
        refresh(): Readonly<PreferenceState>; set<K extends WritablePreference>(field: K, value: PreferenceState[K]): Promise<Readonly<PreferenceState>>;
        setWidgetLayout(order: readonly number[], visible: readonly number[]): Promise<Readonly<PreferenceState>>;
        goals(): readonly {time: number; type: string; value: number; [key: string]: unknown}[]; setGoal(minutes: number): Promise<void>;
        timerConfig(task?: CompatibleRecord): TimerConfig; profile(): {name: string; avatar: string; account: string};
        subscribeProfile(listener: () => void): () => void;
        initializeIdentity(localName: string): Promise<void>; saveProfile(field: 'name' | 'avatar', value: string): Promise<{name: string; avatar: string; account: string}>;
        dispose(): void;
    };
    readonly business: SnapshotSource<Readonly<BusinessSnapshot>> & {
        batch(commands: BusinessCommand[]): Promise<CompatibleRecord[]>;
        refresh(): Promise<Readonly<BusinessSnapshot>>; command(input: BusinessCommand): Promise<CompatibleRecord | CompatibleRecord[]>;
        search(keyword: string): readonly Entity[]; report(start: number, end: number): Report;
        tasksInView(view: {id: string; type: number}, finished?: boolean): readonly Entity[];
        history(filter?: {start?: number; end?: number; taskId?: string; subtaskId?: string}): readonly Entity[];
        progress(taskId: string): number[];
        buckets(start: number, end: number, unit?: 'day' | 'week' | 'month' | 'year'): (Report & {start: number; end: number})[];
        reminders(read?: string[]): {due: readonly Entity[]; unread: readonly Entity[]; next: number}; dispose(): void;
    };
    readonly language: { readonly locale: string; text<T>(value: T): T | string; lookup(key: string, value?: string): string;
        legacyText(key: string, ...args: unknown[]): string; update(entry: CompatibleRecord): CompatibleRecord;
        accountName(value: string): string; setPreference(value: 'auto' | 'en' | 'zh-CN'): Promise<Readonly<PreferenceState>> };
    readonly network: {
        request(input: string, type?: 'json' | 'blob' | 'text', options?: {signal?: AbortSignal; timeout?: number}): Promise<unknown>;
        permits(input: string): boolean; cancel(): void; dispose(): void;
    };
    readonly wallpaper: { read(): Record<string, CompatibleRecord>; fresh(value: CompatibleRecord): boolean; cancel(): void;
        subscribe(listener: () => void): () => void; getSnapshot(): Readonly<{ loading: boolean; version: number }>;
        add(blob: Blob, name?: string): Promise<string>; select(id: string): Promise<void>; classic(id: string): Promise<void>;
        remove(id: string): Promise<void>; bing(): Promise<CompatibleRecord>; dispose(): void };
    readonly audio: AudioService | undefined;
    readonly forest: { dailyLaunch(): Promise<void>; rewards(): Promise<{itemType: 0 | 1 | 2 | 3; id: string; date: number; powerValue: number}[]>; read(): CompatibleRecord; get(field: string): string | number; set(field: string, value: string | number): Promise<void>;
        collect(item: {itemType: 0 | 1 | 2 | 3; id: string; date: number; powerValue: number}): Promise<CompatibleRecord>;
        syncAchievements(): Promise<{metrics: {seconds: number; tasks: number; days: number}; earned: Record<string, number>; reward: number; unlocked: string[]}> };
    readonly calendar: {
        layoutEvents(events: readonly {id: string; start: number; end: number}[], start: number, end: number, minuteHeight: number): CompatibleRecord[];
        deadlineInSevenDays(now?: number): number;
        events(start: number, end: number): {id: string; type: string; start: number; end: number; record: CompatibleRecord}[];
        createTask(input: Parameters<DataRepository['createCalendarTask']>[0]): ReturnType<DataRepository['createCalendarTask']>;
        put(record: CompatibleRecord, expected?: CompatibleRecord): Promise<CompatibleRecord>;
    };
    readonly notifications: SnapshotSource<NotificationPermission | 'unavailable'> & { refresh(): NotificationPermission | 'unavailable';
        requestPermission(): Promise<NotificationPermission | 'unavailable'>; show(title: string, body: string): boolean; dispose(): void };
    readonly reminders: SnapshotSource<{due: readonly Entity[]; unread: readonly Entity[]; next: number}> & {
        refresh(notify?: boolean): {due: readonly Entity[]; unread: readonly Entity[]; next: number} | undefined;
        markRead(): Promise<{due: readonly Entity[]; unread: readonly Entity[]; next: number}>; dispose(): void };
    readonly release: { readonly metadata: {version: string; sourceVersion: string; schemaVersion: 3; updates: readonly CompatibleRecord[]};
        hasUnread(): boolean; entries(): CompatibleRecord[]; markRead(version: string): Promise<void>;
        identify(value: string): {kind: 'legacy-local' | 'independent'; version: string; parts: readonly number[]} | null };
    refresh(): Promise<void>; suspend(): void; resume(): void;
    startForTask(taskId: string, subtaskId?: string, mode?: 'countup' | 'countdown'): Promise<TimerResult>;
    readonly backup: {
        export(options?: BackupOptions): Promise<EncodedBackup>;
        inspect(input: string | Blob | ArrayBuffer | ArrayBufferView): Promise<BackupInspection>;
        reset(): Promise<BackupSnapshot>;
        restore(input: string | Blob | ArrayBuffer | ArrayBufferView, options?: { backup?: boolean }): Promise<BackupSnapshot>;
    };
    dispose(): void;
}
export interface CoreCapabilities {
    storage: Storage; indexedDB: IDBFactory; now(): number; randomUUID(): string; random(): number;
    databaseName?: string; storagePrefix?: string;
    appVersion?: string; encodeBase64(value: string): string;
    releaseConfig?: {localVersion: string; officialVersion: string; date: string; updates: CompatibleRecord[]; [key: string]: unknown};
    decodeBase64?(value: string): string; languages?: readonly string[];
    origin?: string; fetch?: typeof fetch; createAudio?(file: string): HTMLAudioElement;
    image?(blob: Blob, options?: {thumbnailFromCompressed?: boolean}): Promise<{dataUrl: string; thumbnail: string}>; notification?: typeof Notification; notificationIcon?: string;
    visible?(): boolean; focus?(): void;
    setTimeout?(callback: () => void, delay: number): unknown; clearTimeout?(handle: unknown): void;
    observe?(handlers: {refresh(): void; suspend(): void; resume(): void; visibility(): void}): () => void;
    compression?: { CompressionStream?: typeof CompressionStream; DecompressionStream?: typeof DecompressionStream };
    locks?: LockManager | null; channel?: BroadcastChannel | null;
    saveBackup?(snapshot: BackupSnapshot, prefix: string): Promise<void>;
    translate?(value: string): string;
    onEvent?(type: string, detail?: unknown): void; onError?(error: unknown): void;
    /** Test-only failure injection; never mutate the supplied transaction. */
    fault?(point: string, detail?: unknown): void;
}
export function createCoreServices(capabilities: CoreCapabilities): Promise<CoreServices>;
/** Frozen contract v1 for D: components never receive repository transactions. */
export type ApplicationServices = Omit<CoreServices, 'repository'>;
