/** Application service contract; persistence is owned by explicit services. */
export type { CoreCapabilities, CoreServices, ApplicationServices } from '../services/core.mjs';
export type Unsubscribe = () => void;
export interface SnapshotSource<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): Unsubscribe;
}
