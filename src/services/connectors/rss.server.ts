import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { isIP } from "node:net";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MEDIA_TYPES = /^(audio|video)\//i;

export type PodcastEpisode = {
  id: string;
  title: string;
  description: string;
  artworkUrl: string | null;
  enclosureUrl: string;
  enclosureType: string | null;
  enclosureBytes: number | null;
  durationSeconds: number | null;
  publishedAt: string | null;
};

function isForbiddenAddress(address: string) {
  if (["0.0.0.0", "::", "::1"].includes(address)) return true;
  if (address.includes(":")) {
    const value = address.toLowerCase();
    return (
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      /^fe[89ab]/.test(value) ||
      value.startsWith("::ffff:127.") ||
      value.startsWith("::ffff:10.") ||
      value.startsWith("::ffff:192.168.")
    );
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

async function resolvePublic(hostname: string) {
  if (isIP(hostname) && isForbiddenAddress(hostname))
    throw new Error("Podcast URLs cannot resolve to private or reserved networks.");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address)))
    throw new Error("Podcast URLs cannot resolve to private or reserved networks.");
  return addresses[0];
}

async function readPublicHttps(
  input: string,
  redirects = 0,
): Promise<{ body: string; finalUrl: string }> {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Podcast feeds must use HTTPS and cannot contain credentials.");
  const resolved = await resolvePublic(url.hostname);
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        timeout: 10_000,
        headers: {
          accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
        },
        lookup: (_hostname, _options, callback) =>
          callback(null, resolved.address, resolved.family),
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          if (redirects >= 4)
            return reject(new Error("The podcast feed exceeded the redirect limit."));
          return void readPublicHttps(
            new URL(response.headers.location, url).toString(),
            redirects + 1,
          ).then(resolve, reject);
        }
        if (response.statusCode !== 200) {
          response.resume();
          return reject(
            new Error(`The podcast feed returned ${response.statusCode ?? "no status"}.`),
          );
        }
        const declared = Number(response.headers["content-length"] ?? 0);
        if (declared > MAX_FEED_BYTES) {
          response.destroy();
          return reject(new Error("The podcast feed is larger than the safe parsing limit."));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.setTimeout(15_000, () =>
          response.destroy(new Error("Podcast feed read timed out.")),
        );
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_FEED_BYTES)
            response.destroy(new Error("The podcast feed is larger than the safe parsing limit."));
          else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({ body: Buffer.concat(chunks).toString("utf8"), finalUrl: url.toString() }),
        );
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("Podcast feed connection timed out.")));
    request.on("error", reject);
  });
}

function text(xml: string, names: string[]) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match)
      return decode(
        match[1]
          .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
          .replace(/<[^>]+>/g, " ")
          .trim(),
      );
  }
  return "";
}

function attribute(xml: string, element: string, name: string) {
  const match = xml.match(new RegExp(`<${element}\\b[^>]*\\b${name}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decode(match[1]) : null;
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function durationSeconds(value: string) {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN) || parts.length > 3) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function parsePodcastXml(xml: string, finalUrl: string) {
  if (!/<(?:rss|feed)\b/i.test(xml)) throw new Error("The URL did not return an RSS or Atom feed.");
  const channel = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i)?.[1] ?? xml;
  const itemPattern = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const artworkUrl =
    attribute(channel, "itunes:image", "href") ??
    attribute(channel, "image", "href") ??
    text(channel, ["image>\\s*<url"]);
  const episodes: PodcastEpisode[] = [];
  for (const match of channel.matchAll(itemPattern)) {
    const item = match[2];
    const enclosureUrl =
      attribute(item, "enclosure", "url") ??
      attribute(item, "link[^>]*rel=[\"']enclosure[\"']", "href");
    const enclosureType =
      attribute(item, "enclosure", "type") ??
      attribute(item, "link[^>]*rel=[\"']enclosure[\"']", "type");
    if (!enclosureUrl || (enclosureType && !MEDIA_TYPES.test(enclosureType))) continue;
    let parsedEnclosure: URL;
    try {
      parsedEnclosure = new URL(enclosureUrl, finalUrl);
    } catch {
      continue;
    }
    if (parsedEnclosure.protocol !== "https:") continue;
    const title = text(item, ["title"]) || "Untitled episode";
    const published = text(item, ["pubDate", "published", "updated"]);
    const parsedPublished =
      published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null;
    const guid = text(item, ["guid", "id"]) || parsedEnclosure.toString();
    episodes.push({
      id: guid.slice(0, 500),
      title: title.slice(0, 500),
      description: text(item, ["itunes:summary", "description", "summary", "content"]).slice(
        0,
        2000,
      ),
      artworkUrl: attribute(item, "itunes:image", "href") ?? artworkUrl ?? null,
      enclosureUrl: parsedEnclosure.toString(),
      enclosureType,
      enclosureBytes: Number(attribute(item, "enclosure", "length")) || null,
      durationSeconds: durationSeconds(text(item, ["itunes:duration", "duration"])),
      publishedAt: parsedPublished,
    });
  }
  if (!episodes.length)
    throw new Error("No public audio or video enclosures were found in this feed.");
  return {
    title: text(channel, ["title"]) || new URL(finalUrl).hostname,
    description: text(channel, ["description", "subtitle"]).slice(0, 2000),
    artworkUrl: artworkUrl ?? null,
    feedUrl: finalUrl,
    episodes: episodes.slice(0, 100),
  };
}

async function resolveApplePodcastUrl(input: string) {
  const url = new URL(input);
  if (!/(^|\.)podcasts\.apple\.com$/i.test(url.hostname)) return input;
  const id = url.pathname.match(/\/id(\d+)/)?.[1];
  if (!id) throw new Error("The Apple Podcasts link does not contain a podcast identifier.");
  const response = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=podcast`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Apple Podcasts could not resolve the public feed.");
  const payload = z
    .object({ results: z.array(z.object({ feedUrl: z.string().url().optional() })) })
    .parse(await response.json());
  const feedUrl = payload.results.find((item) => item.feedUrl)?.feedUrl;
  if (!feedUrl) throw new Error("This Apple Podcasts page does not expose a public RSS feed.");
  return feedUrl;
}

export const resolvePodcastFeed = createServerFn({ method: "POST" })
  .validator(z.object({ url: z.string().url().max(2048) }))
  .handler(async ({ data }) => {
    const feedUrl = await resolveApplePodcastUrl(data.url);
    const response = await readPublicHttps(feedUrl);
    return parsePodcastXml(response.body, response.finalUrl);
  });
