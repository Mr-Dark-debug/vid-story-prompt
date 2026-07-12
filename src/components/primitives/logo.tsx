import { Link } from "@tanstack/react-router";
import { brand } from "@/config/brand";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <rect x="1" y="6" width="30" height="20" rx="5" fill="var(--ember)" />
      <rect x="4" y="9" width="6" height="14" rx="1.5" fill="var(--surface-page)" opacity="0.9" />
      <rect x="13" y="9" width="6" height="14" rx="1.5" fill="var(--surface-page)" opacity="0.6" />
      <rect x="22" y="9" width="6" height="14" rx="1.5" fill="var(--surface-page)" opacity="0.35" />
      <rect x="15.4" y="3" width="1.2" height="26" rx="0.6" fill="var(--ink)" />
      <circle cx="16" cy="3.6" r="1.8" fill="var(--ink)" />
    </svg>
  );
}

export function Logo({ className = "", to = "/" }: { className?: string; to?: "/" | "/app" }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label={`${brand.name} home`}
    >
      <LogoMark className="h-7 w-7" />
      <span className="font-display text-[1.15rem] font-semibold tracking-tight text-ink">
        {brand.name}
      </span>
    </Link>
  );
}
