import React from "react";
import ReactDOM from "react-dom/client";

// Global error handler for third-party scripts
window.addEventListener('error', (event) => {
  // Suppress harmless third-party script errors
  if (event.filename && (event.filename.includes('share-modal') || event.filename.includes('vercel'))) {
    event.preventDefault();
    console.warn('Third-party script error suppressed:', event.message);
    return false;
  }
});

// The new dashboard (src/v3) is the app at "/". The previous dashboard (v1) is deprecated and lives under
// "/v1" until it is removed. Each is imported on demand so neither ships, nor loads its global
// stylesheet, on the other's routes.
const path = window.location.pathname;
const isLegacy = path === '/v1' || path.startsWith('/v1/');
const load = isLegacy ? import("./App") : import("./v3/V3Root");

load.then((mod) => {
  const Root = mod.default;
  ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
});
