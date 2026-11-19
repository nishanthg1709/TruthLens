import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readable = `Firestore ${parsed.operationType || 'operation'} error on ${parsed.path || 'record'}: ${parsed.error}`;
      }
    } catch {
      // Plain text error
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error) {
    console.error('TruthLens ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-tl-bg text-tl-text flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-lg border border-tl-border bg-tl-panel p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-tl-alert">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <h1 className="font-display text-lg font-semibold text-tl-text">
                Workspace Recovery Notice
              </h1>
            </div>
            <p className="text-sm text-tl-muted leading-relaxed">{this.state.message}</p>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, message: '' });
                  window.location.href = '/';
                }}
                className="px-4 py-2 rounded-md bg-tl-text text-tl-bg text-xs font-semibold hover:opacity-90"
              >
                Return to Landing Page
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3.5 py-2 rounded-md border border-tl-border text-xs font-medium text-tl-text hover:border-tl-muted"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
