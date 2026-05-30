export type TranslateProviderId =
  | "chrome_builtin"
  | "azure_translator"
  | "google_cloud"
  | "deepl"
  | "papago"
  | "aws_translate"
  | "libretranslate";

export type SubtitleMode = "ko_en" | "ko_only" | "en_only";
export type SubtitleLineOrder = "ko_above" | "ko_below";

export interface ApiKeys {
  azureKey: string;
  azureRegion: string;
  googleApiKey: string;
  deeplApiKey: string;
  papagoClientId: string;
  papagoClientSecret: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  libreTranslateEndpoint: string;
  libreTranslateApiKey: string;
}

export interface ExtensionSettings {
  enabled: boolean;
  provider: TranslateProviderId;
  subtitleMode: SubtitleMode;
  subtitleLineOrder: SubtitleLineOrder;
  fontScale: number;
  koreanFontScale: number;
  englishFontScale: number;
  verticalPosition: number;
  apiKeys: ApiKeys;
}

export interface SubtitleSegment {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface TranslateRequest {
  type: "translate";
  provider: TranslateProviderId;
  texts: string[];
  sourceLanguage: "en" | "auto";
  targetLanguage: "ko";
}

export interface TranslateResponse {
  ok: boolean;
  translations?: string[];
  error?: string;
}

export interface SettingsRequest {
  type: "get-settings" | "set-settings";
  settings?: ExtensionSettings;
}

export type RuntimeRequest = TranslateRequest | SettingsRequest;

export const defaultApiKeys: ApiKeys = {
  azureKey: "",
  azureRegion: "",
  googleApiKey: "",
  deeplApiKey: "",
  papagoClientId: "",
  papagoClientSecret: "",
  awsAccessKeyId: "",
  awsSecretAccessKey: "",
  awsRegion: "us-east-1",
  libreTranslateEndpoint: "https://libretranslate.com",
  libreTranslateApiKey: ""
};

export const defaultSettings: ExtensionSettings = {
  enabled: true,
  provider: "chrome_builtin",
  subtitleMode: "ko_en",
  subtitleLineOrder: "ko_above",
  fontScale: 1,
  koreanFontScale: 1,
  englishFontScale: 1,
  verticalPosition: 14,
  apiKeys: defaultApiKeys
};
