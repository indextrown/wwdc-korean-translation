import { getSettings, setSettings } from "../shared/storage";
import type { SubtitleLineOrder, SubtitleMode, TranslateProviderId } from "../shared/types";

const enabled = query<HTMLInputElement>("#enabled");
const provider = query<HTMLSelectElement>("#provider");
const subtitleMode = query<HTMLSelectElement>("#subtitleMode");
const subtitleLineOrder = query<HTMLSelectElement>("#subtitleLineOrder");
const fontScale = query<HTMLInputElement>("#fontScale");
const koreanFontScale = query<HTMLInputElement>("#koreanFontScale");
const englishFontScale = query<HTMLInputElement>("#englishFontScale");
const verticalPosition = query<HTMLInputElement>("#verticalPosition");
const fontScaleValue = query<HTMLOutputElement>("#fontScaleValue");
const koreanFontScaleValue = query<HTMLOutputElement>("#koreanFontScaleValue");
const englishFontScaleValue = query<HTMLOutputElement>("#englishFontScaleValue");
const verticalPositionValue = query<HTMLOutputElement>("#verticalPositionValue");
const status = query<HTMLElement>("#status");
const subtitleFullscreen = query<HTMLButtonElement>("#subtitleFullscreen");
const openOptions = query<HTMLButtonElement>("#openOptions");

void load();

enabled.addEventListener("change", () => void saveQuickSettings());
provider.addEventListener("change", () => void saveQuickSettings());
subtitleMode.addEventListener("change", () => void saveQuickSettings());
subtitleLineOrder.addEventListener("change", () => void saveQuickSettings());
fontScale.addEventListener("input", () => void saveQuickSettings());
koreanFontScale.addEventListener("input", () => void saveQuickSettings());
englishFontScale.addEventListener("input", () => void saveQuickSettings());
verticalPosition.addEventListener("input", () => void saveQuickSettings());
subtitleFullscreen.addEventListener("click", () => void toggleSubtitleFullscreen());
openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

async function load(): Promise<void> {
  const settings = await getSettings();
  enabled.checked = settings.enabled;
  provider.value = settings.provider;
  subtitleMode.value = settings.subtitleMode;
  subtitleLineOrder.value = settings.subtitleLineOrder;
  fontScale.value = String(settings.fontScale);
  koreanFontScale.value = String(settings.koreanFontScale);
  englishFontScale.value = String(settings.englishFontScale);
  verticalPosition.value = String(settings.verticalPosition);
  updateRangeLabels();
}

async function saveQuickSettings(): Promise<void> {
  updateRangeLabels();
  const settings = await getSettings();
  await setSettings({
    ...settings,
    enabled: enabled.checked,
    provider: provider.value as TranslateProviderId,
    subtitleMode: subtitleMode.value as SubtitleMode,
    subtitleLineOrder: subtitleLineOrder.value as SubtitleLineOrder,
    fontScale: Number(fontScale.value),
    koreanFontScale: Number(koreanFontScale.value),
    englishFontScale: Number(englishFontScale.value),
    verticalPosition: Number(verticalPosition.value)
  });
  status.textContent = "적용됨";
  setTimeout(() => {
    status.textContent = "";
  }, 1000);
}

function updateRangeLabels(): void {
  fontScaleValue.value = `${Math.round(Number(fontScale.value) * 100)}%`;
  koreanFontScaleValue.value = `${Math.round(Number(koreanFontScale.value) * 100)}%`;
  englishFontScaleValue.value = `${Math.round(Number(englishFontScale.value) * 100)}%`;
  verticalPositionValue.value = `${verticalPosition.value}%`;
}

async function toggleSubtitleFullscreen(): Promise<void> {
  try {
    const tab = await getActiveTab();
    if (!tab.id) {
      throw new Error("현재 탭을 찾지 못했습니다.");
    }

    const response = await chrome.tabs?.sendMessage<{ ok: boolean; error?: string }>(tab.id, {
      type: "toggle-subtitle-fullscreen"
    });

    if (!response?.ok) {
      throw new Error(response?.error ?? "전체화면 전환에 실패했습니다.");
    }

    status.textContent = "자막 전체화면 전환됨";
  } catch (error) {
    status.textContent = `실패: ${error instanceof Error ? error.message : String(error)}. ⌥⇧F/Alt+Shift+F를 눌러보세요.`;
  }
}

async function getActiveTab(): Promise<{ id?: number }> {
  const tabs = await chrome.tabs?.query({ active: true, currentWindow: true });
  return tabs?.[0] ?? {};
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`${selector} 요소를 찾지 못했습니다.`);
  }
  return element;
}
