// simple_react_app/app-react/src/bootstrap.tsx
import React from "react";
import { createRoot, type Root } from "react-dom/client";

let root: Root | null = null;

function App() {
  return (
    <div style={{ border: "1px solid #ccc", padding: 8 }}>
      <h3>app-react</h3>
      <p>Hello from React remote.</p>
    </div>
  );
}

export async function bootstrap(container: HTMLElement, _props?: any) {
  if (!container) throw new Error("No container provided to bootstrap React app.");
  root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

export async function teardown() {
  if (root) { root.unmount(); root = null; }
}
