import { Link } from "@tanstack/react-router";
import { RIGHTS_ATTESTATION_TEXT } from "@/domain/clipping/rights";
import {
  eligibleMotionReferenceUploads,
  type MotionReferenceUploads,
} from "./reference-upload-options";
export type { MotionReferenceUploads } from "./reference-upload-options";
export function MotionReferencePicker({
  uploads,
  selectedId,
  onSelect,
  rightsAccepted,
  onRightsChange,
  disabled,
}: {
  uploads: MotionReferenceUploads;
  selectedId: string;
  onSelect: (id: string) => void;
  rightsAccepted: boolean;
  onRightsChange: (accepted: boolean) => void;
  disabled?: boolean;
}) {
  const eligible = eligibleMotionReferenceUploads(uploads);
  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface-sunken p-4">
      <h2 className="text-sm font-semibold text-ink">Optional reference video</h2>
      <p className="text-sm text-ink-soft">
        Study the pacing, palette and transitions of an authorised video. The model receives sampled
        frames to extract principles, without reproducing its words or content.
      </p>
      <label className="block space-y-2 text-sm text-ink">
        <span>Workspace reference video</span>
        <select
          value={selectedId}
          onChange={(event) => {
            onSelect(event.target.value);
            onRightsChange(false);
          }}
          disabled={disabled}
          className="min-h-11 w-full rounded-lg border border-line bg-surface-panel px-3 focus:outline-none focus:ring-2 focus:ring-ember"
        >
          <option value="">No reference — start from your brief</option>
          {eligible.map((item) => (
            <option key={item.id} value={item.id}>
              {item.display_name} · {Math.round(Number(item.duration_seconds))}s
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-ink-mute">
        References must be completed workspace videos between 1 and 60 seconds, up to 50 MB (MP4,
        WebM or MOV).{" "}
        {eligible.length === 0
          ? "No eligible reference video is available."
          : `${eligible.length} eligible ${eligible.length === 1 ? "video" : "videos"}.`}{" "}
        <Link to="/app/uploads" className="underline underline-offset-4">
          Manage source uploads
        </Link>
      </p>
      {selectedId && (
        <label className="flex min-h-11 items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input
            type="checkbox"
            required
            checked={rightsAccepted}
            onChange={(event) => onRightsChange(event.target.checked)}
            disabled={disabled}
            className="mt-1 h-4 w-4 shrink-0 accent-ember"
          />
          <span>
            {RIGHTS_ATTESTATION_TEXT} I also authorise this video’s sampled frames to be sent to the
            configured vision model for motion analysis.
          </span>
        </label>
      )}
    </section>
  );
}
