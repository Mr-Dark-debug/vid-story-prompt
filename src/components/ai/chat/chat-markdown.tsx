import { Check, Copy } from "lucide-react";
import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = isValidElement<{ className?: string; children?: ReactNode }>(children)
    ? children
    : null;
  const language = /language-([\w+-]+)/.exec(code?.props.className ?? "")?.[1];
  const text = textOf(code?.props.children ?? children).replace(/\n$/, "");

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-line bg-surface-sunken">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">
          {language ?? "text"}
        </span>
        <button
          type="button"
          className="inline-flex min-h-8 items-center gap-1.5 rounded px-2 text-xs text-ink-soft hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1_500);
            } else {
              toast.error("Copy is not available in this browser.");
            }
          }}
          aria-label={copied ? "Copied" : `Copy ${language ?? "code"}`}
        >
          {copied ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-6">
        <code className="font-mono text-ink">{text}</code>
      </pre>
    </div>
  );
}

/**
 * Renders model output as Markdown. Output is untrusted: raw HTML is dropped, images are never
 * loaded (a remote image URL is an exfiltration channel), and links open in a new tab without a
 * referrer.
 */
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="chat-markdown break-words text-[15px] leading-7 text-ink [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:text-ink-soft [&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => null,
          pre: ({ children: content }) => <CodeBlock>{content}</CodeBlock>,
          code: ({ className, children: content }) => (
            <code
              className={
                className
                  ? className
                  : "rounded bg-surface-sunken px-1 py-0.5 font-mono text-[0.9em] text-ink"
              }
            >
              {content}
            </code>
          ),
          a: ({ href, children: content }) => {
            const safe = href?.startsWith("https://") || href?.startsWith("http://");
            if (!safe) return <span>{content}</span>;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                referrerPolicy="no-referrer"
                className="font-medium text-ink underline underline-offset-2"
              >
                {content}
              </a>
            );
          },
          table: ({ children: content }) => (
            <div
              className="my-3 overflow-x-auto"
              role="region"
              tabIndex={0}
              aria-label="Scrollable table"
            >
              <table className="w-full border-collapse text-sm [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:bg-surface-sunken [&_th]:px-2 [&_th]:py-1 [&_th]:text-left">
                {content}
              </table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
