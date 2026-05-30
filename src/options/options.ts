import { getSettings, setSettings } from "../shared/storage";
import type { ExtensionSettings, SubtitleLineOrder, SubtitleMode, TranslateProviderId } from "../shared/types";

const form = query<HTMLFormElement>("#settings-form");
const status = query<HTMLElement>("#status");

void load();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void save();
});

async function load(): Promise<void> {
  const settings = await getSettings();
  query<HTMLInputElement>("#enabled").checked = settings.enabled;
  query<HTMLSelectElement>("#provider").value = settings.provider;
  query<HTMLSelectElement>("#subtitleMode").value = settings.subtitleMode;
  query<HTMLSelectElement>("#subtitleLineOrder").value = settings.subtitleLineOrder;
  query<HTMLInputElement>("#fontScale").value = String(settings.fontScale);
  query<HTMLInputElement>("#koreanFontScale").value = String(settings.koreanFontScale);
  query<HTMLInputElement>("#englishFontScale").value = String(settings.englishFontScale);
  query<HTMLInputElement>("#verticalPosition").value = String(settings.verticalPosition);

  for (const [key, value] of Object.entries(settings.apiKeys)) {
    const input = document.getElementById(key);
    if (input instanceof HTMLInputElement) {
      input.value = String(value);
    }
  }
}

async function save(): Promise<void> {
  const previous = await getSettings();
  const next: ExtensionSettings = {
    ...previous,
    enabled: query<HTMLInputElement>("#enabled").checked,
    provider: query<HTMLSelectElement>("#provider").value as TranslateProviderId,
    subtitleMode: query<HTMLSelectElement>("#subtitleMode").value as SubtitleMode,
    subtitleLineOrder: query<HTMLSelectElement>("#subtitleLineOrder").value as SubtitleLineOrder,
    fontScale: Number(query<HTMLInputElement>("#fontScale").value),
    koreanFontScale: Number(query<HTMLInputElement>("#koreanFontScale").value),
    englishFontScale: Number(query<HTMLInputElement>("#englishFontScale").value),
    verticalPosition: Number(query<HTMLInputElement>("#verticalPosition").value),
    apiKeys: {
      azureKey: value("#azureKey"),
      azureRegion: value("#azureRegion"),
      googleApiKey: value("#googleApiKey"),
      deeplApiKey: value("#deeplApiKey"),
      papagoClientId: value("#papagoClientId"),
      papagoClientSecret: value("#papagoClientSecret"),
      awsAccessKeyId: value("#awsAccessKeyId"),
      awsSecretAccessKey: value("#awsSecretAccessKey"),
      awsRegion: value("#awsRegion") || "us-east-1",
      libreTranslateEndpoint: value("#libreTranslateEndpoint") || "https://libretranslate.com",
      libreTranslateApiKey: value("#libreTranslateApiKey")
    }
  };

  await setSettings(next);
  status.textContent = "저장했습니다.";
  setTimeout(() => {
    status.textContent = "";
  }, 1800);
}

function value(selector: string): string {
  return query<HTMLInputElement>(selector).value.trim();
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`${selector} 요소를 찾지 못했습니다.`);
  }
  return element;
}
