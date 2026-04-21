export const adminTheme = {
  colors: {
    background: "#060d1a",
    backgroundAlt: "#0a1326",
    surface: "rgba(10, 21, 42, 0.96)",
    surfaceAlt: "rgba(13, 27, 52, 0.96)",
    panel: "rgba(11, 23, 46, 0.92)",
    border: "rgba(96, 165, 250, 0.2)",
    borderStrong: "rgba(96, 165, 250, 0.36)",
    text: "#f3f8ff",
    textMuted: "rgba(222, 236, 255, 0.72)",
    accent: "#3b82f6",
    accentDark: "#1d4ed8",
    accentSoft: "rgba(59, 130, 246, 0.14)",
    accentGlow: "rgba(59, 130, 246, 0.4)",
    success: "#28c840",
    warning: "#febc2e",
    danger: "#ff5f57"
  },
  gradients: {
    backdrop: "radial-gradient(circle at 15% 10%, rgba(59,130,246,0.12), transparent 34%), radial-gradient(circle at 85% 90%, rgba(29,78,216,0.16), transparent 42%), linear-gradient(135deg, rgba(6,13,26,0.97) 0%, rgba(10,19,38,0.97) 100%)",
    surface: "linear-gradient(180deg, rgba(10, 21, 42, 0.98), rgba(6, 13, 26, 0.98))",
    surfaceAlt: "linear-gradient(180deg, rgba(13, 27, 52, 0.98), rgba(8, 16, 32, 0.98))",
    accent: "linear-gradient(180deg, rgba(59,130,246,0.34), rgba(29,78,216,0.24))",
    accentSoft: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(59,130,246,0.06))",
    grid: "repeating-linear-gradient(0deg, rgba(96,165,250,0.08) 0, rgba(96,165,250,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(96,165,250,0.05) 0, rgba(96,165,250,0.05) 1px, transparent 1px, transparent 28px)"
  },
  shadows: {
    panel: "0 16px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(96,165,250,0.24), inset 0 1px 0 rgba(255,255,255,0.06)",
    button: "0 2px 8px rgba(59, 130, 246, 0.45)",
    buttonHover: "0 4px 12px rgba(59, 130, 246, 0.45)",
    glow: "0 0 16px rgba(59,130,246,0.62)"
  },
  fonts: {
    ui: "Inter, system-ui, sans-serif",
    mono: "Consolas, 'Courier New', monospace"
  }
};

export const adminShellStyles = {
  page: {
    minHeight: "100vh",
    background: adminTheme.gradients.backdrop,
    color: adminTheme.colors.text
  },
  header: {
    padding: "2rem",
    borderBottom: `1px solid ${adminTheme.colors.border}`,
    background: "rgba(0,0,0,0.3)",
    backdropFilter: "blur(10px)"
  },
  pageFrame: {
    maxWidth: "1400px",
    margin: "0 auto"
  },
  pageTitle: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 800,
    color: adminTheme.colors.accent,
    letterSpacing: "-0.5px"
  },
  sectionLabel: {
    fontFamily: adminTheme.fonts.mono,
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase"
  },
  panel: {
    background: adminTheme.gradients.surface,
    border: `1px solid ${adminTheme.colors.border}`,
    borderRadius: "14px",
    boxShadow: adminTheme.shadows.panel,
    backdropFilter: "blur(10px)"
  },
  pillButton: {
    background: adminTheme.gradients.accent,
    color: adminTheme.colors.text,
    border: `1px solid ${adminTheme.colors.borderStrong}`,
    boxShadow: adminTheme.shadows.button,
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: 700,
    transition: "all 0.2s ease"
  },
  tabCard: {
    background: "rgba(16, 30, 58, 0.72)",
    color: adminTheme.colors.text,
    border: `1px solid ${adminTheme.colors.border}`,
    borderRadius: "14px",
    padding: "1.35rem",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s ease"
  },
  tabCardActive: {
    background: "rgba(59, 130, 246, 0.2)",
    border: `1px solid ${adminTheme.colors.borderStrong}`,
    boxShadow: adminTheme.shadows.glow
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    fontFamily: adminTheme.fonts.mono,
    fontSize: "11px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderRadius: "999px",
    padding: "0.45rem 0.75rem",
    border: `1px solid ${adminTheme.colors.border}`,
    color: adminTheme.colors.textMuted,
    background: "rgba(255,255,255,0.03)"
  }
};
