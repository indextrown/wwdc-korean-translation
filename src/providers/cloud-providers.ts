import type { ApiKeys, TranslateProviderId } from "../shared/types";

export async function translateViaCloudProvider(input: {
  provider: TranslateProviderId;
  texts: string[];
  sourceLanguage: "en" | "auto";
  targetLanguage: "ko";
  apiKeys: ApiKeys;
}): Promise<string[]> {
  switch (input.provider) {
    case "azure_translator":
      return translateAzure(input.texts, input.sourceLanguage, input.targetLanguage, input.apiKeys);
    case "google_cloud":
      return translateGoogle(input.texts, input.sourceLanguage, input.targetLanguage, input.apiKeys);
    case "deepl":
      return translateDeepL(input.texts, input.sourceLanguage, input.targetLanguage, input.apiKeys);
    case "papago":
      return translatePapago(input.texts, input.sourceLanguage, input.targetLanguage, input.apiKeys);
    case "aws_translate":
      return translateAws(input.texts, input.sourceLanguage, input.targetLanguage, input.apiKeys);
    case "libretranslate":
      return translateLibreTranslate(input.texts, input.sourceLanguage, input.targetLanguage, input.apiKeys);
    case "chrome_builtin":
      throw new Error("Chrome 내장 번역은 content script에서 처리합니다.");
    default:
      assertNever(input.provider);
  }
}

async function translateAzure(
  texts: string[],
  sourceLanguage: "en" | "auto",
  targetLanguage: "ko",
  apiKeys: ApiKeys
): Promise<string[]> {
  requireValue(apiKeys.azureKey, "Azure API 키가 필요합니다.");
  const params = new URLSearchParams({
    "api-version": "3.0",
    to: targetLanguage
  });
  if (sourceLanguage !== "auto") {
    params.set("from", sourceLanguage);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Ocp-Apim-Subscription-Key": apiKeys.azureKey
  };
  if (apiKeys.azureRegion) {
    headers["Ocp-Apim-Subscription-Region"] = apiKeys.azureRegion;
  }

  const response = await fetch(`https://api.cognitive.microsofttranslator.com/translate?${params}`, {
    method: "POST",
    headers,
    body: JSON.stringify(texts.map((text) => ({ text })))
  });
  const json = await parseJson(response);
  return json.map((item: { translations?: Array<{ text?: string }> }) => item.translations?.[0]?.text ?? "");
}

async function translateGoogle(
  texts: string[],
  sourceLanguage: "en" | "auto",
  targetLanguage: "ko",
  apiKeys: ApiKeys
): Promise<string[]> {
  requireValue(apiKeys.googleApiKey, "Google Cloud Translation API 키가 필요합니다.");
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKeys.googleApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texts,
        source: sourceLanguage === "auto" ? undefined : sourceLanguage,
        target: targetLanguage,
        format: "text"
      })
    }
  );
  const json = await parseJson(response);
  const translations = json.data?.translations;
  if (!Array.isArray(translations)) {
    throw new Error("Google Cloud Translation 응답 형식이 올바르지 않습니다.");
  }
  return translations.map((item: { translatedText?: string }) => decodeHtml(item.translatedText ?? ""));
}

async function translateDeepL(
  texts: string[],
  sourceLanguage: "en" | "auto",
  targetLanguage: "ko",
  apiKeys: ApiKeys
): Promise<string[]> {
  requireValue(apiKeys.deeplApiKey, "DeepL API 키가 필요합니다.");
  const host = apiKeys.deeplApiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const body = new URLSearchParams();
  for (const text of texts) {
    body.append("text", text);
  }
  if (sourceLanguage !== "auto") {
    body.set("source_lang", sourceLanguage.toUpperCase());
  }
  body.set("target_lang", targetLanguage.toUpperCase());

  const response = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKeys.deeplApiKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const json = await parseJson(response);
  if (!Array.isArray(json.translations)) {
    throw new Error("DeepL 응답 형식이 올바르지 않습니다.");
  }
  return json.translations.map((item: { text?: string }) => item.text ?? "");
}

