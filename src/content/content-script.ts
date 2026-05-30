import { sha256Hex } from "../shared/hash";
import { cacheKey, getCachedTranslation, getSettings, setCachedTranslation, setSettings } from "../shared/storage";
import { defaultSettings, type ExtensionSettings, type SubtitleSegment, type TranslateResponse } from "../shared/types";
import { findActiveSegment } from "../subtitles/matching";
import { parseWwdcTranscript, parseWwdcTranscriptHtml } from "../subtitles/transcript";

const ROOT_ID = "wwdc-ko-subtitles-root";
const STATE_ID = "wwdc-ko-subtitles-state";
const FULLSCREEN_BUTTON_ID = "wwdc-ko-subtitle-fullscreen";

let settings: ExtensionSettings = defaultSettings;
let video: HTMLVideoElement | undefined;
let segments: SubtitleSegment[] = [];
let videoId = "";
let activeSegmentId = "";
let translatorPromise: Promise<BuiltInTranslator> | undefined;
let settingsReloadTimer: number | undefined;
let lastShortcutAt = 0;
let lastFullscreenShortcutAt = 0;
let controlsRegistered = false;

const translations = new Map<string, string>();
const pending = new Set<string>();

registerSettingsControls();
void init();

async function init(): Promise<void> {
  settings = await getSettings();

  const videoPromise = waitForVideo();
  const segmentsPromise = waitForTranscriptSegments();

  video = await videoPromise;
  videoId = video.dataset.id || deriveVideoId(location.pathname);

  createOverlay();
  applyOverlaySettings();
  renderStatus("자막 전문 찾는 중...");

  segments = await segmentsPromise;

  if (segments.length === 0) {
    renderStatus("자막 전문을 찾지 못했습니다.");
    return;
  }

  renderStatus("자막 준비 완료");
  video.addEventListener("timeupdate", updateSubtitle);
  video.addEventListener("seeked", updateSubtitle);
  chrome.storage.local.get(null).then(() => updateSubtitle()).catch(() => updateSubtitle());
}

function registerSettingsControls(): void {
  if (controlsRegistered) return;
  controlsRegistered = true;

  window.addEventListener("keydown", (event) => void handleShortcut(event), true);
  window.addEventListener("keyup", (event) => void handleShortcut(event), true);
  document.addEventListener("keydown", (event) => void handleShortcut(event), true);
  document.addEventListener("keyup", (event) => void handleShortcut(event), true);
  document.addEventListener("visibilitychange", updateSubtitle);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isContentAction(message, "toggle-subtitle-fullscreen")) {
      void toggleSubtitleFullscreen()
        .then((result) => sendResponse(result))
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      return true;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (Object.keys(changes).some((key) => key.includes("wwdcKoreanSubtitles.settings"))) {
      void reloadSettings();
    }
  });

  settingsReloadTimer ??= window.setInterval(() => {
    void reloadSettings();
  }, 1000);
}

async function handleShortcut(event: KeyboardEvent): Promise<void> {
  if (event.type !== "keydown") {
    return;
  }

  if (isToggleSubtitleShortcut(event)) {
    await toggleSubtitlesFromShortcut(event);
    return;
  }

  if (isSubtitleFullscreenShortcut(event)) {
    await toggleFullscreenFromShortcut(event);
  }
}

