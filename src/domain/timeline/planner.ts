import type { PlanOp } from "./types";
type Status = "pending" | "accepted" | "rejected";
import type { MockProject } from "@/mock/seed";

function uid(p = "op") {
  return `${p}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deterministic mock planner. Turns a prompt + project into a concrete plan.
 * Different keywords yield different sets of operations so the UI feels alive.
 */
export function planFromPrompt(prompt: string, project: MockProject) {
  const p = prompt.toLowerCase();
  const ops: (PlanOp & { status: Status })[] = [];
  const wantsFirstCut = /(first cut|assembly|rough|make|build|create)/.test(p);
  const wantsShort = /(short|9:16|vertical|tiktok|reels|shorts)/.test(p);
  const wantsSilence = /(silence|pause|breath|dead air)/.test(p);
  const wantsFillers = /(um|uh|filler)/.test(p);
  const wantsCaptions = /(caption|subtitle)/.test(p);
  const wantsMusic = /(music|track|score|underscore|duck)/.test(p);
  const wantsBroll = /(b-?roll|cutaway|insert)/.test(p);

  const interview = project.assets.find((a) => a.role === "interview");
  const broll = project.assets.filter((a) => a.role === "b-roll");

  if (wantsFirstCut && interview) {
    let t = 0;
    // 4 selected quotes from interview
    for (let i = 0; i < 4; i++) {
      const dur = 6 + Math.round(Math.random() * 4);
      ops.push({
        id: uid(),
        type: "insert",
        status: "pending",
        note: `Take ${i + 1} from interview`,
        clip: {
          assetId: interview.id,
          name: `Interview · take ${i + 1}`,
          trackId: "vt1",
          start: t,
          in: 20 + i * 60,
          out: 20 + i * 60 + dur,
          kind: "video",
        },
      });
      t += dur;
    }
  }

  if ((wantsFirstCut || wantsBroll) && broll.length) {
    let t = 4;
    for (let i = 0; i < Math.min(4, broll.length); i++) {
      const a = broll[i];
      const dur = Math.min(4, a.durationSec ?? 4);
      ops.push({
        id: uid(),
        type: "insert",
        status: "pending",
        note: `B-roll: ${a.name}`,
        clip: {
          assetId: a.id,
          name: a.name,
          trackId: "vt2",
          start: t,
          in: 0,
          out: dur,
          kind: "video",
        },
      });
      t += dur + 3;
    }
  }

  if (wantsSilence || wantsFirstCut) {
    ops.push({ id: uid(), type: "audio-duck", status: "pending", trackId: "at1", db: -3, note: "Remove 14 long pauses" });
  }
  if (wantsFillers || wantsFirstCut) {
    ops.push({ id: uid(), type: "audio-duck", status: "pending", trackId: "at1", db: -6, note: "Remove 22 filler words (um, uh)" });
  }
  if (wantsMusic || wantsFirstCut) {
    ops.push({ id: uid(), type: "audio-duck", status: "pending", trackId: "at2", db: -8, note: "Duck music -8 dB under dialogue" });
  }
  if (wantsCaptions || wantsFirstCut) {
    ops.push({ id: uid(), type: "caption-preset", status: "pending", preset: "Clean Editorial", note: "Add caption preset — Clean Editorial" });
  }
  if (wantsShort) {
    ops.push({ id: uid(), type: "audio-duck", status: "pending", trackId: "at1", db: 0, note: "Reframe to 9:16 with speaker tracking" });
  }

  if (!ops.length) {
    ops.push({
      id: uid(),
      type: "audio-duck",
      status: "pending",
      trackId: "at1",
      db: 0,
      note: "No matching operations for this prompt. Try 'make a 90 second first cut'.",
    });
  }

  const totalInserted = ops.filter((o) => o.type === "insert").length;
  return {
    id: uid("plan"),
    prompt,
    createdAt: new Date().toISOString(),
    summary: `${ops.length} operations · ~${totalInserted * 6}s of new material`,
    estimatedMinutes: Math.round((project.assets.reduce((m, a) => m + (a.durationSec ?? 0), 0) / 60) * 0.02 * 10) / 10,
    warnings: totalInserted === 0 ? ["No clips inserted — the prompt did not include a first-cut directive."] : undefined,
    ops,
  };
}