async function translatePapago(
  texts: string[],
  sourceLanguage: "en" | "auto",
  targetLanguage: "ko",
  apiKeys: ApiKeys
): Promise<string[]> {
  requireValue(apiKeys.papagoClientId, "Papago Client ID가 필요합니다.");
  requireValue(apiKeys.papagoClientSecret, "Papago Client Secret이 필요합니다.");

  const translations: string[] = [];
  for (const text of texts) {
    const body = new URLSearchParams({
      source: sourceLanguage === "auto" ? "en" : sourceLanguage,
      target: targetLanguage,
      text
    });
    const response = await fetch("https://papago.apigw.ntruss.com/nmt/v1/translation", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-NCP-APIGW-API-KEY-ID": apiKeys.papagoClientId,
        "X-NCP-APIGW-API-KEY": apiKeys.papagoClientSecret
      },
      body
    });
    const json = await parseJson(response);
    translations.push(json.message?.result?.translatedText ?? "");
  }
  return translations;
}

async function translateLibreTranslate(
  texts: string[],
  sourceLanguage: "en" | "auto",
  targetLanguage: "ko",
  apiKeys: ApiKeys
): Promise<string[]> {
  const endpoint = apiKeys.libreTranslateEndpoint.replace(/\/+$/, "");
  requireValue(endpoint, "LibreTranslate endpoint가 필요합니다.");

  const translations: string[] = [];
  for (const text of texts) {
    const response = await fetch(`${endpoint}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: "text",
        api_key: apiKeys.libreTranslateApiKey || undefined
      })
    });
    const json = await parseJson(response);
    translations.push(json.translatedText ?? "");
  }
  return translations;
}

async function translateAws(
  texts: string[],
  sourceLanguage: "en" | "auto",
  targetLanguage: "ko",
  apiKeys: ApiKeys
): Promise<string[]> {
  requireValue(apiKeys.awsAccessKeyId, "AWS Access Key ID가 필요합니다.");
  requireValue(apiKeys.awsSecretAccessKey, "AWS Secret Access Key가 필요합니다.");
  requireValue(apiKeys.awsRegion, "AWS region이 필요합니다.");

  const translations: string[] = [];
  for (const text of texts) {
    const body = JSON.stringify({
      Text: text,
      SourceLanguageCode: sourceLanguage === "auto" ? "auto" : sourceLanguage,
      TargetLanguageCode: targetLanguage
    });
    const response = await signedAwsJsonRequest({
      accessKeyId: apiKeys.awsAccessKeyId,
      secretAccessKey: apiKeys.awsSecretAccessKey,
      region: apiKeys.awsRegion,
      body
    });
    const json = await parseJson(response);
    translations.push(json.TranslatedText ?? "");
  }
  return translations;
}

async function signedAwsJsonRequest(input: {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  body: string;
}): Promise<Response> {
  const service = "translate";
  const host = `${service}.${input.region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(input.body);
  const canonicalHeaders =
    `content-type:application/x-amz-json-1.1\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:AWSShineFrontendService_20170701.TranslateText\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${input.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = await getAwsSigningKey(input.secretAccessKey, dateStamp, input.region, service);
  const signature = await hmacHex(signingKey, stringToSign);
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Date": amzDate,
      "X-Amz-Target": "AWSShineFrontendService_20170701.TranslateText"
    },
    body: input.body
  });
}

async function getAwsSigningKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacBytes(toArrayBuffer(new TextEncoder().encode(`AWS4${secret}`)), dateStamp);
  const kRegion = await hmacBytes(kDate, region);
  const kService = await hmacBytes(kRegion, service);
  return hmacBytes(kService, "aws4_request");
}

async function hmacBytes(keyBytes: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

async function hmacHex(keyBytes: ArrayBuffer, message: string): Promise<string> {
  const signature = await hmacBytes(keyBytes, message);
  return bytesToHex(new Uint8Array(signature));
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function parseJson(response: Response): Promise<any> {
  const text = await response.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!response.ok) {
    const message =
      json.error?.message ??
      json.message ??
      json.Message ??
      `${response.status} ${response.statusText}`;
    throw new Error(String(message));
  }

  return json;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function requireValue(value: string, message: string): void {
  if (!value.trim()) {
    throw new Error(message);
  }
}

function assertNever(value: never): never {
  throw new Error(`지원하지 않는 provider입니다: ${String(value)}`);
}
