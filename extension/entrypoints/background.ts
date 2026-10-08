/**
 * Background entrypoint: service worker on Chrome/Edge, event page on Firefox. Listeners only.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  extension/entrypoints/background.ts
 * Deps:    wxt, wxt/browser, src/background-logic, src/messages
 * Tested:  logic in extension/src/__tests__/background-logic.test.ts; wiring n/a
 *
 * Key responsibilities:
 * - Register every listener synchronously at top level so a woken worker does not miss events
 * - Alarm "poll" every minute → pollAll; re-created on install and on startup (Firefox loses alarms)
 * - Context menu "Research with oldboys" on any text selection
 * - Notification click → open the report; the notification id is the run id
 *
 * Design constraints:
 * - No state in module scope; everything is read from storage.local on each event
 */
import { defineBackground } from "wxt/utils/define-background";
import { browser } from "wxt/browser";
import { ensureAlarm, ALARM_POLL, forgetRun, openRun, pollAll, startFromMark } from "@/src/background-logic";
import { markFromSelection } from "@/src/lib/mark";
import { loadSettings } from "@/src/lib/store";
import { Message, type Reply } from "@/src/messages";

const MENU_ID = "oldboys-research-selection";

async function handle(message: Message): Promise<Reply> {
  try {
    switch (message.type) {
      case "start":
        await startFromMark(message.mark, fetch);
        return { ok: true };
      case "poll":
        await pollAll(fetch);
        return { ok: true };
      case "open":
        await openRun(message.runId);
        return { ok: true };
      case "forget":
        await forgetRun(message.runId);
        return { ok: true };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void ensureAlarm();
    browser.contextMenus.create({ id: MENU_ID, title: "Research with oldboys", contexts: ["selection"] });
  });
  browser.runtime.onStartup.addListener(() => {
    void ensureAlarm();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_POLL) void pollAll(fetch);
  });

  browser.contextMenus.onClicked.addListener((info) => {
    void (async () => {
      const settings = await loadSettings();
      const mark = markFromSelection(info.selectionText ?? "", info.pageUrl ?? "", settings.goal);
      if (mark) await startFromMark(mark, fetch);
    })();
  });

  browser.notifications.onClicked.addListener((id) => {
    if (!id.startsWith("error:")) void openRun(id);
  });

  browser.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse: (reply: Reply) => void) => {
    const parsed = Message.safeParse(raw);
    if (!parsed.success) {
      sendResponse({ ok: false, error: "bad message" });
      return false;
    }
    void handle(parsed.data).then(sendResponse);
    return true;
  });
});
