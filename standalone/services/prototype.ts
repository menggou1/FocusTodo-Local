import type { LanguagePreference, Preferences, PrototypeServices, ThemePreference } from '../app/contracts';
import { versionMetadata } from '../domain/version';
import { preferencePrefix } from './isolation';

declare const __LOCAL_VERSION__: string;
declare const __SOURCE_VERSION__: string;

export function createPrototypeServices(core: import('./core.mjs').CoreServices): PrototypeServices {
  const { repository, ...applicationServices } = core;
  void repository;
  const read = (key: string) => localStorage.getItem(preferencePrefix + key);
  let preferences: Preferences = Object.freeze({
    language: (['auto', 'zh-CN', 'en'].includes(read('language') || '') ? read('language') : 'auto') as LanguagePreference,
    theme: (['auto', 'light', 'dark'].includes(read('theme') || '') ? read('theme') : 'auto') as ThemePreference,
  });
  const listeners = new Set<() => void>();
  const tasks = Object.freeze([Object.freeze({ id: 'prototype-task-1', title: 'Prototype task' })]);
  const update = (key: keyof Preferences, value: LanguagePreference | ThemePreference) => {
    // Commit to storage before publishing; failure leaves the snapshot intact.
    localStorage.setItem(preferencePrefix + key, value);
    preferences = Object.freeze({ ...preferences, [key]: value });
    listeners.forEach(listener => listener());
  };
  const storageChanged = (event: StorageEvent) => {
    if (event.storageArea !== localStorage || ![preferencePrefix + 'language', preferencePrefix + 'theme'].includes(event.key || '')) return;
    preferences = Object.freeze({
      language: (['auto', 'zh-CN', 'en'].includes(read('language') || '') ? read('language') : 'auto') as LanguagePreference,
      theme: (['auto', 'light', 'dark'].includes(read('theme') || '') ? read('theme') : 'auto') as ThemePreference,
    });
    listeners.forEach(listener => listener());
  };
  addEventListener('storage', storageChanged);
  return {
    core: Object.freeze(applicationServices),
    environment: Object.freeze({ kind: 'isolated-prototype', origin: location.origin, ...versionMetadata(__LOCAL_VERSION__, __SOURCE_VERSION__) }),
    preferences: {
      getSnapshot: () => preferences,
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      setLanguage(value) {
        if (!['auto', 'zh-CN', 'en'].includes(value)) throw new Error('Unsupported language');
        update('language', value);
      },
      setTheme(value) {
        if (!['auto', 'light', 'dark'].includes(value)) throw new Error('Unsupported theme');
        update('theme', value);
      },
    },
    tasks: { getSnapshot: () => tasks, subscribe: () => () => {} },
    async loadOptional(signal) {
      const { loadPreview } = await import('../assets/optional-preview');
      signal.throwIfAborted();
      return loadPreview(signal);
    },
    dispose() { removeEventListener('storage', storageChanged); listeners.clear(); core.dispose(); },
  };
}
