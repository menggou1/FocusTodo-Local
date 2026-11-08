/** Current Phase B preview contracts. Phase C services are composed separately. */
export type { CoreCapabilities, CoreServices, ApplicationServices } from '../services/core.mjs';
export type LanguagePreference = 'auto' | 'zh-CN' | 'en';
export type ThemePreference = 'auto' | 'light' | 'dark';
export type Unsubscribe = () => void;
export interface SnapshotSource<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): Unsubscribe;
}
export interface Preferences {
  readonly language: LanguagePreference;
  readonly theme: ThemePreference;
}
export interface PrototypeTask {
  readonly id: string;
  readonly title: string;
}
export interface PrototypeServices {
  readonly core: import('../services/core.mjs').ApplicationServices;
  readonly environment: {
    readonly kind: 'isolated-prototype';
    readonly origin: string;
    readonly appVersion: string;
    readonly sourceVersion: string;
    readonly schemaVersion: 3;
  };
  readonly preferences: SnapshotSource<Preferences> & {
    setLanguage(value: LanguagePreference): void;
    setTheme(value: ThemePreference): void;
  };
  readonly tasks: SnapshotSource<readonly PrototypeTask[]>;
  loadOptional(signal: AbortSignal): Promise<{ label?: string }>;
  dispose(): void;
}

/** Future adapters inject these capabilities; components never own transactions. */
export interface Clock { now(): number }
export interface CommandContext { readonly signal?: AbortSignal }
export interface ServiceFailure {
  readonly code: 'storage-unavailable' | 'conflict' | 'validation' | 'cancelled';
  readonly recoverable: boolean;
}
