import type { ConnectorAvailability } from "./types";
import { getConnector } from "./registry";

export type DetectedSource = {
  connectorId: string;
  valid: boolean;
  metadataCapability: boolean;
  mediaImportCapability: boolean;
  authenticationRequired: boolean;
  originalFileRequired: boolean;
  availability: ConnectorAvailability;
  kind: "platform" | "feed" | "direct_media" | "hls" | "unknown";
};

const hostMatches = (host: string, domains: string[]) =>
  domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

export function detectUrlSource(value: string): DetectedSource {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return result("other", false, "unknown");
  }
  if (url.protocol !== "https:") return result("other", false, "unknown");
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (hostMatches(host, ["youtube.com", "youtu.be"])) return result("youtube", true, "platform");
  if (hostMatches(host, ["vimeo.com"])) return result("vimeo", true, "platform");
  if (hostMatches(host, ["drive.google.com", "docs.google.com"]))
    return result("google_drive", true, "platform");
  if (hostMatches(host, ["dropbox.com", "dropboxusercontent.com"]))
    return result("dropbox", true, "platform");
  if (hostMatches(host, ["1drv.ms", "onedrive.live.com", "sharepoint.com"]))
    return result("onedrive", true, "platform");
  if (hostMatches(host, ["loom.com"])) return result("loom", true, "platform");
  if (hostMatches(host, ["zoom.us"])) return result("zoom", true, "platform");
  if (hostMatches(host, ["frame.io"])) return result("frameio", true, "platform");
  if (hostMatches(host, ["riverside.fm"])) return result("riverside", true, "platform");
  if (/\.(rss|atom|xml)$/.test(path) || path.includes("/feed")) return result("rss", true, "feed");
  if (/\.(m3u8)$/.test(path)) return result("direct_url", true, "hls");
  if (/\.(mp4|mov|webm|m4v|mp3|wav|m4a)(?:$|\/)/.test(path))
    return result("direct_url", true, "direct_media");
  return result("other", true, "unknown");
}

function result(connectorId: string, valid: boolean, kind: DetectedSource["kind"]): DetectedSource {
  const connector = getConnector(connectorId) ?? getConnector("other")!;
  return {
    connectorId: connector.id,
    valid,
    metadataCapability: connector.capabilities.includes("metadata"),
    mediaImportCapability: connector.capabilities.includes("download_original"),
    authenticationRequired: connector.authentication !== "none",
    originalFileRequired: connector.requiresOriginalSource,
    availability: connector.availability,
    kind,
  };
}
