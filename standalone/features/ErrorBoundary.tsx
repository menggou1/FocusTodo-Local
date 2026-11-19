import { Component, type ReactNode } from 'react';
import { messages } from '../shared/i18n';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  onError?: (error: unknown) => void;
}

export class ErrorBoundary extends Component<Props, { details: string | null; copyStatus: string }> {
  state = { details: null as string | null, copyStatus: '' };

  static getDerivedStateFromError(error: unknown) {
    return { details: (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 1200), copyStatus: '' };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError?.(error);
  }

  retry = (): void => {
    if (this.props.onRetry) {
      this.props.onRetry();
      this.setState({ details: null, copyStatus: '' });
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.details === null) return this.props.children;
    const text = messages(document.documentElement.lang.startsWith('zh') ? 'zh-CN' : 'en');
    return (
      <main className="prototype-error" data-testid="error-boundary" role="alert">
        <h1>{text.errorTitle}</h1>
        <p data-selectable>{text.errorHelp}</p>
        <label htmlFor="prototype-render-details">{text.errorDetails}</label>
        <textarea id="prototype-render-details" rows={4} readOnly value={this.state.details} />
        <button className="prototype-button" onClick={async event => {
          const field = event.currentTarget.parentElement?.querySelector('textarea');
          if (!field) return;
          try {
            await navigator.clipboard.writeText(field.value);
            this.setState({ copyStatus: text.copied });
          } catch {
            field.focus();
            field.select();
            this.setState({ copyStatus: text.copyFailed });
          }
        }}>{text.copyDetails}</button>
        <span role="status">{this.state.copyStatus}</span>
        <button className="prototype-button prototype-button-primary" onClick={this.retry}>{text.reload}</button>
      </main>
    );
  }
}
