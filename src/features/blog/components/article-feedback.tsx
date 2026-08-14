import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { submitBlogFeedback, type BlogFeedbackInput } from "@/services/blog-feedback/server";
import { cn } from "@/lib/utils";
import { trackBlogEvent } from "./blog-analytics";

const SESSION_KEY = "vidrial.blog.feedback-session.v1";

function feedbackSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, value);
  return value;
}

export function ArticleFeedback({ slug }: { slug: string }) {
  const [vote, setVote] = useState<BlogFeedbackInput["vote"]>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function submit(nextVote: BlogFeedbackInput["vote"]) {
    setPending(true);
    setMessage(undefined);
    try {
      await submitBlogFeedback({
        data: { slug, vote: nextVote, anonymousSessionId: feedbackSessionId() },
      });
      setVote(nextVote);
      setMessage("Thanks. Your answer helps us improve this guide.");
      trackBlogEvent(nextVote === "helpful" ? "blog_helpful" : "blog_not_helpful", { slug });
    } catch {
      setMessage("Your answer could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-14 border-y border-line py-7" aria-labelledby="article-feedback-title">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <h2 id="article-feedback-title" className="font-display text-xl font-semibold text-ink">
            Was this helpful?
          </h2>
          <p className="mt-1 text-sm text-ink-mute">One tap. No public profile or comment required.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => submit("helpful")}
            disabled={pending}
            aria-pressed={vote === "helpful"}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:cursor-wait disabled:opacity-60",
              vote === "helpful" && "border-ink bg-ink text-surface-page hover:bg-ink",
            )}
          >
            <ThumbsUp className="h-4 w-4" aria-hidden /> Yes
          </button>
          <button
            type="button"
            onClick={() => submit("not_helpful")}
            disabled={pending}
            aria-pressed={vote === "not_helpful"}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:cursor-wait disabled:opacity-60",
              vote === "not_helpful" && "border-ink bg-ink text-surface-page hover:bg-ink",
            )}
          >
            <ThumbsDown className="h-4 w-4" aria-hidden /> No
          </button>
        </div>
      </div>
      {message && (
        <p className="mt-4 text-sm text-ink-soft" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
