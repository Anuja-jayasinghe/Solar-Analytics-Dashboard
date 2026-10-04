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

// v3 lives at /v3 until cutover. Each app is imported on demand so neither ships (nor loads its
// global stylesheet) on the other's routes.
const isV3 = window.location.pathname === '/v3' || window.location.pathname.startsWith('/v3/');
const load = isV3 ? import("./v3/V3Root") : import("./App");

load.then((mod) => {
  const Root = mod.default;
  ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
});
