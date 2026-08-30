'use client';

import React from 'react';

type Props = { children: React.ReactNode; title?: string };
type State = { error: Error | null };

export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Section render failed', { error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <section role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="font-bold">{this.props.title || '这个区块暂时无法显示'}</div>
          <button type="button" className="mt-3 rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-bold" onClick={() => this.setState({ error: null })}>
            重试渲染
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
