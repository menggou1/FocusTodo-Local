export type Confirmation = { title: string; message: string; confirmTitle?: string; resolve(value: boolean): void };
let present: ((request: Confirmation) => void) | undefined;
/** The browser adapter and React controls share the same application confirmation. */
export function installConfirmation(handler: (request: Confirmation) => void) {
  present = handler;
  return () => { if (present === handler) present = undefined; };
}
export function confirmInApp(title: string, message: string, confirmTitle?: string): Promise<boolean> {
  if (!present) return Promise.resolve(false);
  return new Promise(resolve => present!({ title, message, confirmTitle, resolve }));
}
