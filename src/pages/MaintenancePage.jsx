import React from 'react';

const MaintenancePage = () => {
  // Generate 50 stars for the background
  const stars = [];
  for (let i = 0; i < 50; i++) {
    stars.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          width: '2px',
          height: '2px',
          background: 'white',
          borderRadius: '50%',
          animation: 'twinkle 3s infinite',
          boxShadow: '0 0 3px rgba(255,255,255,0.8)',
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${2 + Math.random() * 2}s`,
        }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <style>{keyframesCSS}</style>
      
      {/* Animated stars background */}
      <div style={styles.starsContainer}>
        {stars}
      </div>

      {/* Floating planets (using your theme's colors) */}
      <div style={{...styles.planet, ...styles.planet1}} />
      <div style={{...styles.planet, ...styles.planet2}} />
      
      <div style={styles.card}>
        {/* Astronaut and Rocket Illustration */}
        <div style={styles.illustrationContainer}>
          {/* Tool belt on ground */}
          <div style={styles.toolBelt}>
            <div style={styles.toolBox} />
            <div style={styles.tool1} />
            <div style={styles.tool2} />
          </div>
          <div style={styles.rocket}>
            <div style={styles.rocketBody}>
              <div style={styles.rocketStripe1} />
              <div style={styles.rocketStripe2} />
            </div>
            <div style={styles.rocketFinLeft}></div>
            <div style={styles.rocketFinRight}></div>
            <div style={styles.rocketWindow}></div>
            
            {/* Engine Failure Effect (Themed) */}
            <div style={styles.engineFailure}>
              <div style={styles.fireBurst}></div>
              <div style={styles.smokePuff} />
              <div style={{...styles.smokePuff, left: '20%', animationDelay: '0.3s'}} />
              <div style={{...styles.smokePuff, left: '60%', animationDelay: '0.6s'}} />
              
              {/* Sparks (Themed) */}
              <div style={styles.spark1} />
              <div style={styles.spark2} />
              <div style={styles.spark3} />
            </div>
          </div>
          {/* Astronaut */}
          <div style={styles.astronaut}>
            <div style={styles.helmet}>
              <div style={styles.visor} />
              <div style={styles.reflection} />
            </div>
            <div style={styles.suitBody}>
              <div style={styles.badge} />
            </div>
            <div style={styles.armLeft}></div>
            <div style={styles.armRight}>
              <div style={styles.wrench} />
            </div>
            <div style={styles.legLeft}></div>
            <div style={styles.legRight}></div>
          </div>
          {/* Floating tools around */}
          <div style={styles.floatingTool1}>🔧</div>
          <div style={styles.floatingTool2}>⚙️</div>
        </div>
        
        <h1 style={styles.title}>
          <span style={styles.titleGradient}>System Under Maintenance</span>
        </h1>
        
        <div style={styles.statusBadge}>
          <div style={styles.statusDot} />
          <span>Repairs in Progress</span>
        </div>
        
        <p style={styles.text}>
          Our dashboard is getting a tune-up to improve data accuracy and performance.
          We'll be back online shortly. Thank you for your patience.
        </p>
        
        <p style={styles.subtitle}>
          ✨ Expected launch time: <strong style={styles.highlight}>Soon™</strong>
        </p>
        {/* Progress bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={styles.progressFill} />
          </div>
          <span style={styles.progressText}>Recalibrating solar matrix...</span>
        </div>
      </div>
    </div>
  );
};

// --- STYLES (Themed to your dashboard) ---
const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100vw',
    background: 'linear-gradient(145deg, #141416, #0c0c0e)',
    color: '#a0aec0',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    overflow: 'hidden',
    position: 'relative',
  },
  starsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  planet: {
    position: 'absolute',
    borderRadius: '50%',
    opacity: 0.6,
  },
  planet1: {
    width: '120px',
    height: '120px',
    background: 'radial-gradient(circle at 30% 30%, #00eaff, #00b8d4)',
    top: '10%',
    left: '5%',
    animation: 'float 20s infinite ease-in-out',
    boxShadow: '0 0 40px rgba(0,234,255,0.3)',
  },
  planet2: {
    width: '80px',
    height: '80px',
    background: 'radial-gradient(circle at 30% 30%, #ffcc00, #ff7a00)',
    bottom: '15%',
    right: '8%',
    animation: 'float 15s infinite ease-in-out reverse',
    boxShadow: '0 0 30px rgba(255,204,0,0.3)',
  },
  card: {
    background: 'linear-gradient(145deg, rgba(20,20,22,0.8), rgba(12,12,14,0.85))',
    borderRadius: '32px',
    padding: '3rem',
    backdropFilter: 'blur(20px)',
    border: '2px solid rgba(0,234,255,0.2)',
    boxShadow: '0 20px 60px rgba(0,234,255,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
    textAlign: 'center',
    maxWidth: '550px',
    zIndex: 10,
    position: 'relative',
    animation: 'cardGlow 3s infinite ease-in-out',
  },
  title: {
    fontWeight: 'bold',
    fontSize: '2rem',
    margin: '2rem 0 1rem 0',
    letterSpacing: '0.5px',
  },
  titleGradient: {
    background: 'linear-gradient(135deg, #00eaff 0%, #00d4e8 50%, #00b8d4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'gradientShift 3s ease infinite',
    backgroundSize: '200% auto',
    textShadow: 'none',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,122,0,0.1)',
    border: '1px solid rgba(255,122,0,0.3)',
    borderRadius: '20px',
    padding: '6px 16px',
    fontSize: '0.85rem',
    color: '#ff7a00',
    marginBottom: '1.5rem',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#ff7a00',
    animation: 'pulse 2s infinite',
    boxShadow: '0 0 10px #ff7a00',
  },
  text: {
    fontSize: '1.05rem',
    lineHeight: 1.7,
    margin: '1rem 0',
    color: '#a0aec0',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#a0aec0',
    marginTop: '1.5rem',
  },
  highlight: {
    color: '#00eaff',
    textShadow: '0 0 10px rgba(0,234,255,0.5)',
  },
  progressContainer: {
    marginTop: '2rem',
    marginBottom: '1.5rem',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    background: 'linear-gradient(90deg, #ffcc00, #ff7a00, #ffcc00)',
    backgroundSize: '200% 100%',
    animation: 'progressSlide 2s linear infinite',
    borderRadius: '10px',
    boxShadow: '0 0 10px rgba(255,204,0,0.5)',
  },
  progressText: {
    fontSize: '0.85rem',
    color: '#a0aec0',
    marginTop: '8px',
    display: 'block',
  },
  illustrationContainer: {
    position: 'relative',
    width: '220px',
    height: '170px',
    margin: '0 auto',
  },
  toolBelt: {
    position: 'absolute',
    bottom: '0',
    left: '10px',
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
  toolBox: {
    width: '30px',
    height: '20px',
    background: 'linear-gradient(to bottom, #c53030, #742a2a)', // Switched to a darker red
    borderRadius: '4px',
    border: '2px solid #4a2a2a',
    position: 'relative',
  },
  tool1: {
    width: '4px',
    height: '18px',
    background: '#a0aec0',
    borderRadius: '2px',
    animation: 'wiggle 1s infinite',
  },
  tool2: {
    width: '4px',
    height: '15px',
    background: '#718096',
    borderRadius: '2px',
    animation: 'wiggle 1.2s infinite',
    animationDelay: '0.3s',
  },
  floatingTool1: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    fontSize: '1.5rem',
    animation: 'floatTool 4s infinite ease-in-out',
    filter: 'drop-shadow(0 0 5px rgba(0,234,255,0.5))',
  },
  floatingTool2: {
    position: 'absolute',
    top: '30px',
    right: '10px',
    fontSize: '1.3rem',
    animation: 'floatTool 3.5s infinite ease-in-out reverse',
    filter: 'drop-shadow(0 0 5px rgba(255,122,0,0.5))',
  },
  rocket: {
    position: 'absolute',
    bottom: '5px',
    left: '50%',
    transform: 'translateX(-50%) rotate(15deg)',
    width: '70px',
    height: '130px',
    opacity: 0.95,
    animation: 'shake 0.4s infinite linear',
    filter: 'drop-shadow(0 0 10px rgba(0,234,255,0.2))',
  },
  rocketBody: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to top, #e0e0e0, #ffffff, #e0e0e0)',
    borderRadius: '50% 50% 10px 10px / 60% 60% 10px 10px',
    border: '3px solid #a0aec0',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)',
  },
  rocketStripe1: { // Theme Color
    position: 'absolute',
    width: '100%',
    height: '8px',
    background: '#00eaff',
    top: '40%',
    boxShadow: '0 0 10px rgba(0,234,255,0.5)',
  },
  rocketStripe2: { // Theme Color
    position: 'absolute',
    width: '100%',
    height: '8px',
    background: '#ff7a00',
    top: '52%',
    boxShadow: '0 0 10px rgba(255,122,0,0.5)',
  },
  rocketFinLeft: { // Alert Color
    position: 'absolute',
    bottom: '0',
    left: '-22px',
    width: '0',
    height: '0',
    borderLeft: '22px solid transparent',
    borderRight: '22px solid #f56565',
    borderBottom: '45px solid #f56565',
    borderTop: '5px solid transparent',
    transform: 'skewY(-20deg)',
    zIndex: -1,
  },
  rocketFinRight: { // Alert Color
    position: 'absolute',
    bottom: '0',
    right: '-22px',
    width: '0',
    height: '0',
    borderLeft: '22px solid #f56565',
    borderRight: '22px solid transparent',
    borderBottom: '45px solid #f56565',
    borderTop: '5px solid transparent',
    transform: 'skewY(20deg)',
    zIndex: -1,
  },
  rocketWindow: { // Theme Color
    position: 'absolute',
    top: '25px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '28px',
    height: '28px',
    background: 'radial-gradient(circle at 30% 30%, #a3d5ff, #00eaff)',
    borderRadius: '50%',
    border: '3px solid #4a5568',
    boxShadow: 'inset 0 0 8px rgba(0,0,0,0.3), 0 0 15px rgba(0,234,255,0.5)',
  },
  engineFailure: {
    position: 'absolute',
    bottom: '-18px',
    left: '50%',
    width: '50px',
    height: '50px',
    transform: 'translateX(-50%)',
    filter: 'blur(0.5px)',
  },
  fireBurst: { // Theme Color
    position: 'absolute',
    bottom: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '28px',
    height: '14px',
    background: 'linear-gradient(to top, #ff7a00, #ffcc00, #fff)',
    borderRadius: '70% 70% 0 0',
    animation: 'burst 0.8s ease-out infinite',
    boxShadow: '0 0 20px rgba(255,122,0,0.8)',
  },
  smokePuff: {
    position: 'absolute',
    bottom: '0',
    left: '50%',
    width: '18px',
    height: '18px',
    background: 'rgba(80, 80, 80, 0.7)',
    borderRadius: '50%',
    filter: 'blur(5px)',
    animation: 'smokePuff 1.4s ease-out infinite',
  },
  spark1: { // Theme Color
    position: 'absolute',
    bottom: '5px',
    left: '30%',
    width: '3px',
    height: '3px',
    background: '#ff7a00',
    borderRadius: '50%',
    animation: 'sparkFly 0.6s infinite',
    boxShadow: '0 0 5px #ff7a00',
  },
  spark2: { // Theme Color
    position: 'absolute',
    bottom: '5px',
    left: '50%',
    width: '3px',
    height: '3px', // <-- TYPO FIX
    background: '#ffcc00',
    borderRadius: '50%',
    animation: 'sparkFly 0.8s infinite',
    animationDelay: '0.2s',
    boxShadow: '0 0 5px #ffcc00',
  },
  spark3: { // Theme Color
    position: 'absolute',
    bottom: '5px',
    right: '30%',
    width: '3px',
    height: '3px',
    background: '#ff7a00',
    borderRadius: '50%',
    animation: 'sparkFly 0.7s infinite',
    animationDelay: '0.4s',
    boxShadow: '0 0 5px #ff7a00',
  },
  astronaut: {
    position: 'absolute',
    bottom: '5px',
    right: '25px',
    width: '50px',
    height: '70px',
    zIndex: 1,
    animation: 'bob 2.5s ease-in-out infinite alternate',
  },
  helmet: {
    width: '36px',
    height: '36px',
    background: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
    borderRadius: '50%',
    border: '3px solid #4a5568',
    position: 'relative',
    margin: '0 auto',
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2), 0 0 15px rgba(0,234,255,0.2)',
  },
  visor: { // Theme Color
    position: 'absolute',
    width: '22px',
    height: '12px',
    background: 'linear-gradient(to right, #00eaff, #00b8d4)',
    borderRadius: '6px',
    top: '10px',
    left: '7px',
    border: '2px solid #2d3748',
    boxShadow: 'inset 0 0 5px rgba(0,234,255,0.5)',
  },
  reflection: {
    position: 'absolute',
    width: '8px',
    height: '8px',
    background: 'rgba(255,255,255,0.6)',
    borderRadius: '50%',
    top: '8px',
    left: '10px',
  },
  suitBody: {
    width: '40px',
    height: '45px',
    background: 'linear-gradient(to bottom, #fafafa, #e0e0e0)',
    borderRadius: '18px 18px 8px 8px',
    border: '3px solid #4a5568',
    margin: '0 auto',
    marginTop: '-8px',
    position: 'relative',
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
  },
  badge: { // Theme Color
    position: 'absolute',
    width: '16px',
    height: '16px',
    background: 'linear-gradient(135deg, #ffcc00, #ff7a00)',
    borderRadius: '50%',
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    border: '2px solid #c05621',
    boxShadow: '0 0 10px rgba(255,204,0,0.6)',
  },
  armLeft: {
    position: 'absolute',
    width: '10px',
    height: '28px',
    background: 'linear-gradient(to bottom, #e0e0e0, #cbd5e0)',
    borderRadius: '5px',
    transform: 'rotate(20deg)',
    left: '-10px',
    top: '35px',
    border: '2px solid #4a5568',
  },
  armRight: {
    position: 'absolute',
    width: '10px',
    height: '32px',
    background: 'linear-gradient(to bottom, #e0e0e0, #cbd5e0)',
    borderRadius: '5px',
    transform: 'rotate(-35deg)',
    right: '-10px',
    top: '33px',
    border: '2px solid #4a5568',
  },
  wrench: {
    position: 'absolute',
    width: '18px',
    height: '6px',
    background: 'linear-gradient(to right, #a0aec0, #718096)',
    borderRadius: '3px',
    transform: 'rotate(40deg)',
    bottom: '-8px',
    right: '-8px',
    animation: 'tinker 0.3s infinite alternate',
    transformOrigin: 'top right',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3), 0 0 5px rgba(0,234,255,0.3)',
  },
  legLeft: {
    position: 'absolute',
    width: '12px',
    height: '22px',
    background: 'linear-gradient(to bottom, #e0e0e0, #cbd5e0)',
    borderRadius: '6px',
    transform: 'rotate(-5deg)',
    left: '8px',
    bottom: '-18px',
    border: '2px solid #4a5568',
  },
  legRight: {
    position: 'absolute',
    width: '12px',
    height: '22px',
    background: 'linear-gradient(to bottom, #e0e0e0, #cbd5e0)',
    borderRadius: '6px',
    transform: 'rotate(5deg)',
    right: '8px',
    bottom: '-18px',
    border: '2px solid #4a5568',
  },
};

const keyframesCSS = `
@keyframes twinkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(0.8); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px) translateX(0px); }
  50% { transform: translateY(-20px) translateX(10px); }
}
@keyframes cardGlow {
  0%, 100% { box-shadow: 0 20px 60px rgba(0,234,255,0.2), inset 0 1px 0 rgba(255,255,255,0.05); }
  50% { box-shadow: 0 20px 70px rgba(0,234,255,0.3), inset 0 1px 0 rgba(255,255,255,0.08); }
}
@keyframes gradientShift {
  0% { background-position: 0% center; }
  50% { background-position: 100% center; }
  100% { background-position: 0% center; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}
@keyframes progressSlide {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
@keyframes bob {
  0% { transform: translateY(0px); }
  100% { transform: translateY(-8px); }
}
@keyframes shake {
  0% { transform: translateX(-50%) rotate(15deg) translate(0px, 0px); }
  25% { transform: translateX(-48%) rotate(18deg) translate(2px, -1px); }
  50% { transform: translateX(-52%) rotate(12deg) translate(-2px, 1px); }
  75% { transform: translateX(-50%) rotate(17deg) translate(1px, -1Fpx); }
  100% { transform: translateX(-50%) rotate(15deg) translate(0px, 0px); }
}
@keyframes tinker {
  0% { transform: rotate(40deg); }
  100% { transform: rotate(20deg); }
}
@keyframes burst {
  0% { transform: translateX(-50%) scale(0.9); opacity: 0.8; }
  50% { transform: translateX(-50%) scale(2); opacity: 1; }
  100% { transform: translateX(-50%) scale(0.9) translateY(-8px); opacity: 0; }
}
@keyframes smokePuff {
  0% { transform: scale(0.5) translateY(0); opacity: 0; }
  20% { opacity: 0.8; }
  100% { transform: scale(3.5) translateY(-40px); opacity: 0; }
}
@keyframes sparkFly {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(0px, -25px) scale(0); opacity: 0; }
}
@keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(5deg); }
  75% { transform: rotate(-5deg); }
}
@keyframes floatTool {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(15deg); }
}`;

export default MaintenancePage;