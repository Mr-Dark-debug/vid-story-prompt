import { Link } from "@tanstack/react-router";
import { brand } from "../../config/brand";
import { cn } from "../../lib/utils";

export type LogoTone = "dark" | "light" | "current";
export type LogoVariant = "lockup" | "mark";
export type LogoSize = "sm" | "md" | "lg";

const toneClasses: Record<LogoTone, string> = {
  dark: "text-brand-charcoal",
  light: "text-white",
  current: "text-current",
};

const sizeClasses: Record<LogoSize, { mark: string; wordmark: string; descriptor: string }> = {
  sm: { mark: "h-6 w-6", wordmark: "text-base", descriptor: "text-[0.34rem]" },
  md: { mark: "h-8 w-8", wordmark: "text-[1.28rem]", descriptor: "text-[0.39rem]" },
  lg: { mark: "h-14 w-14", wordmark: "text-3xl", descriptor: "text-[0.55rem]" },
};

/**
 * Clean vector translation of the supplied Vidrial symbol.
 * The designer PNG references in docs/ contain baked checkerboards and must
 * not be used directly in the product UI.
 */
export function LogoMark({ className, tone = "current" }: { className?: string; tone?: LogoTone }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("block shrink-0", toneClasses[tone], className)}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d="M10 15 50 55v30H10V15Z" />
      <path fill="currentColor" d="M58 15c17.67 0 32 14.33 32 32v38h-3L58 58h10V47H58V15Z" />
    </svg>
  );
}

export function Logo({
  className,
  to = "/",
  tone = "dark",
  variant = "lockup",
  size = "md",
  showTagline = false,
}: {
  className?: string;
  to?: "/" | "/app";
  tone?: Exclude<LogoTone, "current">;
  variant?: LogoVariant;
  size?: LogoSize;
  showTagline?: boolean;
}) {
  const markOnly = variant === "mark";
  const dimensions = sizeClasses[size];

  return (
    <Link
      to={to}
      className={cn(
        "inline-flex shrink-0 touch-manipulation items-center rounded-sm transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-4",
        !markOnly && "gap-2.5",
        toneClasses[tone],
        className,
      )}
      aria-label={`${brand.name} home`}
    >
      <LogoMark className={dimensions.mark} />
      {!markOnly ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn("font-display font-extrabold tracking-[-0.055em]", dimensions.wordmark)}
            translate="no"
          >
            {brand.name}
          </span>
          {showTagline ? (
            <span
              className={cn(
                "mt-1 font-bold uppercase tracking-[0.17em] opacity-75",
                dimensions.descriptor,
              )}
            >
              {brand.descriptor}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  );
}
