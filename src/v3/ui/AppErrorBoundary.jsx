import { Component } from 'react';

/**
 * Last line of defence: a page that throws while rendering must not leave a blank screen. Shows a plain
 * message and a reload button. Errors are reported to the console (console.error is kept in production
 * builds on purpose, so they can be seen in the browser and in any error collector).
 */
export class AppErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Render error', error?.message, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg, #0A0F1F)', color: 'var(--ink, #EEF1F8)', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ margin: '0 0 18px', opacity: 0.8, lineHeight: 1.5 }}>This page hit an error. Your data is safe; nothing was changed. Reloading usually fixes it.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ height: 40, padding: '0 20px', borderRadius: 999, border: 0, background: '#FF8A1F', color: '#241000', fontWeight: 700, cursor: 'pointer' }}>Reload</button>
        </div>
      </div>
    );
  }
}
