import { getFamily } from "@/domain/ai/families";
import { getAiProvider } from "@/domain/ai/providers";
import { resolveProviderMark } from "@/lib/ai-provider-marks";
import { cn } from "@/lib/utils";

type ProviderLogoProps = {
  /** Model-maker family id (e.g. `anthropic`). Unknown ids fall back to the generic mark. */
  family?: string;
  /** Provider id; shows the provider's own mark, for key and connection surfaces. */
  provider?: string;
  size?: number;
  className?: string;
  /** Hide from assistive tech when the name is already printed next to the mark. */
  decorative?: boolean;
};

export function ProviderLogo({
  family,
  provider,
  size = 20,
  className,
  decorative = false,
}: ProviderLogoProps) {
  const definition = provider ? getAiProvider(provider) : undefined;
  const maker = getFamily(family);
  const logoKey = definition ? definition.logoKey : maker.logoKey;
  const label = definition ? definition.label : maker.label;

  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      data-logo={logoKey}
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-ink [&>svg]:size-full",
        className,
      )}
      style={{ width: size, height: size }}
      // Trusted, checked-in assets only (scanned by the registry test for scripts and references).
      dangerouslySetInnerHTML={{ __html: resolveProviderMark(logoKey) }}
    />
  );
}

/** A model-maker mark with the serving provider as a small badge (e.g. Claude via OpenRouter). */
export function ModelLogo({
  family,
  provider,
  size = 24,
  className,
}: {
  family: string;
  provider: string;
  size?: number;
  className?: string;
}) {
  const showBadge = getFamily(family).logoKey !== getAiProvider(provider)?.logoKey;
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <ProviderLogo family={family} size={size} />
      {showBadge ? (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-surface p-px ring-1 ring-line">
          <ProviderLogo
            provider={provider}
            size={Math.max(10, Math.round(size * 0.5))}
            className="text-ink-soft"
          />
        </span>
      ) : null}
    </span>
  );
}
