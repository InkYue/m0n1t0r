const STORAGE_KEY = "m0n1t0r_settings";

interface Settings {
  backendUrl: string;
  skipSslCheck: boolean;
}

const defaults: Settings = {
  backendUrl: "",
  skipSslCheck: false,
};

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt data
  }
  return { ...defaults };
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function getApiBaseUrl(): string {
  const { backendUrl } = getSettings();
  if (backendUrl) return `${backendUrl.replace(/\/+$/, "")}/api/v1`;
  return import.meta.env.VITE_API_BASE_URL || "/api/v1";
}

export function getWsBaseUrl(path: string): string {
  const { backendUrl } = getSettings();
  if (backendUrl) {
    const base = backendUrl.replace(/\/+$/, "");
    const wsBase = base
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://");
    return `${wsBase}/api/v1/${path}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/api/v1/${path}`;
}
