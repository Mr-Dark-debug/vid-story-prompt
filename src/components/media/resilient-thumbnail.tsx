import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ResilientThumbnail({
  src,
  fallbackSrc,
  alt,
  className,
}: {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
}) {
  const [activeSrc, setActiveSrc] = useState(src ?? fallbackSrc ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setActiveSrc(src ?? fallbackSrc ?? null);
    setFailed(false);
  }, [fallbackSrc, src]);

  if (!activeSrc || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("grid place-items-center bg-surface-sunken text-ink-mute", className)}
      >
        <ImageOff aria-hidden className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      loading="lazy"
      className={cn("object-cover", className)}
      onError={() => {
        if (fallbackSrc && activeSrc !== fallbackSrc) {
          setActiveSrc(fallbackSrc);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
