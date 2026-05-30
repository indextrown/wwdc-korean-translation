import { translateViaCloudProvider } from "../providers/cloud-providers";
import { getSettings, setSettings } from "../shared/storage";
import type { RuntimeRequest, TranslateResponse } from "../shared/types";

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-subtitles") {
    void toggleSubtitles();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message as RuntimeRequest)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => {
      const response: TranslateResponse = {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
      sendResponse(response);
    });
  return true;
});

async function toggleSubtitles(): Promise<void> {
  const settings = await getSettings();
  await setSettings({
    ...settings,
    enabled: !settings.enabled
  });
}

async function handleMessage(message: RuntimeRequest): Promise<unknown> {
  if (message.type === "get-settings") {
    return { ok: true, settings: await getSettings() };
  }

  if (message.type === "set-settings") {
    if (!message.settings) {
      throw new Error("저장할 설정이 없습니다.");
    }
    await setSettings(message.settings);
    return { ok: true };
  }

  if (message.type === "translate") {
    const settings = await getSettings();
    const translations = await translateViaCloudProvider({
      provider: message.provider,
      texts: message.texts,
      sourceLanguage: message.sourceLanguage,
      targetLanguage: message.targetLanguage,
      apiKeys: settings.apiKeys
    });
    return { ok: true, translations };
  }

  throw new Error("지원하지 않는 메시지입니다.");
}
