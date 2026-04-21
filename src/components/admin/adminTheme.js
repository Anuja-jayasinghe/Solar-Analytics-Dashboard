export const getAdminTheme = (colorPreset) => {
  const preset = colorPreset || {
    accent: "#a855f7",
    accentDark: "#7e22ce",
    accentSoft: "rgba(168, 85, 247, 0.14)",
    accentGlow: "rgba(168, 85, 247, 0.4)",
    border: "rgba(168, 85, 247, 0.2)",
    borderStrong: "rgba(168, 85, 247, 0.36)",
    hex: "#a855f7",
    backdrop: "radial-gradient(circle at 15% 10%, rgba(168,85,247,0.12), transparent 34%), radial-gradient(circle at 85% 90%, rgba(126,34,206,0.16), transparent 42%), linear-gradient(135deg, rgba(6,13,26,0.97) 0%, rgba(10,19,38,0.97) 100%)",
    grid: "repeating-linear-gradient(0deg, rgba(168,85,247,0.08) 0, rgba(168,85,247,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(168,85,247,0.05) 0, rgba(168,85,247,0.05) 1px, transparent 1px, transparent 28px)"
  };

  return {
    colors: {
      background: "#060d1a",
      backgroundAlt: "#0a1326",
      surface: "rgba(10, 21, 42, 0.96)",
      surfaceAlt: "rgba(13, 27, 52, 0.96)",
      panel: "rgba(11, 23, 46, 0.92)",
      border: preset.border,
      borderStrong: preset.borderStrong,
      text: "#f3f8ff",
      textMuted: "rgba(222, 236, 255, 0.72)",
      accent: preset.accent,
      accentDark: preset.accentDark,
      accentSoft: preset.accentSoft,
      accentGlow: preset.accentGlow,
      success: "#28c840",
      warning: "#febc2e",
      danger: "#ff5f57"
    },
    gradients: {
      backdrop: preset.backdrop,
      surface: "linear-gradient(180deg, rgba(10, 21, 42, 0.98), rgba(6, 13, 26, 0.98))",
      surfaceAlt: "linear-gradient(180deg, rgba(13, 27, 52, 0.98), rgba(8, 16, 32, 0.98))",
      accent: `linear-gradient(180deg, ${preset.accentSoft}, ${preset.accentDark}20)`,
      accentSoft: `linear-gradient(135deg, ${preset.accentSoft}, ${preset.accent}06)`,
      grid: preset.grid
    },
    shadows: {
      panel: `0 16px 48px rgba(0,0,0,0.75), 0 0 0 1px ${preset.borderStrong}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      button: `0 2px 8px ${preset.accentGlow}`,
      buttonHover: `0 4px 12px ${preset.accentGlow}`,
      glow: `0 0 16px ${preset.accentGlow}`
    },
    fonts: {
      ui: "Inter, system-ui, sans-serif",
      mono: "Consolas, 'Courier New', monospace"
    }
  };
};

// Default blue theme
export const adminTheme = getAdminTheme();

// Static styles refactored into a function to allow dynamic themes
// Static styles refactored into a function to allow dynamic themes
export const getAdminShellStyles = (theme) => ({
  page: {
    minHeight: "100vh",
    background: theme.gradients.backdrop,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
    position: "relative",
    overflow: "hidden"
  },
  scanline: {
    content: '""',
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02))",
    backgroundSize: "100% 3px, 3px 100%",
    pointerEvents: "none",
    opacity: 0.45
  },
  header: {
    padding: "1.5rem 2rem",
    borderBottom: `2px solid ${theme.colors.borderStrong}`,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(12px)",
    position: "relative",
    overflow: "hidden"
  },
  pageFrame: {
    maxWidth: "1400px",
    margin: "0 auto"
  },
  pageTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: theme.colors.accent,
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontFamily: theme.fonts.mono,
    textShadow: `0 0 8px ${theme.colors.accent}40`
  },
  sectionLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: "9px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: theme.colors.accent,
    opacity: 0.6
  },
  panel: {
    background: "rgba(6, 13, 26, 0.8)",
    border: `1px solid ${theme.colors.border}`,
    borderRadius: "2px",
    boxShadow: `0 20px 50px rgba(0,0,0,0.8), inset 0 0 20px ${theme.colors.accent}05`,
    backdropFilter: "blur(20px)",
    position: "relative"
  },
  pillButton: {
    background: "transparent",
    color: theme.colors.text,
    border: `1px solid ${theme.colors.accent}80`,
    borderRadius: "1px",
    padding: "6px 14px",
    cursor: "pointer",
    fontWeight: 600,
    fontFamily: theme.fonts.mono,
    fontSize: "11px",
    transition: "all 0.15s ease",
    textTransform: "uppercase",
    letterSpacing: "1px"
  },
  tabCard: {
    background: "rgba(0, 0, 0, 0.4)",
    color: theme.colors.textMuted,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: "2px",
    padding: "1rem 1.25rem",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    position: "relative",
    overflow: "hidden"
  },
  tabCardActive: {
    background: "rgba(255,255,255,0.02)",
    borderLeft: `2px solid ${theme.colors.accent}`,
    color: theme.colors.text,
    boxShadow: `inset 2px 0 15px ${theme.colors.accent}15`
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    fontFamily: theme.fonts.mono,
    fontSize: "9px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    borderRadius: "1px",
    padding: "0.25rem 0.5rem",
    border: `1px solid ${theme.colors.accent}40`,
    color: theme.colors.accent,
    background: "rgba(0,0,0,0.4)",
    fontWeight: 600
  }
});
