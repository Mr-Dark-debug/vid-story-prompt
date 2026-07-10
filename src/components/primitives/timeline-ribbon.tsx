export function TimelineRibbon({ className = "" }: { className?: string }) {
  const cells = Array.from({ length: 42 }, (_, i) => i);
  return (
    <div
      className={`ribbon-mask relative flex h-14 items-center gap-1 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {cells.map((i) => {
        const kind = i % 7;
        const h = 20 + ((i * 37) % 60);
        if (kind === 3) {
          return (
            <div
              key={i}
              className="h-10 w-10 shrink-0 rounded-[6px] bg-timeline-video/70 ring-1 ring-inset ring-line-strong"
            />
          );
        }
        if (kind === 5) {
          return (
            <div
              key={i}
              className="flex h-10 w-14 shrink-0 items-end gap-[2px] rounded-[6px] bg-timeline-audio/40 px-1 py-1 ring-1 ring-inset ring-line"
            >
              {Array.from({ length: 10 }).map((_, j) => (
                <span
                  key={j}
                  className="w-[2px] rounded-full bg-teal/70"
                  style={{ height: `${20 + ((i + j) * 13) % 80}%` }}
                />
              ))}
            </div>
          );
        }
        return (
          <div
            key={i}
            className="h-8 w-6 shrink-0 rounded-[4px] bg-surface-panel ring-1 ring-inset ring-line"
            style={{ opacity: 0.5 + (h % 40) / 100 }}
          />
        );
      })}
    </div>
  );
}