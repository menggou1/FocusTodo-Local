export const preferencePrefix = 'FocusTodoStandalone.';
export class IsolationError extends Error {
  constructor(reason: string) {
    super(`${reason} Use a fresh browser context and the isolated preview server. Existing data was not changed.`);
    this.name = 'IsolationError';
  }
}

/** Fail closed before constructing adapters. Never opens a legacy database. */
export async function verifyIsolation(signal: AbortSignal, allowServiceData = false): Promise<void> {
  if (!['127.0.0.1', 'localhost'].includes(location.hostname) || location.protocol !== 'http:') {
    throw new IsolationError('Open the HTTP loopback URL printed by the preview script.');
  }
  const response = await fetch(new URL('__prototype/session.json', document.baseURI), {
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal,
  });
  if (!response.ok) throw new IsolationError(`The preview session endpoint returned HTTP ${response.status}.`);
  const session: unknown = await response.json();
  if (!session || typeof session !== 'object' || !('kind' in session) || session.kind !== 'isolated-prototype'
    || !('origin' in session) || session.origin !== location.origin) throw new IsolationError('The server did not prove that this origin is isolated.');
  for (let index = 0; index < localStorage.length; index++) {
    if (!localStorage.key(index)?.startsWith(preferencePrefix)) throw new IsolationError('Non-preview browser settings exist on this origin.');
  }
  // If storage cannot be inspected, we cannot establish the isolation contract.
  if (!indexedDB.databases) throw new IsolationError('This browser cannot verify the database namespace.');
  const databases = await indexedDB.databases();
  if (databases.some(database => !allowServiceData ||
    !(database.name === 'FocusTodoStandalone.PomodoroDB6' && database.version === 3 ||
      database.name === 'FocusTodoStandalone.PomodoroDB6-maintenance-lock' && database.version === 1))) throw new IsolationError('A database on this origin is outside the preview namespace.');
}
