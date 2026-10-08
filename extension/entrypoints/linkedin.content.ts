/**
 * Content script for LinkedIn profile pages: a small "Research" button, nothing else.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/entrypoints/linkedin.content.ts
 * Deps:    wxt, wxt/browser, src/lib/mark, src/messages
 * Tested:  parsing in extension/src/lib/__tests__/mark.test.ts; DOM reading n/a
 *
 * Key responsibilities:
 * - Read only the profile URL, the visible h1 and the visible location line (document.title as fallback)
 * - Mount one button in a shadow root; re-mount on SPA navigation; send a "start" message on click
 *
 * Design constraints:
 * - No automation, no scrolling, no reading of connection-gated fields (plans/004, case studies)
 * - Styles are inline in the shadow root so LinkedIn's CSS cannot leak in or out
 */
import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { parseProfile, type ProfilePage } from "@/src/lib/mark";
import { loadSettings } from "@/src/lib/store";
import { type Message, type Reply } from "@/src/messages";

const HOST_ID = "oldboys-research-host";

export function readProfile(doc: Document, url: string): ProfilePage {
  const h1 = doc.querySelector("main h1")?.textContent ?? null;
  const locationLine = doc.querySelector("main .text-body-small.inline")?.textContent ?? null;
  return { url, h1, title: doc.title, locationLine };
}

function mount(doc: Document): void {
  doc.getElementById(HOST_ID)?.remove();
  const host = doc.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      button{font:600 13px system-ui,sans-serif;color:#fff;background:#111;border:0;border-radius:999px;
        padding:10px 16px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}
      button[disabled]{opacity:.6;cursor:default}
    </style>
    <button type="button">Research with oldboys</button>`;
  const button = shadow.querySelector("button");
  if (!button) return;
  button.addEventListener("click", () => {
    void (async () => {
      button.disabled = true;
      const settings = await loadSettings();
      const mark = parseProfile(readProfile(doc, doc.location.href), settings.goal);
      if (!mark) {
        button.textContent = "Not a profile page";
        return;
      }
      const message: Message = { type: "start", mark };
      const reply = await browser.runtime.sendMessage<Message, Reply>(message);
      button.textContent = reply.ok ? `Researching (${settings.goal})…` : reply.error;
    })();
  });
  doc.body.append(host);
}

export default defineContentScript({
  matches: ["https://www.linkedin.com/in/*"],
  main(ctx) {
    mount(document);
    ctx.addEventListener(window, "wxt:locationchange", () => {
      mount(document);
    });
  },
});
