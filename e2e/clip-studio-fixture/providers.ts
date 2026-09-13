// Only the dedicated localhost Vite test server imports these replacements.
// Unused providers throw rather than pretending their integration works.
const unsupported = async () => {
  throw new Error("Provider not part of this UI fixture");
};
export const attachSourceToAutomationDraft = unsupported;
export const resolvePodcastFeed = unsupported;
export const browseConnectorAssets = unsupported;
export const cancelConnectorImport = unsupported;
export const createConnectorImport = unsupported;
export const getConnectorImportProgress = unsupported;
export const prepareSourceUpload = unsupported;
export const completeSourceUpload = unsupported;
export const startResumableUpload = unsupported;
export const joinConnectorWaitlist = unsupported;
export const trackAnalyticsEvent = () => undefined;
export const getWorkerEgressHealth = async () => ({
  status: "unknown",
  checkedAt: new Date().toISOString(),
  message: "UI fixture; worker not contacted.",
});
export const getYouTubeMetadata = async () => ({
  videoId: "dQw4w9WgXcQ",
  title: "Synthetic metadata fixture",
  channelTitle: "Test fixture",
  channelId: "fixture",
  durationSeconds: 600,
  thumbnailUrl: null,
  embeddable: true,
});
export const createClipJob = async ({ data }: { data: unknown }) => {
  window.dispatchEvent(new CustomEvent("fixture:submitted", { detail: data }));
  return { jobId: "10000000-0000-4000-8000-000000000001", workerWake: "not_configured" };
};
