import { useEffect, useRef, useState } from 'react';
import { installConfirmation, type Confirmation } from '../../services/confirmation';
import { ConfirmDialog } from './ConfirmDialog';
import { useWorkspace } from './Context';

export function ConfirmationHost() {
  const { text } = useWorkspace();
  const [request, setRequest] = useState<Confirmation | null>(null);
  const current = useRef<Confirmation | null>(null), decision = useRef(false);
  useEffect(() => {
    const remove = installConfirmation(next => {
      current.current?.resolve(false);
      decision.current = false; current.current = next; setRequest(next);
    });
    return () => { remove(); current.current?.resolve(false); current.current = null; };
  }, []);
  function finish(value: boolean) {
    const pending = current.current;
    current.current = null; setRequest(null); pending?.resolve(value);
  }
  return request && <ConfirmDialog title={request.title} message={request.message} close={() => finish(decision.current)}>{dismiss => <>
    <button onClick={dismiss}>{text.cancel}</button>
    <button className="primary" onClick={() => { decision.current=true; dismiss(); }}>{request.confirmTitle || text.confirm}</button>
  </>}</ConfirmDialog>;
}
