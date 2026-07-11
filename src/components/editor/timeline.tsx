import { useTimeline } from "@/domain/timeline/store";
import { cn } from "@/lib/utils";

const KIND_COLOR: Record<string, string> = {
  video: "bg-timeline-video/70 border-timeline-video",
  audio: "bg-timeline-audio/70 border-timeline-audio",
  caption: "bg-timeline-caption/70 border-timeline-caption",
};

export function TimelineView() {
  const tracks = useTimeline((s) => s.tracks);
  const clips = useTimeline((s) => s.clips);
  const zoom = useTimeline((s) => s.zoom);
  const playhead = useTimeline((s) => s.playhead);
  const duration = useTimeline((s) => s.duration);
  const selection = useTimeline((s) => s.selection);
  const select = useTimeline((s) => s.select);
  const setPlayhead = useTimeline((s) => s.setPlayhead);
  const setZoom = useTimeline((s) => s.setZoom);

  const rulerWidth = Math.max(600, (duration + 5) * zoom);
  const ticks = Array.from({ length: Math.ceil(rulerWidth / zoom) + 1 }, (_, i) => i);

  return (
    <div className="flex h-full flex-col overflow-hidden border-t border-line bg-surface-panel">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[11px] text-ink-mute">
        <span>Timeline · {duration.toFixed(1)}s</span>
        <div className="flex items-center gap-2">
          <label>Zoom</label>
          <input
            type="range"
            min={15}
            max={120}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-28"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ width: 120 + rulerWidth }}>
          <div className="w-[120px] shrink-0 border-r border-line bg-surface-sunken">
            <div className="h-6 border-b border-line" />
            {tracks.map((t) => (
              <div key={t.id} className="flex h-12 items-center border-b border-line px-3 text-[11px] text-ink-soft">
                {t.label}
              </div>
            ))}
          </div>
          <div
            className="relative"
            style={{ width: rulerWidth }}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setPlayhead((e.clientX - rect.left) / zoom);
            }}
          >
            <div className="relative h-6 border-b border-line bg-surface-sunken">
              {ticks.map((i) => (
                <div key={i} className="absolute top-0 h-full text-[10px] text-ink-mute" style={{ left: i * zoom }}>
                  <div className="h-2 w-px bg-line-strong" />
                  <span className="pl-1">{i}s</span>
                </div>
              ))}
            </div>
            {tracks.map((t) => (
              <div key={t.id} className="relative h-12 border-b border-line">
                {clips
                  .filter((c) => c.trackId === t.id)
                  .map((c) => {
                    const w = (c.out - c.in) * zoom;
                    const isSel = selection.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          select([c.id]);
                        }}
                        className={cn(
                          "absolute top-1.5 h-9 rounded-md border px-2 text-left text-[11px] text-ink shadow-sm",
                          KIND_COLOR[c.kind],
                          isSel && "ring-2 ring-timeline-selected",
                        )}
                        style={{ left: c.start * zoom, width: Math.max(20, w) }}
                        title={c.name}
                      >
                        <div className="truncate">{c.name}</div>
                      </button>
                    );
                  })}
              </div>
            ))}
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-danger"
              style={{ left: playhead * zoom }}
            >
              <div className="mx-auto h-2 w-2 -translate-x-1/2 rounded-b bg-danger" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}