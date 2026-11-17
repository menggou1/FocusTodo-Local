import { useRef, useState, useSyncExternalStore } from 'react';
import type { PreferenceState, WritablePreference } from '../../services/core.mjs';
import { useWorkspace } from './Context';

/** Keep controls responsive while the existing settings transaction persists.
 * Coalesce pointer input; never send an older value after a newer one. */
export function usePreferenceChanges() {
  const { services, report, blocked } = useWorkspace();
  const stored = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  const [draft, setDraft] = useState<Partial<PreferenceState>>({});
  const pending = useRef(new Map<WritablePreference, PreferenceState[WritablePreference]>());
  const saving = useRef(false);
  async function flush() {
    if (saving.current) return;
    saving.current = true;
    try {
      while (pending.current.size) {
        const [key, value] = pending.current.entries().next().value!;
        pending.current.delete(key);
        try { await services.settings.set(key, value as never); }
        catch (error) { report(error); }
        if (!pending.current.has(key)) setDraft(previous => { const next = { ...previous }; delete next[key]; return next; });
      }
    } finally { saving.current = false; }
  }
  function change<K extends WritablePreference>(key: K, value: PreferenceState[K]) {
    if (blocked || Object.is(pending.current.has(key)?pending.current.get(key):(Object.hasOwn(draft,key)?draft[key]:stored[key]),value)) return;
    setDraft(previous => ({ ...previous, [key]: value }));
    pending.current.set(key, value);
    void flush();
  }
  return { prefs: { ...stored, ...draft } as PreferenceState, change };
}
