import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* 404 Animation/Icon */}
        <div style={styles.iconContainer}>
          <div style={styles.icon404}>404</div>
          <div style={styles.iconSubtext}>Page Not Found</div>
        </div>

        {/* Main Message */}
        <h1 style={styles.title}>Oops! Lost in Space?</h1>
        <p style={styles.description}>
          The page you're looking for seems to have drifted off into the solar system. 
          Don't worry, even the best solar panels can't power a page that doesn't exist!
        </p>

        {/* Action Buttons */}
        <div style={styles.buttonContainer}>
          <button 
            onClick={handleGoHome}
            style={styles.primaryButton}
            onMouseOver={(e) => e.target.style.background = "#ff8c00"}
            onMouseOut={(e) => e.target.style.background = "var(--accent)"}
          >
            🏠 Go Home
          </button>
          <button 
            onClick={handleGoBack}
            style={styles.secondaryButton}
            onMouseOver={(e) => e.target.style.background = "var(--hover-bg)"}
            onMouseOut={(e) => e.target.style.background = "var(--card-bg-solid)"}
          >
            ← Go Back
          </button>
        </div>

        {/* Fun Solar Facts */}
        <div style={styles.funFact}>
          <p style={styles.funFactText}>
            💡 <strong>Solar Fact:</strong> While you're here, did you know that 
            a single solar panel can generate enough energy to power a light bulb for 3 hours?
          </p>
        </div>
      </div>

      {/* Background Decoration */}
      <div style={styles.backgroundDecoration}>
        <div style={styles.solarPanel1}>☀️</div>
        <div style={styles.solarPanel2}>⚡</div>
        <div style={styles.solarPanel3}>🔋</div>
      </div>
    </div>
  );
};

// --- STYLES ---
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-color)',
    color: 'var(--text-color)',
    fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    padding: '2rem',
  },
  content: {
    textAlign: 'center',
    maxWidth: '600px',
    zIndex: 2,
    position: 'relative',
  },
  iconContainer: {
    marginBottom: '2rem',
  },
  icon404: {
    fontSize: '8rem',
    fontWeight: '900',
    color: 'var(--accent)',
    textShadow: '0 0 30px rgba(255, 122, 0, 0.5)',
    lineHeight: 1,
    marginBottom: '0.5rem',
    background: 'linear-gradient(45deg, var(--accent), #ff8c00)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  iconSubtext: {
    fontSize: '1.2rem',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: 'var(--text-color)',
    marginBottom: '1rem',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  description: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: '2.5rem',
    maxWidth: '500px',
    margin: '0 auto 2.5rem auto',
  },
  buttonContainer: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: '3rem',
  },
  primaryButton: {
    background: 'var(--accent)',
    color: '#000',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(255, 122, 0, 0.3)',
  },
  secondaryButton: {
    background: 'var(--card-bg-solid)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  funFact: {
    background: 'var(--card-bg)',
    borderRadius: '12px',
    padding: '1.5rem',
    border: '1px solid var(--card-border)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 20px var(--card-shadow)',
  },
  funFactText: {
    margin: 0,
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  },
  backgroundDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    opacity: 0.1,
  },
  solarPanel1: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    fontSize: '3rem',
    animation: 'float 6s ease-in-out infinite',
  },
  solarPanel2: {
    position: 'absolute',
    top: '20%',
    right: '15%',
    fontSize: '2.5rem',
    animation: 'float 8s ease-in-out infinite reverse',
  },
  solarPanel3: {
    position: 'absolute',
    bottom: '15%',
    left: '20%',
    fontSize: '2rem',
    animation: 'float 7s ease-in-out infinite',
  },
};

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
`;
document.head.appendChild(style);

export default NotFound;
