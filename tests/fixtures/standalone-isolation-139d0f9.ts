export const preferencePrefix = 'FocusTodoStandalone.';
export class IsolationError extends Error {
  constructor() { super('Use a fresh browser context and the isolated prototype server. Existing data was not changed.'); }
}

/** Fail closed before constructing adapters. Never opens a legacy database. */
export async function verifyIsolation(signal: AbortSignal): Promise<void> {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname) || location.protocol !== 'http:') {
    throw new IsolationError();
  }
  const response = await fetch(new URL('__prototype/session.json', document.baseURI), {
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal,
  });
  if (!response.ok) throw new IsolationError();
  const session: unknown = await response.json();
  if (!session || typeof session !== 'object' || !('kind' in session) || session.kind !== 'isolated-prototype'
    || !('origin' in session) || session.origin !== location.origin) throw new IsolationError();
  for (let index = 0; index < localStorage.length; index++) {
    if (!localStorage.key(index)?.startsWith(preferencePrefix)) throw new IsolationError();
  }
  // If storage cannot be inspected, we cannot establish the isolation contract.
  if (!indexedDB.databases || (await indexedDB.databases()).length) throw new IsolationError();
}
