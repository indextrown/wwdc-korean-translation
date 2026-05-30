import type { SubtitleSegment } from "../shared/types";

interface TranscriptToken {
  start: number;
  text: string;
}

export function parseWwdcTranscript(root: ParentNode): SubtitleSegment[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("#transcript-content [data-start]"));
  const tokens = nodes
    .map((node) => ({
      start: Number(node.dataset.start),
      text: normalizeTranscriptText(node.textContent ?? "")
    }))
    .filter((token): token is TranscriptToken => Number.isFinite(token.start) && token.text.length > 0);

  return groupTranscriptTokens(tokens);
}

export function parseWwdcTranscriptHtml(html: string): SubtitleSegment[] {
  const transcriptMatch = html.match(/<section[^>]+id=["']transcript-content["'][^>]*>([\s\S]*?)<\/section>/i);
  const source = transcriptMatch?.[1] ?? html;
  const tokens: TranscriptToken[] = [];
  const pattern = /<span\b[^>]*\bdata-start=["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>/gi;

  for (const match of source.matchAll(pattern)) {
    const start = Number(match[1]);
    const text = normalizeTranscriptText(decodeHtml(stripTags(match[2] ?? "")));
    if (Number.isFinite(start) && text.length > 0) {
      tokens.push({ start, text });
    }
  }

  return groupTranscriptTokens(tokens);
}

export function groupTranscriptTokens(tokens: TranscriptToken[]): SubtitleSegment[] {
  const segments: SubtitleSegment[] = [];
  let start = 0;
  let parts: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;

    if (parts.length === 0) {
      start = token.start;
    }

    parts.push(token.text);

    const next = tokens[index + 1];
    const text = normalizeTranscriptText(parts.join(" "));
    const duration = token.start - start;
    const gapToNext = next ? next.start - token.start : 4;
    const shouldEnd =
      !next ||
      duration >= 5 ||
      gapToNext > 3 ||
      text.length >= 180 ||
      /[.!?。！？]$/.test(text) ||
      /^♪.*♪$/.test(text);

    if (shouldEnd) {
      const end = next ? Math.max(next.start - 0.05, start + 1.5) : token.start + 4;
      segments.push({
        id: `segment-${segments.length}`,
        start,
        end,
        text
      });
      parts = [];
    }
  }

  return segments;
}

export function normalizeTranscriptText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
