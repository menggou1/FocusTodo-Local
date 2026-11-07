import { useEffect, useReducer, useState, useSyncExternalStore } from 'react';
import type { PrototypeServices } from '../app/contracts';
import { messages, resolveLocale, type LanguagePreference } from '../shared/i18n';
import '../styles/app.css';

const views = ['tasks', 'timer', 'calendar', 'reports', 'forest', 'settings'] as const;
type View = typeof views[number];
type Theme = 'auto' | 'light' | 'dark';
type OptionalState = 'loading' | 'ready' | 'failed';

export function App({ services }: { services: PrototypeServices }) {
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const tasks = useSyncExternalStore(services.tasks.subscribe, services.tasks.getSnapshot);
  const [view, navigate] = useReducer((_previous: View, next: View) => next, 'tasks');
  const [optionalState, setOptionalState] = useState<OptionalState>('loading');
  const [attempt, retryOptional] = useReducer((value: number) => value + 1, 0);
  const [saveFailed, setSaveFailed] = useState(false);
  const locale = resolveLocale(preferences.language);
  const text = messages(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'zh-CN' ? 'FocusTodo · 独立应用预览' : 'FocusTodo · Independent app preview';
  }, [locale]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = preferences.theme === 'auto' ? (media.matches ? 'dark' : 'light') : preferences.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.theme]);

  useEffect(() => {
    const controller = new AbortController();
    setOptionalState('loading');
    void services.loadOptional(controller.signal).then(() => {
      if (!controller.signal.aborted) setOptionalState('ready');
    }, () => {
      if (!controller.signal.aborted) setOptionalState('failed');
    });
    return () => controller.abort();
  }, [services, attempt]);

  function savePreference(write: () => void) {
    try {
      write();
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }

  const optionalMessage = optionalState === 'ready' ? text.optionalReady : optionalState === 'failed' ? text.optionalFailed : text.optionalLoading;

  return (
    <div className="prototype-shell" data-testid="app-shell">
      <a className="prototype-skip" href="#prototype-content">{text.skip}</a>
      <header className="prototype-header">
        <span className="prototype-mark" aria-hidden="true">✓</span>
        <span className="prototype-brand">FocusTodo</span>
        <span className="prototype-header-caption">{text.prototype}</span>
        <span className="prototype-badge">{text.sample}</span>
      </header>
      <div className="prototype-notice" role="note">{text.notice}</div>
      <div className="prototype-layout">
        <nav className="prototype-sidebar" aria-label={text.navigation}>
          <p className="prototype-sidebar-title">{text.prototype}</p>
          {views.map(item => (
            <button key={item} className="prototype-nav" aria-current={view === item ? 'page' : undefined} onClick={() => navigate(item)} data-view={item}>
              <span className="prototype-nav-dot" aria-hidden="true" />{text[item]}
            </button>
          ))}
          <div className="prototype-sidebar-footer">{text.previewFooter}</div>
        </nav>
        <main className="prototype-content" id="prototype-content" tabIndex={-1}>
          <div className="prototype-view-heading"><h1>{text[view]}</h1><span className="prototype-muted">{text.readOnly}</span></div>
          {view === 'tasks' ? (
            <section aria-label={text.taskList}>
              <p className="prototype-intro">{text.taskHelp}</p>
              <ul className="prototype-tasks">
                {tasks.length ? tasks.map(task => <li key={task.id} data-testid="prototype-task"><span className="prototype-task-circle" aria-hidden="true" /><span>{task.title}</span><span className="prototype-task-tag">{text.sample}</span></li>) : <li>{text.noTasks}</li>}
              </ul>
            </section>
          ) : view === 'settings' ? (
            <section className="prototype-settings">
              <p className="prototype-intro">{text.settingsHelp}</p>
              <label className="prototype-setting-row"><span>{text.language}</span><select data-testid="prototype-language" aria-label={text.language} value={preferences.language} onChange={event => savePreference(() => services.preferences.setLanguage(event.currentTarget.value as LanguagePreference))}>
                <option value="auto">{text.automatic}</option><option value="zh-CN">简体中文</option><option value="en">English</option>
              </select></label>
              <label className="prototype-setting-row"><span>{text.theme}</span><select data-testid="prototype-theme" aria-label={text.theme} value={preferences.theme} onChange={event => savePreference(() => services.preferences.setTheme(event.currentTarget.value as Theme))}>
                <option value="auto">{text.automatic}</option><option value="light">{text.light}</option><option value="dark">{text.dark}</option>
              </select></label>
              {saveFailed && <p role="alert" className="prototype-inline-error">{text.saveError}</p>}
            </section>
          ) : (
            <section className="prototype-empty"><span className="prototype-empty-symbol" aria-hidden="true">○</span><h2>{text.pending}</h2><p>{text.pendingHelp}</p></section>
          )}
          <section className="prototype-resource-card" aria-label={text.optionalTitle}>
            <h2>{text.optionalTitle}</h2>
            <p data-testid="optional-status" data-state={optionalState} role="status">{optionalMessage}</p>
            {optionalState === 'failed' && <button className="prototype-button" data-testid="optional-retry" onClick={retryOptional}>{text.retry}</button>}
          </section>
        </main>
        <aside className="prototype-timer-panel" aria-label={text.timerPreview}>
          <p className="prototype-timer-title">{text.timerPreview}</p>
          <div className="prototype-timer-ring" aria-hidden="true"><span>25:00</span></div>
          <p className="prototype-timer-idle">{text.timerIdle}</p>
          <p className="prototype-timer-help">{text.timerHelp}</p>
        </aside>
      </div>
      <footer className="prototype-footer">{text.previewFooter}<span>{text.version}: {services.environment.appVersion}</span></footer>
    </div>
  );
}