async function toggleSubtitlesFromShortcut(event: KeyboardEvent): Promise<void> {
  const now = Date.now();
  if (now - lastShortcutAt < 250) return;
  lastShortcutAt = now;

  if (isEditableTarget(event.target)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const current = await getSettings();
  settings = {
    ...current,
    enabled: !current.enabled
  };
  await setSettings(settings);
  applyOverlaySettings();
  updateSubtitle();
}

async function toggleFullscreenFromShortcut(event: KeyboardEvent): Promise<void> {
  const now = Date.now();
  if (now - lastFullscreenShortcutAt < 250) return;
  lastFullscreenShortcutAt = now;

  if (isEditableTarget(event.target)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  await toggleSubtitleFullscreen();
}

function isToggleSubtitleShortcut(event: KeyboardEvent): boolean {
  const isS = event.code === "KeyS" || event.key.toLowerCase() === "s";
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && isS;
}

function isSubtitleFullscreenShortcut(event: KeyboardEvent): boolean {
  const isF = event.code === "KeyF" || event.key.toLowerCase() === "f";
  return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && isF;
}

async function toggleSubtitleFullscreen(): Promise<{ ok: true; fullscreen: boolean }> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return { ok: true, fullscreen: false };
  }

  const target = getFullscreenTarget();
  await target.requestFullscreen();
  return { ok: true, fullscreen: true };
}

function getFullscreenTarget(): HTMLElement {
  const player = document.querySelector<HTMLElement>(".developer-video-player");
  if (player) return player;

  if (video?.parentElement) return video.parentElement;

  const currentVideo = document.querySelector<HTMLVideoElement>("video#video, .developer-video-player video, video");
  if (currentVideo?.parentElement) return currentVideo.parentElement;

  throw new Error("전체화면으로 전환할 영상 영역을 찾지 못했습니다.");
}

function isContentAction(message: unknown, type: string): message is { type: string } {
  return typeof message === "object" && message !== null && "type" in message && (message as { type?: unknown }).type === type;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

async function reloadSettings(): Promise<void> {
  const next = await getSettings();
  const changed = JSON.stringify(next) !== JSON.stringify(settings);
  settings = next;
  if (changed) {
    applyOverlaySettings();
    updateSubtitle();
  }
}

async function waitForVideo(): Promise<HTMLVideoElement> {
  const existing = document.querySelector<HTMLVideoElement>("video#video, .developer-video-player video, video");
  if (existing) return existing;

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLVideoElement>("video#video, .developer-video-player video, video");
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("비디오를 찾지 못했습니다."));
    }, 10000);
  });
}

async function waitForTranscriptSegments(): Promise<SubtitleSegment[]> {
  const existing = parseWwdcTranscript(document);
  if (existing.length > 0) return existing;

  const fromCurrentHtml = parseWwdcTranscriptHtml(document.documentElement.outerHTML);
  if (fromCurrentHtml.length > 0) return fromCurrentHtml;

  const first = await firstNonEmpty([
    fetchTranscriptFromCandidatePages(),
    waitForTranscriptDom(5000)
  ]);
  if (first.length > 0) return first;

  return waitForTranscriptDom(7000);
}

async function firstNonEmpty(promises: Array<Promise<SubtitleSegment[]>>): Promise<SubtitleSegment[]> {
  return new Promise((resolve) => {
    let settled = 0;

    for (const promise of promises) {
      promise
        .then((segmentsResult) => {
          settled += 1;
          if (segmentsResult.length > 0 || settled === promises.length) {
            resolve(segmentsResult);
          }
        })
        .catch(() => {
          settled += 1;
          if (settled === promises.length) {
            resolve([]);
          }
        });
    }
  });
}

async function waitForTranscriptDom(timeoutMs: number): Promise<SubtitleSegment[]> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const parsed = parseWwdcTranscript(document);
      if (parsed.length > 0) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(parsed);
      }
    });

    const timeout = setTimeout(() => {
      observer.disconnect();
      resolve([]);
    }, timeoutMs);

    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function fetchTranscriptFromCandidatePages(): Promise<SubtitleSegment[]> {
  for (const url of transcriptCandidateUrls()) {
    const parsed = await fetchTranscriptFromUrl(url);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

async function fetchTranscriptFromUrl(url: string): Promise<SubtitleSegment[]> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return [];

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const parsedDom = parseWwdcTranscript(doc);
    if (parsedDom.length > 0) return parsedDom;

    return parseWwdcTranscriptHtml(html);
  } catch {
    return [];
  }
}

