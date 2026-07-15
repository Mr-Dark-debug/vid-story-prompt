import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { User } from "@/services/auth";

export function MarketingAccountActions({
  user,
  isLoading,
  mobile = false,
  onNavigate,
}: {
  user: User | null;
  isLoading: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Checking your account"
        className={cn("flex items-center gap-2", mobile && "mt-4 border-t border-line pt-4")}
      >
        <span className="h-9 w-9 animate-pulse rounded-full bg-surface-sunken" />
        <span className="h-10 flex-1 animate-pulse rounded-md bg-surface-sunken" />
      </div>
    );
  }

  if (user) {
    const initial = (user.name || user.email || "A").slice(0, 1).toUpperCase();
    return (
      <div className={cn("flex items-center gap-2", mobile && "mt-4 border-t border-line pt-4")}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar
            aria-label={`${user.name} profile`}
            className="h-9 w-9 border border-line bg-ember-soft"
          >
            {user.avatarUrl ? (
              <AvatarImage
                src={user.avatarUrl}
                alt={`${user.name} profile photo`}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <AvatarFallback className="bg-ember-soft text-sm text-ember-ink">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-40 truncate text-sm font-medium text-ink">{user.name}</span>
        </div>
        <Link
          to="/app"
          onClick={onNavigate}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-surface-page shadow-sm transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open workspace
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", mobile && "mt-4 border-t border-line pt-4")}>
      <Link
        to="/login"
        onClick={onNavigate}
        className={cn(
          "rounded-md px-3 py-2 text-sm text-ink-soft transition-colors hover:text-ink",
          mobile &&
            "inline-flex min-h-11 flex-1 items-center justify-center border border-line text-center text-ink",
        )}
      >
        Log in
      </Link>
      <Link
        to="/signup"
        onClick={onNavigate}
        className={cn(
          "inline-flex items-center rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-surface-page shadow-sm transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          mobile && "min-h-11 flex-1 justify-center text-center",
        )}
      >
        Start editing
      </Link>
    </div>
  );
}
