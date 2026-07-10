export function UsageMeter({
  label,
  used,
  total,
  unit,
  tone = "ember",
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  tone?: "ember" | "teal" | "info";
}) {
  const pct = Math.min(100, Math.round((used / Math.max(total, 1)) * 100));
  const bar = { ember: "bg-ember", teal: "bg-teal", info: "bg-info" }[tone];
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums text-ink-mute">
          {used}
          <span className="text-ink-mute">
            /{total} {unit}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}