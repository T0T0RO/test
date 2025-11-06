// apps/shell/src/main.ts
import { bootstrapApplication } from "@angular/platform-browser";
import { Component } from "@angular/core";
import { loadRemote } from './remoteLoader';

async function mountRemote(url, container, props) {
  const remote = await loadRemote(url);
  await remote.mount(container, props);
  return () => remote.unmount(container);
}


@Component({
  selector: "app-root",
  standalone: true,
  template: `
    <h1>Shell</h1>
    <div id="remote-area">Loading remotes...</div>
  `,
})
class AppRoot {}

async function loadRemotes() {
  const container = document.getElementById("remote-area");
  if (!container) return;
  container.innerHTML = "";
  try {
    // Dev-time simple remote import (these files exist in apps/*/src/remote-entry.js)
    const m1 = await import("@app1/remote-entry.js");
    const m2 = await import("@app2/remote-entry.js");
    const m3 = await import("@app3/remote-entry.js");

    if (m1?.html) container.insertAdjacentHTML("beforeend", m1.html);
    if (m2?.html) container.insertAdjacentHTML("beforeend", m2.html);
    if (m3?.html) container.insertAdjacentHTML("beforeend", m3.html);
  } catch (err) {
    console.error("Failed to load remotes", err);
    container.innerText = "Failed to load remotes: " + String(err);
  }
}

bootstrapApplication(AppRoot)
  .then(() => loadRemotes())
  .catch((err) => console.error(err));
