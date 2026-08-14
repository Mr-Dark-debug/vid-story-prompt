import { Check, Copy, Linkedin, Mail, Share2 } from "lucide-react";
import { useState, type ComponentType } from "react";
import { FaRedditAlien, FaXTwitter } from "react-icons/fa6";
import { trackBlogEvent } from "./blog-analytics";

type ShareMethod = "linkedin" | "x" | "reddit" | "email";

function shareUrl(method: ShareMethod, url: string, title: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const targets = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    x: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`,
    reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
  } as const;
  return targets[method];
}

export function ArticleShare({ title, canonicalUrl }: { title: string; canonicalUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: canonicalUrl });
        trackBlogEvent("blog_share", { method: "native" });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      trackBlogEvent("blog_copy_link", { method: "clipboard" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this article link", canonicalUrl);
    }
  }

  const items: Array<{
    method: ShareMethod;
    label: string;
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  }> = [
    { method: "linkedin", label: "LinkedIn", icon: Linkedin },
    { method: "x", label: "X", icon: FaXTwitter },
    { method: "reddit", label: "Reddit", icon: FaRedditAlien },
    { method: "email", label: "Email", icon: Mail },
  ];

  return (
    <div>
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-mute">
        Share
      </div>
      <div
        className="mt-3 flex flex-wrap gap-1.5 lg:grid lg:grid-cols-2"
        role="group"
        aria-label="Share this article"
      >
        <button type="button" onClick={share} className="article-tool" aria-label="Share article">
          <Share2 className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={copy} className="article-tool" aria-label="Copy article link">
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        </button>
        {items.map(({ method, label, icon: Icon }) => (
          <a
            key={method}
            className="article-tool"
            href={shareUrl(method, canonicalUrl, title)}
            target={method === "email" ? undefined : "_blank"}
            rel={method === "email" ? undefined : "noreferrer noopener"}
            aria-label={`Share on ${label}`}
            onClick={() => trackBlogEvent("blog_share", { method })}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </a>
        ))}
      </div>
    </div>
  );
}