function transcriptCandidateUrls(): string[] {
  const urls = new Set<string>([location.href]);
  const alternateEnglish = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="en"]')?.href;
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

  if (alternateEnglish) urls.add(alternateEnglish);
  if (canonical) urls.add(canonical);

  const match = location.pathname.match(/\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?videos\/play\/([^/]+)\/([^/]+)/);
  if (match) {
    urls.add(`${location.origin}/videos/play/${match[1]}/${match[2]}/`);
  }

  return Array.from(urls);
}

function createOverlay(): void {
  removeLegacyControls();

  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    removeLegacyControls();
    const player = document.querySelector(".developer-video-player") ?? video?.parentElement ?? document.body;
    createFullscreenButton(player);
    return;
  }

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="wwdc-ko-subtitles-lines" aria-live="polite">
      <div class="wwdc-ko-subtitles-ko"></div>
      <div class="wwdc-ko-subtitles-en"></div>
    </div>
  `;

  const player = document.querySelector(".developer-video-player") ?? video?.parentElement ?? document.body;
  player.append(root);
  createFullscreenButton(player);
}

function createFullscreenButton(parent: Element): void {
  if (!(parent instanceof HTMLElement) || document.getElementById(FULLSCREEN_BUTTON_ID)) return;

  const button = document.createElement("button");
  button.id = FULLSCREEN_BUTTON_ID;
  button.type = "button";
  button.title = "자막 포함 전체화면";
  button.setAttribute("aria-label", "자막 포함 전체화면");
  button.textContent = "⛶";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void toggleSubtitleFullscreen();
  });

  parent.append(button);
}

function removeLegacyControls(): void {
  document.querySelectorAll(".wwdc-ko-subtitles-settings").forEach((element) => element.remove());
}

function applyOverlaySettings(): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  root.style.setProperty("--wwdc-ko-font-scale", String(settings.fontScale));
  root.style.setProperty("--wwdc-ko-line-font-scale", String(settings.koreanFontScale));
  root.style.setProperty("--wwdc-en-line-font-scale", String(settings.englishFontScale));
  root.style.setProperty("--wwdc-ko-bottom", `${settings.verticalPosition}%`);
  root.classList.toggle("is-disabled", !settings.enabled);
  root.classList.toggle("mode-en-only", settings.subtitleMode === "en_only");
  root.classList.toggle("mode-ko-only", settings.subtitleMode === "ko_only");
  root.classList.toggle("order-ko-below", settings.subtitleLineOrder === "ko_below");
}

function updateSubtitle(): void {
  if (!video || !settings.enabled) {
    renderStatus("");
    return;
  }

  const segment = findActiveSegment(segments, video.currentTime);
  if (!segment) {
    activeSegmentId = "";
    renderStatus("");
    return;
  }

  if (activeSegmentId !== segment.id) {
    activeSegmentId = segment.id;
    void ensureTranslationWindow(segment);
  }

  const translated = translations.get(segment.id);
  const ko = translated ?? (settings.provider === "chrome_builtin" ? "번역 중..." : needsCloudSetup() ? "번역 API 설정이 필요합니다." : "번역 중...");
  renderSubtitle({
    korean: settings.subtitleMode === "en_only" ? "" : ko,
    english: settings.subtitleMode === "ko_only" ? "" : segment.text
  });
}

async function ensureTranslationWindow(segment: SubtitleSegment): Promise<void> {
  if (settings.subtitleMode === "en_only") return;

  const index = segments.findIndex((item) => item.id === segment.id);
  const candidates = segments.slice(index, index + 4).filter((item) => shouldTranslate(item.text));
  const uncached: SubtitleSegment[] = [];

  for (const candidate of candidates) {
    if (translations.has(candidate.id) || pending.has(candidate.id)) continue;
    const key = await buildCacheKey(candidate.text);
    const cached = await getCachedTranslation(key);
    if (cached) {
      translations.set(candidate.id, cached);
    } else {
      uncached.push(candidate);
    }
  }

  if (uncached.length === 0) {
    updateSubtitle();
    return;
  }

  for (const item of uncached) pending.add(item.id);

  try {
    const result =
      settings.provider === "chrome_builtin"
        ? await translateWithChromeBuiltIn(uncached.map((item) => item.text))
        : await translateWithBackground(uncached.map((item) => item.text));

    await Promise.all(
      uncached.map(async (item, itemIndex) => {
        const translated = result[itemIndex] ?? "";
        translations.set(item.id, translated);
        await setCachedTranslation(await buildCacheKey(item.text), translated);
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    translations.set(segment.id, message);
  } finally {
    for (const item of uncached) pending.delete(item.id);
    updateSubtitle();
  }
}

async function translateWithBackground(texts: string[]): Promise<string[]> {
  const response = await chrome.runtime.sendMessage<TranslateResponse>({
    type: "translate",
    provider: settings.provider,
    texts,
    sourceLanguage: "en",
    targetLanguage: "ko"
  });

  if (!response.ok) {
    throw new Error(response.error ?? "번역에 실패했습니다.");
  }
  return response.translations ?? [];
}

async function translateWithChromeBuiltIn(texts: string[]): Promise<string[]> {
  const TranslatorApi = globalThis.Translator;
  if (!TranslatorApi) {
    throw new Error("이 Chrome 버전은 내장 Translator API를 지원하지 않습니다.");
  }

  const availability = await TranslatorApi.availability({
    sourceLanguage: "en",
    targetLanguage: "ko"
  });
  if (availability === "unavailable") {
    throw new Error("Chrome 내장 번역 모델에서 영어->한국어를 사용할 수 없습니다.");
  }

  translatorPromise ??= TranslatorApi.create({
    sourceLanguage: "en",
    targetLanguage: "ko"
  });
  const translator = await translatorPromise;

  const output: string[] = [];
  for (const text of texts) {
    output.push(await translator.translate(text));
  }
  return output;
}

function renderSubtitle(input: { korean: string; english: string }): void {
  const ko = document.querySelector<HTMLElement>(`#${ROOT_ID} .wwdc-ko-subtitles-ko`);
  const en = document.querySelector<HTMLElement>(`#${ROOT_ID} .wwdc-ko-subtitles-en`);
  if (!ko || !en) return;

  ko.textContent = input.korean;
  en.textContent = input.english;
}

