// Minimal stand-ins for the router APIs the AI components use. Only the dedicated localhost Vite
// test server imports this file.
import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";

export function Link({
  to,
  params,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
  params?: Record<string, string>;
  children?: ReactNode;
}) {
  const href = params ? to.replace("$threadId", params.threadId) : to;
  return createElement("a", { href: `#${href}`, ...props }, children);
}
export const useRouter = () => ({ invalidate: async () => undefined });
export const useNavigate = () => async () => undefined;
