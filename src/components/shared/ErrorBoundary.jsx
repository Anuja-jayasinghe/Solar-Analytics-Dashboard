import React from 'react';

/**
 * Error Boundary Component
 * Catches errors in child components and displays fallback UI
 * Prevents entire dashboard from crashing due to single component error
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          margin: '16px 0',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c33',
        }}>
          <h3 style={{ margin: '0 0 8px 0' }}>⚠️ Something went wrong</h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.resetError}
            style={{
              padding: '8px 16px',
              backgroundColor: '#c33',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
