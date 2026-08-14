import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BlogHeading } from "@/features/blog/schema";

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return textFromChildren((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function ArticleBody({ body, headings }: { body: string; headings: BlogHeading[] }) {
  let headingIndex = 0;

  const heading = (Tag: "h2" | "h3" | "h4" | "h5" | "h6") =>
    function MarkdownHeading({ children, ...props }: ComponentPropsWithoutRef<typeof Tag>) {
      const current = headings[headingIndex++];
      return (
        <Tag id={current?.id} {...props}>
          {children}
          {current?.id && (
            <a
              href={`#${current.id}`}
              className="heading-anchor"
              aria-label={`Link to ${textFromChildren(children)}`}
            >
              #
            </a>
          )}
        </Tag>
      );
    };

  return (
    <div className="blog-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          h2: heading("h2"),
          h3: heading("h3"),
          h4: heading("h4"),
          h5: heading("h5"),
          h6: heading("h6"),
          img: () => null,
          table: ({ children }) => (
            <div className="blog-table-wrap" tabIndex={0} role="region" aria-label="Scrollable table">
              <table>{children}</table>
            </div>
          ),
          a: ({ href, children }) => {
            const external = href?.startsWith("http://") || href?.startsWith("https://");
            return (
              <a href={href} rel={external ? "noreferrer noopener" : undefined}>
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
