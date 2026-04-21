import React, { createContext, useState, useEffect } from "react";

export const AdminThemeContext = createContext();

// Color theme presets
export const adminColorPresets = {
  blue: {
    name: "Blue",
    accent: "#3b82f6",
    accentDark: "#1d4ed8",
    accentSoft: "rgba(59, 130, 246, 0.14)",
    accentGlow: "rgba(59, 130, 246, 0.4)",
    border: "rgba(96, 165, 250, 0.2)",
    borderStrong: "rgba(96, 165, 250, 0.36)",
    hex: "#3b82f6",
    backdrop: "radial-gradient(circle at 15% 10%, rgba(59,130,246,0.12), transparent 34%), radial-gradient(circle at 85% 90%, rgba(29,78,216,0.16), transparent 42%), linear-gradient(135deg, rgba(6,13,26,0.97) 0%, rgba(10,19,38,0.97) 100%)",
    grid: "repeating-linear-gradient(0deg, rgba(96,165,250,0.08) 0, rgba(96,165,250,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(96,165,250,0.05) 0, rgba(96,165,250,0.05) 1px, transparent 1px, transparent 28px)"
  },
  red: {
    name: "Red",
    accent: "#ef4444",
    accentDark: "#b91c1c",
    accentSoft: "rgba(239, 68, 68, 0.14)",
    accentGlow: "rgba(239, 68, 68, 0.4)",
    border: "rgba(239, 68, 68, 0.2)",
    borderStrong: "rgba(239, 68, 68, 0.36)",
    hex: "#ef4444",
    backdrop: "radial-gradient(circle at 15% 10%, rgba(239,68,68,0.12), transparent 34%), radial-gradient(circle at 85% 90%, rgba(185,28,28,0.16), transparent 42%), linear-gradient(135deg, rgba(6,13,26,0.97) 0%, rgba(10,19,38,0.97) 100%)",
    grid: "repeating-linear-gradient(0deg, rgba(239,68,68,0.08) 0, rgba(239,68,68,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(239,68,68,0.05) 0, rgba(239,68,68,0.05) 1px, transparent 1px, transparent 28px)"
  },
  purple: {
    name: "Purple",
    accent: "#a855f7",
    accentDark: "#7e22ce",
    accentSoft: "rgba(168, 85, 247, 0.14)",
    accentGlow: "rgba(168, 85, 247, 0.4)",
    border: "rgba(168, 85, 247, 0.2)",
    borderStrong: "rgba(168, 85, 247, 0.36)",
    hex: "#a855f7",
    backdrop: "radial-gradient(circle at 15% 10%, rgba(168,85,247,0.12), transparent 34%), radial-gradient(circle at 85% 90%, rgba(126,34,206,0.16), transparent 42%), linear-gradient(135deg, rgba(6,13,26,0.97) 0%, rgba(10,19,38,0.97) 100%)",
    grid: "repeating-linear-gradient(0deg, rgba(168,85,247,0.08) 0, rgba(168,85,247,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(168,85,247,0.05) 0, rgba(168,85,247,0.05) 1px, transparent 1px, transparent 28px)"
  },
  cyan: {
    name: "Cyan",
    accent: "#06b6d4",
    accentDark: "#0891b2",
    accentSoft: "rgba(6, 182, 212, 0.14)",
    accentGlow: "rgba(6, 182, 212, 0.4)",
    border: "rgba(6, 182, 212, 0.2)",
    borderStrong: "rgba(6, 182, 212, 0.36)",
    hex: "#06b6d4",
    backdrop: "radial-gradient(circle at 15% 10%, rgba(6,182,212,0.12), transparent 34%), radial-gradient(circle at 85% 90%, rgba(8,145,178,0.16), transparent 42%), linear-gradient(135deg, rgba(6,13,26,0.97) 0%, rgba(10,19,38,0.97) 100%)",
    grid: "repeating-linear-gradient(0deg, rgba(6,182,212,0.08) 0, rgba(6,182,212,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(6,182,212,0.05) 0, rgba(6,182,212,0.05) 1px, transparent 1px, transparent 28px)"
  },
  emerald: {
    name: "Emerald",
    accent: "#10b981",
    accentDark: "#047857",
    accentSoft: "rgba(16, 185, 129, 0.14)",
    accentGlow: "rgba(16, 185, 129, 0.4)",
    border: "rgba(16, 185, 129, 0.2)",
    borderStrong: "rgba(16, 185, 129, 0.36)",
    hex: "#10b981",
    backdrop: "radial-gradient(circle at 15% 10%, rgba(16,185,129,0.12), transparent 34%), radial-gradient(circle at 85% 90%, rgba(4,120,87,0.16), transparent 42%), linear-gradient(135deg, rgba(6,13,26,0.97) 0%, rgba(10,19,38,0.97) 100%)",
    grid: "repeating-linear-gradient(0deg, rgba(16,185,129,0.08) 0, rgba(16,185,129,0.08) 1px, transparent 1px, transparent 28px), repeating-linear-gradient(90deg, rgba(16,185,129,0.05) 0, rgba(16,185,129,0.05) 1px, transparent 1px, transparent 28px)"
  }
};

export function AdminThemeProvider({ children }) {
  const [selectedTheme, setSelectedTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("adminThemeColor");
      return (saved && adminColorPresets[saved]) ? saved : "purple";
    }
    return "purple";
  });

  // Save theme preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("adminThemeColor", selectedTheme);
  }, [selectedTheme]);

  const updateTheme = (themeName) => {
    if (adminColorPresets[themeName]) {
      setSelectedTheme(themeName);
    }
  };

  return (
    <AdminThemeContext.Provider value={{ selectedTheme, updateTheme, adminColorPresets }}>
      {children}
    </AdminThemeContext.Provider>
  );
}
