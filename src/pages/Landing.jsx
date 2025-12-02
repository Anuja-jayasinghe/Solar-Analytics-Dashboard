import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, BarChart3, Leaf, Github, Linkedin, Globe } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Zap />,
      title: 'Real-Time Monitoring',
      description: 'Track solar power generation live with automated data refresh'
    },
    {
      icon: <TrendingUp />,
      title: 'Earnings Analysis',
      description: 'Compare actual vs potential earnings with detailed breakdowns'
    },
    {
      icon: <BarChart3 />,
      title: 'Interactive Charts',
      description: 'Visualize daily, monthly, and billing period trends'
    },
    {
      icon: <Leaf />,
      title: 'Environmental Impact',
      description: 'Track CO₂ savings and equivalent trees planted'
    }
  ];

  return (
    <div style={styles.container}>
      {/* Animated background */}
      <div style={styles.backgroundGradient} />
      
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <Zap style={styles.logoIcon} />
          <span style={styles.logoText}>Solar Analytics</span>
        </div>
        <div style={styles.headerLinks}>
          <button 
            onClick={() => navigate('/dashboard')}
            style={styles.headerButton}
          >
            Dashboard
          </button>
          <button 
            onClick={() => navigate('/demodashbaard')}
            style={styles.headerButtonOutline}
          >
            Try Demo
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>
            Personal Solar Analytics
            <span style={styles.heroTitleAccent}> Dashboard</span>
          </h1>
          <p style={styles.heroSubtitle}>
            A personal project built to solve a real problem: tracking my solar panel performance, earnings, and environmental impact—without the spreadsheet chaos.
          </p>
          <div style={styles.heroCTA}>
            <button 
              onClick={() => navigate('/dashboard')}
              style={styles.primaryButton}
            >
              View Dashboard
            </button>
            <button 
              onClick={() => navigate('/demodashbaard')}
              style={styles.secondaryButton}
            >
              Explore Demo
            </button>
          </div>
        </div>
        
        {/* Hero Visual - Animated Chart Mockup */}
        <div style={styles.heroVisual}>
          <div style={styles.mockupCard}>
            <div style={styles.mockupHeader}>
              <div style={styles.mockupDot} />
              <div style={{ ...styles.mockupDot, background: 'var(--accent)' }} />
              <div style={{ ...styles.mockupDot, background: '#4CAF50' }} />
            </div>
            <div style={styles.mockupContent}>
              <div style={styles.mockupStat}>
                <div style={styles.mockupStatLabel}>Today's Generation</div>
                <div style={styles.mockupStatValue}>
                  <Zap style={{ width: 20, height: 20, color: 'var(--accent)' }} />
                  24.5 kWh
                </div>
              </div>
              <div style={styles.mockupChart}>
                {[40, 65, 45, 80, 70, 90, 75, 85, 60, 70].map((height, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      ...styles.mockupBar, 
                      height: `${height}%`,
                      animationDelay: `${i * 0.1}s`
                    }} 
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section style={styles.features}>
        <h2 style={styles.sectionTitle}>Why I Built This</h2>
        <p style={styles.sectionSubtitle}>
          Started as a weekend project to monitor my home solar system. Ended up building a full analytics platform.
        </p>
        <div style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <div 
              key={index} 
              style={styles.featureCard}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,255,240,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
              }}
            >
              <div style={styles.featureIcon}>
                {feature.icon}
              </div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section style={styles.techSection}>
        <h2 style={styles.sectionTitle}>Built With</h2>
        <div style={styles.techGrid}>
          {['React 19', 'Vite', 'Supabase', 'Recharts', 'Vercel'].map((tech, i) => (
            <div key={i} style={styles.techBadge}>
              {tech}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaContent}>
          <h2 style={styles.ctaTitle}>Ready to Explore?</h2>
          <p style={styles.ctaSubtitle}>
            Check out the live dashboard or try the demo version
          </p>
          <button 
            onClick={() => navigate('/dashboard')}
            style={styles.ctaButton}
          >
            Get Started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>
          Built with 💖 by <strong>Anuja Jayasinghe</strong> • A Personal Project
        </p>
        <div style={styles.footerLinks}>
          <a 
            href="https://anujajay.com"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            <Globe style={{ width: 20, height: 20 }} />
            <span>Website</span>
          </a>
          <a 
            href="https://github.com/Anuja-jayasinghe/Solar-Analytics-Dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            <Github style={{ width: 20, height: 20 }} />
            <span>GitHub</span>
          </a>
          <a 
            href="http://linkedin.com/in/anujajayasinghe"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            <Linkedin style={{ width: 20, height: 20 }} />
            <span>LinkedIn</span>
          </a>
        </div>
      </footer>

      <style>{keyframes}</style>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-color)',
    color: 'var(--text-color)',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundGradient: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 20% 30%, rgba(0,255,240,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,122,0,0.1) 0%, transparent 50%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 5%',
    position: 'sticky',
    top: 0,
    background: 'rgba(13, 13, 13, 0.8)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    zIndex: 100,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: 'var(--accent)',
  },
  logoIcon: {
    width: 32,
    height: 32,
  },
  logoText: {
    background: 'linear-gradient(135deg, var(--accent) 0%, #00c2a8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  headerButton: {
    padding: '0.5rem 1.25rem',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  headerButtonOutline: {
    padding: '0.5rem 1.25rem',
    background: 'transparent',
    border: '1.5px solid var(--accent)',
    borderRadius: '8px',
    color: 'var(--accent)',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  headerLinks: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4rem',
    padding: '6rem 5%',
    alignItems: 'center',
    maxWidth: '1400px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  heroContent: {
    maxWidth: '600px',
  },
  heroTitle: {
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: '800',
    lineHeight: '1.1',
    marginBottom: '1.5rem',
    color: 'var(--text-color)',
  },
  heroTitleAccent: {
    background: 'linear-gradient(135deg, var(--accent) 0%, #00c2a8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSubtitle: {
    fontSize: '1.25rem',
    lineHeight: '1.6',
    color: 'var(--text-secondary)',
    marginBottom: '2.5rem',
  },
  heroCTA: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  primaryButton: {
    padding: '1rem 2.5rem',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1.125rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(255,122,0,0.3)',
  },
  secondaryButton: {
    padding: '1rem 2rem',
    background: 'transparent',
    border: '2px solid var(--glass-border)',
    borderRadius: '12px',
    color: 'var(--text-color)',
    fontSize: '1.125rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
  },
  heroVisual: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockupCard: {
    background: 'rgba(20,20,22,0.8)',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    width: '100%',
    maxWidth: '400px',
  },
  mockupHeader: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  mockupDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: 'var(--text-secondary)',
  },
  mockupContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  mockupStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  mockupStatLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  mockupStatValue: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: 'var(--text-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  mockupChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.5rem',
    height: '120px',
    padding: '1rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
  },
  mockupBar: {
    flex: 1,
    background: 'linear-gradient(to top, var(--accent), #00c2a8)',
    borderRadius: '4px 4px 0 0',
    animation: 'barGrow 0.6s ease-out forwards',
    transformOrigin: 'bottom',
  },
  features: {
    padding: '6rem 5%',
    maxWidth: '1400px',
    margin: '0 auto',
    position: 'relative',
    zIndex: 1,
  },
  sectionTitle: {
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: '1rem',
    color: 'var(--text-color)',
  },
  sectionSubtitle: {
    fontSize: '1.125rem',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    marginBottom: '4rem',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '2rem',
  },
  featureCard: {
    background: 'rgba(20,20,22,0.6)',
    padding: '2rem',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'all 0.3s ease',
    cursor: 'default',
  },
  featureIcon: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, var(--accent) 0%, #00c2a8 100%)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem',
    color: '#fff',
  },
  featureTitle: {
    fontSize: '1.5rem',
    fontWeight: '600',
    marginBottom: '0.75rem',
    color: 'var(--text-color)',
  },
  featureDescription: {
    fontSize: '1rem',
    lineHeight: '1.6',
    color: 'var(--text-secondary)',
  },
  techSection: {
    padding: '4rem 5%',
    background: 'rgba(0,0,0,0.2)',
    position: 'relative',
    zIndex: 1,
  },
  techGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '1rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  techBadge: {
    padding: '0.75rem 1.5rem',
    background: 'rgba(255,122,0,0.1)',
    border: '1px solid var(--accent)',
    borderRadius: '8px',
    color: 'var(--accent)',
    fontSize: '1rem',
    fontWeight: '600',
  },
  ctaSection: {
    padding: '6rem 5%',
    position: 'relative',
    zIndex: 1,
  },
  ctaContent: {
    maxWidth: '700px',
    margin: '0 auto',
    textAlign: 'center',
    background: 'linear-gradient(135deg, rgba(255,122,0,0.1) 0%, rgba(0,194,168,0.1) 100%)',
    padding: '4rem 2rem',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  ctaTitle: {
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: '700',
    marginBottom: '1rem',
    color: 'var(--text-color)',
  },
  ctaSubtitle: {
    fontSize: '1.25rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
  },
  ctaButton: {
    padding: '1.25rem 3rem',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '1.25rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 20px rgba(255,122,0,0.3)',
  },
  footer: {
    padding: '3rem 5%',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
    position: 'relative',
    zIndex: 1,
  },
  footerText: {
    color: 'var(--text-secondary)',
    fontSize: '1rem',
  },
  footerLinks: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  footerLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '0.95rem',
    transition: 'color 0.3s ease',
    cursor: 'pointer',
  },
};

const keyframes = `
  @keyframes barGrow {
    from {
      transform: scaleY(0);
    }
    to {
      transform: scaleY(1);
    }
  }

  @media (max-width: 968px) {
    .hero {
      grid-template-columns: 1fr !important;
      gap: 3rem !important;
      padding: 4rem 5% !important;
    }
    
    .heroVisual {
      order: -1;
    }
  }

  @media (hover: hover) {
    .primaryButton:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(255,122,0,0.4);
    }
    
    .secondaryButton:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    
    .headerButton:hover {
      background: var(--accent);
      color: #fff;
    }
    
    .ctaButton:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(255,122,0,0.4);
    }
    
    .footerLink:hover {
      color: var(--accent);
    }
  }
`;

export default Landing;
