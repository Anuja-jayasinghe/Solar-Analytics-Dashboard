import { useContext, useState } from "react";
import { ThemeContext } from "./ThemeContext";

function Navbar() {
  const { theme, setTheme } = useContext(ThemeContext);
  const [showAdminPopup, setShowAdminPopup] = useState(false);

  // Handle admin access button click
  const handleAdminAccess = () => {
    setShowAdminPopup(true);
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // Close popup
  const closePopup = () => {
    setShowAdminPopup(false);
  };

  return (
    <>
      <nav className="navbar">
        <h1 style={{ color: "var(--accent)", fontSize:"1.5rem", fontWeight: "bold" }}>SolarEdge</h1>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            onClick={toggleTheme}
            style={{
              background: "var(--hover-bg)",
              color: "var(--text-color)",
              border: "1px solid var(--border-color)",
              padding: "8px 12px",
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              transition: "all 0.3s ease",
              fontWeight: "bold"
            }}
            onMouseOver={(e) => {
              e.target.style.background = "var(--accent)";
              e.target.style.color = "#000";
            }}
            onMouseOut={(e) => {
              e.target.style.background = "var(--hover-bg)";
              e.target.style.color = "var(--text-color)";
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button
          onClick={handleAdminAccess}
          style={{
            background: "linear-gradient(45deg, #ff6b35, #f7931e)",
            color: "#fff",
            border: "none",
            padding: "8px 16px",
            borderRadius: "20px",
            cursor: "pointer",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(255, 107, 53, 0.3)",
            fontWeight: "bold",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)"
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "scale(1.05)";
            e.target.style.boxShadow = "0 6px 20px rgba(255, 107, 53, 0.4)";
            e.target.style.background = "linear-gradient(45deg, #f7931e, #ff6b35)";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "scale(1)";
            e.target.style.boxShadow = "0 4px 15px rgba(255, 107, 53, 0.3)";
            e.target.style.background = "linear-gradient(45deg, #ff6b35, #f7931e)";
          }}
          >
            🔐 Admin Access
          </button>
        </div>
      </nav>

      {/* Fun Admin Access Popup */}
      {showAdminPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            backdropFilter: "blur(10px)"
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)",
              borderRadius: "20px",
              padding: "2.5rem",
              color: "#fff",
              textAlign: "center",
              maxWidth: "500px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              border: "2px solid var(--accent)",
              animation: "popupBounce 0.5s ease-out"
            }}
          >
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🚫</div>
            <h2 style={{ 
              marginBottom: "1rem", 
              color: "var(--accent)",
              fontSize: "1.8rem",
              textShadow: "0 2px 4px rgba(0,0,0,0.5)"
            }}>
              🛡️ RESTRICTED ACCESS! 🛡️
            </h2>
            <p style={{ 
              marginBottom: "1.5rem", 
              fontSize: "1.1rem",
              lineHeight: "1.6",
              color: "#e0e0e0"
            }}>
              🎭 <strong>Nice try, sneaky one!</strong> 🎭<br/>
              This area is for <span style={{ color: "var(--accent)", fontWeight: "bold" }}>ADMIN WIZARDS</span> only!<br/>
              <br/>
              🔮 You need special admin powers to enter this mystical realm!<br/>
              💫 Contact your system administrator for the secret handshake!<br/>
              <br/>
              <em style={{ color: "#888" }}>Or maybe you're just curious... we like that! 😉</em>
            </p>
            
            {/* Hidden Admin Access - Very Subtle */}
            <div style={{ 
              marginBottom: "1.5rem",
              textAlign: "center"
            }}>
              <p style={{ 
                fontSize: "0.8rem", 
                color: "#666",
                margin: "0 0 0.3rem 0",
                fontStyle: "italic",
                opacity: 0.7
              }}>
                <em>Maybe try clicking on the lightbulb emoji above? 💡</em>
              </p>
              <span
                onClick={() => {
                  closePopup();
                  window.location.href = '/admin';
                }}
                style={{
                  color: "#666",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  textDecoration: "underline",
                  opacity: 0.5,
                  transition: "opacity 0.3s ease",
                  display: "inline-block"
                }}
                onMouseOver={(e) => {
                  e.target.style.opacity = "0.8";
                }}
                onMouseOut={(e) => {
                  e.target.style.opacity = "0.5";
                }}
              >
                <em>BoooooooooooooooHaa!...</em>
              </span>
            </div>
            <button
              onClick={closePopup}
              style={{
                background: "linear-gradient(45deg, var(--accent), #00d4aa)",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "25px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "bold",
                transition: "all 0.3s ease",
                boxShadow: "0 4px 15px rgba(0, 212, 170, 0.3)",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)"
              }}
              onMouseOver={(e) => {
                e.target.style.transform = "scale(1.05)";
                e.target.style.boxShadow = "0 6px 20px rgba(0, 212, 170, 0.4)";
              }}
              onMouseOut={(e) => {
                e.target.style.transform = "scale(1)";
                e.target.style.boxShadow = "0 4px 15px rgba(0, 212, 170, 0.3)";
              }}
            >
              🎪 Got it, thanks!
            </button>
          </div>
        </div>
      )}

      {/* Add CSS animation */}
      <style jsx>{`
        @keyframes popupBounce {
          0% {
            transform: scale(0.3) rotate(-10deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.05) rotate(2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

export default Navbar;
