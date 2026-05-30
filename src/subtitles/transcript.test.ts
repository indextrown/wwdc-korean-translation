import { describe, expect, it } from "vitest";
import { groupTranscriptTokens, normalizeTranscriptText, parseWwdcTranscriptHtml } from "./transcript";

describe("transcript parsing", () => {
  it("normalizes whitespace and punctuation", () => {
    expect(normalizeTranscriptText(" Hello   ,   SwiftUI ! ")).toBe("Hello, SwiftUI!");
  });

  it("groups timed transcript tokens into readable segments", () => {
    const segments = groupTranscriptTokens([
      { start: 9, text: "Hi, I'm Matt," },
      { start: 10, text: "and later on I'll be joined by Luca and Raj." },
      { start: 14, text: "Today, we're going to demystify SwiftUI." }
    ]);

    expect(segments).toEqual([
      {
        id: "segment-0",
        start: 9,
        end: 13.95,
        text: "Hi, I'm Matt, and later on I'll be joined by Luca and Raj."
      },
      {
        id: "segment-1",
        start: 14,
        end: 18,
        text: "Today, we're going to demystify SwiftUI."
      }
    ]);
  });

  it("parses transcript segments from raw Apple page html", () => {
    const html = `
      <section id="transcript-content">
        <p><span class="sentence"><span data-start="9.0">Matt: Hi, I&#39;m Matt, </span></span>
        <span class="sentence"><span data-start="10.0">and welcome to WWDC.</span></span></p>
      </section>
    `;

    expect(parseWwdcTranscriptHtml(html)).toEqual([
      {
        id: "segment-0",
        start: 9,
        end: 14,
        text: "Matt: Hi, I'm Matt, and welcome to WWDC."
      }
    ]);
  });
});
