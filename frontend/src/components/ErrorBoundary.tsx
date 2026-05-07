// frontend/src/components/ErrorBoundary.tsx
//
// Catches render errors so the entire app doesn't whiteout when one page
// throws. Wrap pages individually for the best UX, or wrap the root layout
// once for global protection.
//
// Why a class component? React only supports getDerivedStateFromError /
// componentDidCatch on classes — there is no Hooks API for this.

'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional UI override. Receives the error and a reset callback. */
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
  /** Hook for logging — wire to your tracker (Sentry, etc.). */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Always log so the failure isn't silent in dev.
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary]', error, info);
    }
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        Something went sideways
      </h2>
      <p className="text-sm text-slate-500">
        We logged the error. You can retry, or head back to the dashboard.
      </p>
      <pre className="mt-2 max-h-32 w-full overflow-auto rounded-lg bg-slate-50 p-3 text-left text-[11px] text-slate-500">
        {error.message}
      </pre>
      <div className="mt-2 flex gap-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
