/**
 * Tests for the apply form's transport: the silence timeout of postForm and what sendApplication sends and shows.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/apply/[tag]/__tests__/post-form.test.ts
 * Deps:    vitest (fake timers), ../post-form, ../apply-fields
 * Tested:  n/a (this is the test file)
 *
 * Key responsibilities:
 * - A slow upload that keeps moving outlasts POST_IDLE_MS in total and still finishes; a stalled upload, or a server
 *   that stays silent after the upload, times out after POST_IDLE_MS of silence
 * - sendApplication: the body is the draft (file in file mode, text in paste mode, honeypot, fill time); 201 is done
 *   with the attached line; a 200 (a trapped send) is "try again" and clears the honeypot for the retry
 *
 * Design constraints:
 * - Pure Node: a hand-written XMLHttpRequest stand-in on globalThis, no DOM
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FILL_MS, HONEYPOT, MESSAGES, type ApplyDraft } from "../apply-fields";
import { POST_IDLE_MS, PostFailure, postForm, sendApplication } from "../post-form";

type Handler = (() => void) | null;

class FakeXhr {
  static last: FakeXhr | null = null;
  readonly upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null; onload: Handler } = {
    onprogress: null,
    onload: null,
  };
  onload: Handler = null;
  onerror: Handler = null;
  onabort: Handler = null;
  status = 0;
  responseText = "";
  url = "";
  body: unknown = null;
  open(_method: string, url: string): void {
    this.url = url;
  }
  send(body: unknown): void {
    this.body = body;
    FakeXhr.last = this;
  }
  abort(): void {
    this.onabort?.();
  }
  /** Test side: bytes went out. */
  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }
  /** Test side: the server answered. */
  answer(status: number, body: unknown): void {
    this.upload.onload?.();
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}

const xhr = (): FakeXhr => {
  if (FakeXhr.last === null) throw new Error("nothing sent");
  return FakeXhr.last;
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeXhr.last = null;
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("postForm", () => {
  it("lets a slow upload that keeps moving run far past POST_IDLE_MS in total", async () => {
    const percents: number[] = [];
    const sent = postForm("/api/apply", new FormData(), (p) => percents.push(p));
    for (let i = 1; i <= 10; i++) {
      vi.advanceTimersByTime(POST_IDLE_MS - 1_000);
      xhr().progress(i, 10);
    }
    xhr().answer(201, { received: true });
    await expect(sent).resolves.toEqual({ status: 201, body: { received: true } });
    expect(percents.at(-1)).toBe(100);
  });

  it("times out after POST_IDLE_MS without progress, and when the server stays silent after the upload", async () => {
    const stalled = postForm("/api/apply", new FormData(), () => undefined);
    xhr().progress(1, 10);
    vi.advanceTimersByTime(POST_IDLE_MS);
    await expect(stalled).rejects.toEqual(new PostFailure("timeout"));

    const silent = postForm("/api/apply", new FormData(), () => undefined);
    xhr().progress(10, 10);
    xhr().upload.onload?.();
    vi.advanceTimersByTime(POST_IDLE_MS);
    await expect(silent).rejects.toEqual(new PostFailure("timeout"));
  });

  it("reports a network failure as such", async () => {
    const sent = postForm("/api/apply", new FormData(), () => undefined);
    xhr().onerror?.();
    await expect(sent).rejects.toEqual(new PostFailure("network"));
  });
});

describe("sendApplication", () => {
  const draft: ApplyDraft = { name: "Jana Novak", email: "jana@mail.test", linkedinUrl: "", cv: null, cvText: "Ten years of Rust.", message: "Hi" };
  const trap = (value = ""): { input: HTMLInputElement; fillMs: number } => ({ input: { value } as HTMLInputElement, fillMs: 12_345.6 });

  it("sends the draft itself: pasted text in paste mode, the file in file mode, the honeypot and the fill time", async () => {
    const pasted = sendApplication({ tag: "senior-be", lang: "cs", draft, trap: trap() }, () => undefined);
    const body = xhr().body as FormData;
    expect(xhr().url).toBe("/api/apply?lang=cs");
    expect(Object.fromEntries(body)).toEqual({
      tag: "senior-be",
      name: "Jana Novak",
      email: "jana@mail.test",
      linkedinUrl: "",
      coverLetter: "Hi",
      cvText: "Ten years of Rust.",
      [HONEYPOT]: "",
      [FILL_MS]: "12346",
    });
    xhr().answer(201, { received: true });
    expect(await pasted).toEqual({ kind: "done", attached: "Váš životopis, vložený jako text" });

    const cv = new File(["%PDF-1.4"], "jana.pdf", { type: "application/pdf" });
    const filed = sendApplication({ tag: "senior-be", lang: "en", draft: { ...draft, cv }, trap: trap() }, () => undefined);
    const fileBody = xhr().body as FormData;
    expect(fileBody.has("cvText")).toBe(false);
    expect((fileBody.get("cv") as File).name).toBe("jana.pdf");
    xhr().answer(201, { received: true });
    expect(await filed).toEqual({ kind: "done", attached: "Your CV: jana.pdf" });
  });

  it("never shows Received for a trapped send (200): it asks to try again and clears the autofilled honeypot", async () => {
    const t = trap("https://jana.dev");
    const sent = sendApplication({ tag: "senior-be", lang: "en", draft, trap: t }, () => undefined);
    expect((xhr().body as FormData).get(HONEYPOT)).toBe("https://jana.dev");
    xhr().answer(200, { received: true });
    expect(await sent).toEqual({ kind: "error", message: MESSAGES.server, retry: true });
    expect(t.input.value).toBe("");
  });

  it("turns a timeout into the timeout sentence with Try again", async () => {
    const sent = sendApplication({ tag: "senior-be", lang: "en", draft, trap: trap() }, () => undefined);
    vi.advanceTimersByTime(POST_IDLE_MS);
    expect(await sent).toEqual({ kind: "error", message: MESSAGES.timeout, retry: true });
  });
});
