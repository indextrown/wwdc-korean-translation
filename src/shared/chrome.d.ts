declare global {
  interface ChromeStorageArea {
    get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    onChanged?: never;
  }

  interface ChromeStorageChange {
    oldValue?: unknown;
    newValue?: unknown;
  }

  interface ChromeRuntime {
    sendMessage<TResponse = unknown>(message: unknown): Promise<TResponse>;
    onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ): void;
    };
    openOptionsPage(): void;
  }

  interface ChromeTabs {
    create(options: { url: string }): Promise<unknown>;
    query(options: { active?: boolean; currentWindow?: boolean }): Promise<Array<{ id?: number }>>;
    sendMessage<TResponse = unknown>(tabId: number, message: unknown): Promise<TResponse>;
  }

  interface ChromeApi {
    storage: {
      local: ChromeStorageArea;
      onChanged: {
        addListener(
          callback: (changes: Record<string, ChromeStorageChange>, areaName: "sync" | "local" | "managed" | "session") => void
        ): void;
      };
    };
    runtime: ChromeRuntime;
    commands: {
      onCommand: {
        addListener(callback: (command: string) => void): void;
      };
    };
    tabs?: ChromeTabs;
  }

  const chrome: ChromeApi;

  interface BuiltInTranslator {
    translate(text: string): Promise<string>;
    translateStreaming?(text: string): ReadableStream<string>;
  }

  interface BuiltInTranslatorConstructor {
    availability(options: {
      sourceLanguage: string;
      targetLanguage: string;
    }): Promise<"unavailable" | "downloadable" | "downloading" | "available">;
    create(options: {
      sourceLanguage: string;
      targetLanguage: string;
      monitor?: (monitor: EventTarget) => void;
    }): Promise<BuiltInTranslator>;
  }

  interface Window {
    Translator?: BuiltInTranslatorConstructor;
  }

  var Translator: BuiltInTranslatorConstructor | undefined;
}

export {};
