import { AlertTriangle, Check, Clock3, Sparkles, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type StatusDialogVariant = "success" | "pending" | "warning" | "error" | "plan-limit";

const presentations: Record<
  StatusDialogVariant,
  { Icon: LucideIcon; iconClassName: string; glowClassName: string }
> = {
  success: {
    Icon: Check,
    iconClassName: "text-success",
    glowClassName: "bg-success/10",
  },
  pending: {
    Icon: Clock3,
    iconClassName: "text-ember-ink",
    glowClassName: "bg-ember/12",
  },
  warning: {
    Icon: AlertTriangle,
    iconClassName: "text-warning",
    glowClassName: "bg-warning/12",
  },
  error: {
    Icon: X,
    iconClassName: "text-danger",
    glowClassName: "bg-danger/10",
  },
  "plan-limit": {
    Icon: Sparkles,
    iconClassName: "text-ember-ink",
    glowClassName: "bg-ember/14",
  },
};

export function StatusDialog({
  open,
  onOpenChange,
  variant,
  title,
  description,
  detail,
  primaryAction,
  secondaryAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: StatusDialogVariant;
  title: string;
  description: string;
  detail?: ReactNode;
  primaryAction: { label: string; onClick?: () => void; href?: string; loading?: boolean };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
}) {
  const { Icon, iconClassName, glowClassName } = presentations[variant];
  const action = (spec: typeof primaryAction, style: "primary" | "secondary") => {
    const className = cn(
      "h-11 flex-1 rounded-full",
      style === "primary"
        ? "bg-ink text-surface-page hover:bg-ink/90"
        : "border-line bg-surface-sunken text-ink hover:bg-surface-raised",
    );
    if (spec.href) {
      return (
        <Button
          key={spec.label}
          asChild
          variant={style === "primary" ? "default" : "outline"}
          className={className}
        >
          <a href={spec.href}>{spec.label}</a>
        </Button>
      );
    }
    return (
      <Button
        key={spec.label}
        type="button"
        variant={style === "primary" ? "default" : "outline"}
        loading={spec.loading}
        onClick={() => {
          spec.onClick?.();
          if (!spec.loading) onOpenChange(false);
        }}
        className={className}
      >
        {spec.label}
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[1.75rem] border-line bg-surface-panel p-0 text-center shadow-[0_28px_90px_-34px_rgba(29,29,27,.45)] [&>button]:right-5 [&>button]:top-5">
        <div className="relative px-6 pb-7 pt-12 sm:px-8">
          <div
            className={cn(
              "pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full blur-3xl",
              glowClassName,
            )}
          />
          <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-full border border-line bg-surface-panel shadow-sm">
            <Icon aria-hidden className={cn("h-5 w-5", iconClassName)} />
          </div>
          <DialogTitle className="relative mt-6 font-display text-xl leading-tight text-ink">
            {title}
          </DialogTitle>
          <DialogDescription className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-soft">
            {description}
          </DialogDescription>
          {detail ? <div className="relative mt-4 text-sm text-ink-soft">{detail}</div> : null}
          <div className="relative mt-8 flex flex-col-reverse gap-2 sm:flex-row">
            {secondaryAction ? action(secondaryAction, "secondary") : null}
            {action(primaryAction, "primary")}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[1.75rem] border-line bg-surface-panel p-0 text-center shadow-[0_28px_90px_-34px_rgba(29,29,27,.45)]">
        <div className="relative px-6 pb-7 pt-12 sm:px-8">
          <div
            className={cn(
              "pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full blur-3xl",
              destructive ? "bg-danger/10" : "bg-warning/12",
            )}
          />
          <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-full border border-line bg-surface-panel shadow-sm">
            <AlertTriangle
              aria-hidden
              className={cn("h-5 w-5", destructive ? "text-danger" : "text-warning")}
            />
          </div>
          <AlertDialogTitle className="relative mt-6 font-display text-xl leading-tight text-ink">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-soft">
            {description}
          </AlertDialogDescription>
          <div className="relative mt-8 flex flex-col-reverse gap-2 sm:flex-row">
            <AlertDialogCancel className="mt-0 h-11 flex-1 rounded-full border-line bg-surface-sunken text-ink hover:bg-surface-raised">
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void onConfirm();
              }}
              className={cn(
                "h-11 flex-1 rounded-full text-surface-page",
                destructive ? "bg-danger hover:bg-danger/90" : "bg-ink hover:bg-ink/90",
              )}
            >
              {busy ? "Please wait…" : confirmLabel}
            </AlertDialogAction>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
