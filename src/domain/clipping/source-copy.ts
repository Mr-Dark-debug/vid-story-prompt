const recovery =
  "Attach an authorised original below to resume this same job without losing your clip settings.";

const reasons: Record<string, string> = {
  provider_auth_challenge:
    "YouTube requested a sign-in or anti-bot check from the server. Connecting your YouTube account does not unlock this download.",
  provider_access_denied:
    "YouTube rejected this media request (HTTP 403). The precise cause is not confirmed.",
  provider_rate_limited:
    "YouTube temporarily limited the number of requests from the worker. Automatic retries have stopped for this job.",
  provider_temporary_failure:
    "The source request timed out or the provider was temporarily unavailable. Automatic retries have stopped for this job.",
  provider_unknown_failure:
    "The source request failed for an unrecognized reason. A network block has not been confirmed.",
  video_restricted:
    "The source provider restricted this download; the precise restriction was not reported.",
  video_private: "This video is private and cannot be imported automatically.",
  video_age_restricted: "This video is age-restricted. Vidrial does not bypass age restrictions.",
  video_region_restricted:
    "This video is unavailable in the worker's region. Vidrial does not bypass geographic restrictions.",
  video_unavailable: "This video is unavailable or has been removed by its provider.",
  video_drm_protected: "This video is DRM-protected. Vidrial does not bypass copy protection.",
};

export function sourceRecoveryMessage(
  errorCode: string | null | undefined,
  fallback?: string | null,
) {
  if (errorCode && Object.hasOwn(reasons, errorCode)) return `${reasons[errorCode]} ${recovery}`;
  return fallback ?? null;
}
