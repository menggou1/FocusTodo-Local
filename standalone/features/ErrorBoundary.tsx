import { Component, type ReactNode } from 'react';
import { messages } from '../shared/i18n';
import { ConfirmDialog } from './workspace/ConfirmDialog';

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
      <ConfirmDialog title={text.errorTitle} message={text.errorHelp} close={this.retry} canClose={false} className="recovery-dialog"
        extra={<div data-testid="error-boundary">
          <pre className="recovery-details" aria-label={text.errorDetails} tabIndex={0} data-selectable>{this.state.details}</pre>
          {this.state.copyStatus && <p className="recovery-copy-status" role="status">{this.state.copyStatus}</p>}
        </div>}>
        <button type="button" onClick={async event => {
          const field = event.currentTarget.closest('dialog')?.querySelector('pre');
          if (!field) return;
          try {
            await navigator.clipboard.writeText(field.textContent ?? '');
            this.setState({ copyStatus: text.copied });
          } catch {
            field.focus();
            const range = document.createRange();
            range.selectNodeContents(field);
            const selection = getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            this.setState({ copyStatus: text.copyFailed });
          }
        }}>{text.copyDetails}</button>
        <button type="button" className="primary" onClick={this.retry}>{text.reload}</button>
      </ConfirmDialog>
    );
  }
}
