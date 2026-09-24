import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Global error handler for third-party scripts
window.addEventListener('error', (event) => {
  // Suppress harmless third-party script errors
  if (event.filename && (event.filename.includes('share-modal') || event.filename.includes('vercel'))) {
    event.preventDefault();
    console.warn('Third-party script error suppressed:', event.message);
    return false;
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);