function renderStatus(text: string): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  root.dataset.status = text;
  renderSubtitle({ korean: text, english: "" });
}

async function buildCacheKey(text: string): Promise<string> {
  return cacheKey({
    videoId,
    provider: settings.provider,
    sourceLanguage: "en",
    targetLanguage: "ko",
    textHash: await sha256Hex(text)
  });
}

function shouldTranslate(text: string): boolean {
  if (!text.trim()) return false;
  if (/^♪.*♪$/.test(text.trim())) return false;
  if (/^[{}()[\].,;:\s\w"'`=<>/+*-]+$/.test(text) && /[{}();=<>]/.test(text)) return false;
  return true;
}

function needsCloudSetup(): boolean {
  const keys = settings.apiKeys;
  switch (settings.provider) {
    case "azure_translator":
      return !keys.azureKey;
    case "google_cloud":
      return !keys.googleApiKey;
    case "deepl":
      return !keys.deeplApiKey;
    case "papago":
      return !keys.papagoClientId || !keys.papagoClientSecret;
    case "aws_translate":
      return !keys.awsAccessKeyId || !keys.awsSecretAccessKey || !keys.awsRegion;
    case "libretranslate":
      return !keys.libreTranslateEndpoint;
    case "chrome_builtin":
      return false;
  }
}

function deriveVideoId(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const playIndex = parts.indexOf("play");
  if (playIndex >= 0) {
    return parts.slice(playIndex + 1, playIndex + 3).join("-");
  }
  return pathname.replace(/\W+/g, "-");
}
