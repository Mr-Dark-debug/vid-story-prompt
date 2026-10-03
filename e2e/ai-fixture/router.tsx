// Minimal stand-ins for the router APIs the AI components use. Only the dedicated localhost Vite
// test server imports this file.
import type { AnchorHTMLAttributes, ReactNode } from "react";

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
  return (
    <a href={`#${href}`} {...props}>
      {children}
    </a>
  );
}
export const useRouter = () => ({ invalidate: async () => undefined });
export const useNavigate = () => async () => undefined;
