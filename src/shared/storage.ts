import { defaultSettings, type ExtensionSettings } from "./types";

const SETTINGS_KEY = "wwdcKoreanSubtitles.settings";

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return mergeSettings(stored);
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export function mergeSettings(stored?: Partial<ExtensionSettings>): ExtensionSettings {
  const legacyFontScale = stored?.fontScale ?? defaultSettings.fontScale;

  return {
    ...defaultSettings,
    ...stored,
    koreanFontScale: stored?.koreanFontScale ?? legacyFontScale,
    englishFontScale: stored?.englishFontScale ?? legacyFontScale,
    apiKeys: {
      ...defaultSettings.apiKeys,
      ...(stored?.apiKeys ?? {})
    }
  };
}

export function cacheKey(input: {
  videoId: string;
  provider: string;
  sourceLanguage: string;
  targetLanguage: string;
  textHash: string;
}): string {
  return [
    "wwdcKoreanSubtitles.translation",
    input.videoId,
    input.provider,
    input.sourceLanguage,
    input.targetLanguage,
    input.textHash
  ].join(".");
}

export async function getCachedTranslation(key: string): Promise<string | undefined> {
  const result = await chrome.storage.local.get(key);
  const value = result[key];
  return typeof value === "string" ? value : undefined;
}

export async function setCachedTranslation(key: string, translation: string): Promise<void> {
  await chrome.storage.local.set({ [key]: translation });
}
