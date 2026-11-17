/* This test entry is built in memory and never enters the candidate package. */
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../../standalone/features/ErrorBoundary';
import '../../standalone/styles/shell.css';

let fail = true;
function Subject() {
  if (fail) throw new Error('Synthetic component render failure');
  return <p data-testid="boundary-recovered">Recovered synthetic component</p>;
}

createRoot(document.getElementById('test-root')!).render(
  <ErrorBoundary onRetry={() => { fail = false; }}><Subject /></ErrorBoundary>
);
