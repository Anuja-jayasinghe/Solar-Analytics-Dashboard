import React from "react";
import ReactDOM from "react-dom/client";
import V3Root from "./v3/V3Root";

// The dashboard (src/v3) is the only app. The deprecated v1 dashboard that lived under /v1 was
// removed on 2026-10-29 (it read the dashboard tables in the browser with the public anon key,
// which kept them publicly readable); /v1 addresses redirect into v3 (src/v3/routes.js).
ReactDOM.createRoot(document.getElementById("root")).render(<V3Root />);
