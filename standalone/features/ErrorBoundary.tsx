import { Component, type ReactNode } from 'react';
import { messages } from '../shared/i18n';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  retry = (): void => {
    if (this.props.onRetry) {
      this.props.onRetry();
      this.setState({ failed: false });
    } else {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const text = messages(document.documentElement.lang.startsWith('zh') ? 'zh-CN' : 'en');
    return (
      <main className="prototype-error" data-testid="error-boundary" role="alert">
        <h1>{text.errorTitle}</h1>
        <p>{text.errorHelp}</p>
        <button className="prototype-button prototype-button-primary" onClick={this.retry}>{text.reload}</button>
      </main>
    );
  }
}
