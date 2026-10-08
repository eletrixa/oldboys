/**
 * Popup: settings form and the queue of marked people; every action goes through the background.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/entrypoints/popup/main.ts
 * Deps:    wxt/browser, src/lib/*, src/messages
 * Tested:  n/a (DOM glue; logic lives in src/lib and src/background-logic)
 *
 * Key responsibilities:
 * - Load and save Settings; list TrackedRuns with status; Refresh reconciles against the API
 * - Open and Forget per run
 *
 * Design constraints:
 * - Plain DOM, no framework: the popup is one list and one form
 */
import { browser } from "wxt/browser";
import { Settings } from "@/src/lib/api";
import { needsUser, type TrackedRun } from "@/src/lib/poll";
import { loadRuns, loadSettings, saveSettings } from "@/src/lib/store";
import { type Message, type Reply } from "@/src/messages";

async function send(message: Message): Promise<Reply> {
  return browser.runtime.sendMessage<Message, Reply>(message);
}

function statusLine(run: TrackedRun): string {
  switch (run.status) {
    case "queued":
      return "queued";
    case "running":
      return "researching…";
    case "paused":
      return `${String(run.candidates)} candidates, pick one`;
    case "done":
      return `${String(run.facts)} facts · ${String(run.inferences)} inferences · ${String(run.gaps)} gaps`;
    case "failed":
      return "failed";
  }
}

function renderRuns(list: HTMLUListElement, runs: readonly TrackedRun[]): void {
  list.replaceChildren(
    ...runs.map((run) => {
      const li = document.createElement("li");
      const text = document.createElement("div");
      const name = document.createElement("div");
      name.textContent = `${run.subject} (${run.goal})`;
      const status = document.createElement("div");
      status.className = needsUser(run) ? "status needs" : "status";
      status.textContent = statusLine(run);
      text.append(name, status);
      const open = document.createElement("button");
      open.type = "button";
      open.textContent = "Open";
      open.addEventListener("click", () => void send({ type: "open", runId: run.runId }));
      const forget = document.createElement("button");
      forget.type = "button";
      forget.textContent = "×";
      forget.title = "Forget";
      forget.addEventListener("click", () => {
        void send({ type: "forget", runId: run.runId }).then(refresh);
      });
      li.append(text, open, forget);
      return li;
    }),
  );
}

const form = document.querySelector<HTMLFormElement>("#settings");
const list = document.querySelector<HTMLUListElement>("#runs");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh");
if (!form || !list || !refreshButton) throw new Error("popup markup missing");

const runList: HTMLUListElement = list;

async function refresh(): Promise<void> {
  renderRuns(runList, await loadRuns());
}

void (async () => {
  const settings = await loadSettings();
  (form.elements.namedItem("goal") as HTMLSelectElement).value = settings.goal;
  (form.elements.namedItem("token") as HTMLInputElement).value = settings.token;
  (form.elements.namedItem("apiBase") as HTMLInputElement).value = settings.apiBase;
  await refresh();
})();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const field = (name: string): string => {
    const value = new FormData(form).get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const parsed = Settings.safeParse({
    goal: field("goal"),
    token: field("token"),
    apiBase: field("apiBase").replace(/\/+$/, ""),
  });
  if (!parsed.success) {
    form.reportValidity();
    return;
  }
  void saveSettings(parsed.data);
});

refreshButton.addEventListener("click", () => {
  refreshButton.disabled = true;
  void send({ type: "poll" })
    .then(refresh)
    .finally(() => {
      refreshButton.disabled = false;
    });
});
