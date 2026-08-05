import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.js";
import App from "./App.js";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa.js";

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  </ErrorBoundary>
);
