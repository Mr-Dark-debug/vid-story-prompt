import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogArticleMeta } from "@/features/blog/schema";
import { ArticleBody } from "./article-body";
import { ArticleShare } from "./article-share";
import { ArticleSummary } from "./article-summary";
import { BlogIndex } from "./blog-index";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const base: BlogArticleMeta = {
  title: "How to make one useful short clip",
  slug: "make-one-useful-short-clip",
  description: "A direct workflow for choosing and editing one complete short-form moment.",
  category: "AI video clipping",
  primaryKeyword: "useful short clip",
  secondaryKeywords: ["clip workflow"],
  searchIntent: "informational",
  author: "Vidrial Editorial Team",
  publishedAt: "2026-07-31",
  updatedAt: "2026-07-31",
  reviewedAt: "2026-07-31",
  readingTime: 8,
  aiSummary: ["Start with a complete thought.", "Check the opening without context.", "Edit the ending by ear."],
  sources: [],
  related: [],
  faqs: [],
  draft: false,
  reviewStatus: "PASS",
  featured: true,
  canonicalPath: "/blog/make-one-useful-short-clip",
  wordCount: 1500,
  headings: [{ level: 2, text: "Choose a complete moment", id: "choose-a-complete-moment" }],
  excerpt: "Choose a moment that makes sense without the full recording.",
};

describe("blog components", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("filters the index with a useful empty state", () => {
    render(
      <BlogIndex
        articles={[
          base,
          {
            ...base,
            title: "Caption timing without guesswork",
            slug: "caption-timing-without-guesswork",
            description: "A caption synchronization guide.",
            category: "Captions",
            primaryKeyword: "caption synchronization",
            featured: false,
          },
        ]}
      />,
    );

    const search = screen.getByRole("searchbox", { name: "Search articles" });
    fireEvent.change(search, { target: { value: "caption" } });
    expect(screen.getAllByText("Caption timing without guesswork").length).toBeGreaterThan(0);
    expect(screen.queryByText("How to make one useful short clip")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "something absent" } });
    expect(screen.getByText("No matching guide yet.")).toBeInTheDocument();
  });

  it("renders safe Markdown headings but no inline images or raw HTML", () => {
    const { container } = render(
      <ArticleBody
        body={"## Choose a complete moment\n\nUseful copy.\n\n![stock image](https://example.com/image.jpg)\n\n<div>hidden html</div>"}
        headings={base.headings}
      />,
    );
    expect(screen.getByRole("heading", { name: /Choose a complete moment/ })).toHaveAttribute(
      "id",
      "choose-a-complete-moment",
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("hidden html")).not.toBeInTheDocument();
  });

  it("uses the required authored-summary explanation", () => {
    render(<ArticleSummary items={base.aiSummary} />);
    expect(
      screen.getByText(
        "A concise summary of the article. Read the full guide for context and sources.",
      ),
    ).toBeInTheDocument();
  });

  it("copies the canonical URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(
      <ArticleShare
        title="How to make one useful short clip"
        canonicalUrl="https://vidrial.vercel.app/blog/make-one-useful-short-clip"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy article link" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://vidrial.vercel.app/blog/make-one-useful-short-clip",
      ),
    );
  });
});
