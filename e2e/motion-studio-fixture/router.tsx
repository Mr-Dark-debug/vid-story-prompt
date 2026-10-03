/* eslint-disable react-refresh/only-export-components -- Router boundary shim for Playwright fixtures. */
import type { ReactNode } from "react";
const router = {
  invalidate: async () => {
    window.dispatchEvent(new Event("motion-fixture:refresh"));
  },
};
export const useRouter = () => router;
export const useNavigate = () => async () => {
  window.dispatchEvent(new Event("motion-fixture:navigate"));
};
export const useRouterState = () => ({ location: { pathname: "/app/motion" } });
export const Outlet = () => null;
export const Link = ({
  children,
  to,
  ...props
}: {
  children?: ReactNode;
  to?: string;
  className?: string;
}) => (
  <a href={to} {...props}>
    {children}
  </a>
);
