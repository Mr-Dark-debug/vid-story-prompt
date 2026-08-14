const providerAccessCodes = new Set([
  "provider_auth_challenge",
  "provider_rate_limited",
  "provider_temporary_failure",
  "video_restricted",
]);

const unavailableSourceCodes = new Set([
  "video_private",
  "video_age_restricted",
  "video_region_restricted",
  "video_unavailable",
]);

export function sourceRecoveryMessage(errorCode: string | null | undefined, fallback?: string | null) {
  if (errorCode && providerAccessCodes.has(errorCode)) {
    return "The source provider did not allow an automatic import after every safe connection option was tried. Attach an authorised original below to resume this same job without losing your clip settings.";
  }
  if (errorCode && unavailableSourceCodes.has(errorCode)) {
    return "This source cannot be imported automatically because its privacy, age, region, or availability settings are not supported. Attach an authorised original below to continue this same job.";
  }
  return fallback ?? null;
}
