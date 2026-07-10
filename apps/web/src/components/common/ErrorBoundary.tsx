'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-hairline-subtle bg-surface p-8 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-signal-negative/30 bg-signal-negative/10 text-signal-negative">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-ink-primary">Algo deu errado</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-secondary">
            {this.state.error?.message ?? 'Ocorreu um erro inesperado ao carregar esta seção.'}
          </p>
          <Button onClick={this.handleRetry} className="mt-6">
            <RotateCcw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
