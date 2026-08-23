export const CONSENT_STORAGE_KEY = "vidrial.consent.v1";
export const CONSENT_CHANGED_EVENT = "vidrial:consent-changed";
export const CONSENT_SETTINGS_EVENT = "vidrial:open-consent-settings";

export type ConsentPreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  at?: number;
};

export function readConsent(storage: Pick<Storage, "getItem"> | undefined) {
  if (!storage) return null;
  try {
    const value = JSON.parse(
      storage.getItem(CONSENT_STORAGE_KEY) ?? "null",
    ) as Partial<ConsentPreferences> | null;
    if (!value || value.necessary !== true) return null;
    return {
      necessary: true as const,
      analytics: value.analytics === true,
      marketing: value.marketing === true,
      at: typeof value.at === "number" ? value.at : undefined,
    };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(storage: Pick<Storage, "getItem"> | undefined) {
  return readConsent(storage)?.analytics === true;
}
