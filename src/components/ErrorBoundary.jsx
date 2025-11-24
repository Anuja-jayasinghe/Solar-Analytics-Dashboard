import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.icon}>⚠️</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.message}>
              The application encountered an error. Please refresh the page.
            </p>
            {this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details</summary>
                <pre style={styles.errorText}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button 
              onClick={() => window.location.reload()} 
              style={styles.button}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg-color)',
    padding: '2rem',
  },
  content: {
    textAlign: 'center',
    maxWidth: '600px',
    background: 'var(--card-bg)',
    padding: '3rem',
    borderRadius: '16px',
    border: '1px solid var(--card-border)',
    boxShadow: '0 8px 32px var(--card-shadow)',
  },
  icon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: 'var(--accent)',
    marginBottom: '1rem',
  },
  message: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    lineHeight: '1.6',
  },
  details: {
    textAlign: 'left',
    marginBottom: '2rem',
    background: 'rgba(0,0,0,0.2)',
    padding: '1rem',
    borderRadius: '8px',
  },
  summary: {
    cursor: 'pointer',
    fontWeight: 'bold',
    color: 'var(--accent)',
    marginBottom: '0.5rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    overflow: 'auto',
    maxHeight: '200px',
  },
  button: {
    padding: '0.75rem 2rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
  },
};

export default ErrorBoundary;
