/** Optional module is split from the entry. Its failure cannot block mounting. */
export async function loadPreview(signal: AbortSignal): Promise<{ label: string }> {
  const response = await fetch(new URL('./preview.json', import.meta.url), { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Optional preview unavailable');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || !('label' in value) || typeof value.label !== 'string') {
    throw new Error('Invalid optional preview');
  }
  return { label: value.label };
}
