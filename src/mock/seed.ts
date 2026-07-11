export type MockAsset = {
  id: string;
  name: string;
  kind: "video" | "audio" | "image" | "subtitle";
  durationSec?: number;
  tags: string[];
  role: "primary" | "b-roll" | "interview" | "music" | "sfx" | "graphic";
  status: "uploading" | "analysing" | "ready" | "failed";
  progress?: number;
  speaker?: string;
  scene?: string;
  transcriptExcerpt?: string;
};

export type TranscriptWord = {
  id: string;
  text: string;
  start: number;
  end: number;
  speaker: string;
  excluded?: boolean;
  filler?: boolean;
  silence?: boolean;
};

export type MockProject = {
  id: string;
  name: string;
  brief: string;
  aspect: "16:9" | "9:16" | "1:1";
  updatedAt: string;
  createdAt: string;
  status: "draft" | "in-progress" | "exported";
  durationSec: number;
  assets: MockAsset[];
  transcript: TranscriptWord[];
  versions: {
    id: string;
    label: string;
    createdAt: string;
    kind: "manual" | "ai";
    summary: string;
  }[];
};

export const seedTranscript = (): TranscriptWord[] => {
  const lines: { s: string; sp: string }[] = [
    { s: "Welcome to the autumn roastery launch.", sp: "Ava" },
    { s: "Um, we've been working on this blend for six months.", sp: "Ava" },
    { s: "It's a natural process from the highlands.", sp: "Ava" },
    { s: "You'll notice the honey and stone-fruit notes.", sp: "Ben" },
    { s: "Uh, and a really clean finish.", sp: "Ben" },
    { s: "We're opening the roastery this Saturday.", sp: "Ava" },
  ];
  const words: TranscriptWord[] = [];
  let t = 0.4;
  let i = 0;
  for (const line of lines) {
    for (const raw of line.s.split(/\s+/)) {
      const dur = 0.28 + Math.random() * 0.18;
      const filler = /^(um|uh),?$/i.test(raw);
      words.push({
        id: `w_${i++}`,
        text: raw,
        start: t,
        end: t + dur,
        speaker: line.sp,
        filler,
        excluded: filler,
      });
      t += dur + 0.05;
    }
    // silence between lines
    words.push({
      id: `w_${i++}`,
      text: "·",
      start: t,
      end: t + 0.9,
      speaker: line.sp,
      silence: true,
      excluded: true,
    });
    t += 1.0;
  }
  return words;
};

const asset = (o: Partial<MockAsset> & Pick<MockAsset, "id" | "name" | "kind" | "role">): MockAsset => ({
  status: "ready",
  tags: [],
  ...o,
});

export const demoProject = (): MockProject => ({
  id: "prj_autumn",
  name: "Autumn Roastery Launch",
  brief:
    "A 90-second announcement for the new roastery. Warm, personal, ends on the Saturday opening. Use the founders' interview and pouring b-roll.",
  aspect: "16:9",
  createdAt: new Date(Date.now() - 6 * 864e5).toISOString(),
  updatedAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
  status: "in-progress",
  durationSec: 96,
  transcript: seedTranscript(),
  assets: [
    asset({ id: "a1", name: "Interview — Ava & Ben.mp4", kind: "video", durationSec: 1240, role: "interview", speaker: "Ava, Ben", scene: "Roastery counter", tags: ["interview", "founders"], transcriptExcerpt: "We've been working on this blend for six months…" }),
    asset({ id: "a2", name: "Pouring shot — wide.mov", kind: "video", durationSec: 34, role: "b-roll", scene: "Bar", tags: ["pour", "wide"] }),
    asset({ id: "a3", name: "Pouring shot — macro.mov", kind: "video", durationSec: 22, role: "b-roll", scene: "Bar", tags: ["pour", "macro"] }),
    asset({ id: "a4", name: "Beans on scale.mov", kind: "video", durationSec: 18, role: "b-roll", scene: "Roasting room", tags: ["beans"] }),
    asset({ id: "a5", name: "Roaster drum.mov", kind: "video", durationSec: 26, role: "b-roll", scene: "Roasting room", tags: ["roaster", "machine"] }),
    asset({ id: "a6", name: "Street exterior.mov", kind: "video", durationSec: 15, role: "b-roll", scene: "Street", tags: ["exterior"] }),
    asset({ id: "a7", name: "Customer smiling.mov", kind: "video", durationSec: 12, role: "b-roll", scene: "Bar", tags: ["customer", "smile"] }),
    asset({ id: "a8", name: "Latte art.mov", kind: "video", durationSec: 20, role: "b-roll", scene: "Bar", tags: ["latte", "art"] }),
    asset({ id: "a9", name: "Warm acoustic loop.wav", kind: "audio", durationSec: 180, role: "music", tags: ["acoustic", "warm"] }),
    asset({ id: "a10", name: "Room tone.wav", kind: "audio", durationSec: 60, role: "sfx", tags: ["ambient"] }),
    asset({ id: "a11", name: "Logo card.png", kind: "image", role: "graphic", tags: ["logo", "card"] }),
    asset({ id: "a12", name: "Interview captions.srt", kind: "subtitle", role: "graphic", tags: ["captions"] }),
  ],
  versions: [
    { id: "v1", label: "Initial draft", createdAt: new Date(Date.now() - 5 * 864e5).toISOString(), kind: "manual", summary: "Empty timeline created." },
    { id: "v2", label: "AI first cut", createdAt: new Date(Date.now() - 4 * 864e5).toISOString(), kind: "ai", summary: "Applied 18 operations from prompt: 'Cut a warm 90s launch video'." },
    { id: "v3", label: "Manual trims", createdAt: new Date(Date.now() - 3 * 864e5).toISOString(), kind: "manual", summary: "Trimmed intro, adjusted music duck." },
  ],
});

const KEY = "vidrial.projects.v1";

export function loadProjects(): MockProject[] {
  if (typeof window === "undefined") return [demoProject()];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const seed = [demoProject()];
      window.localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as MockProject[];
  } catch {
    return [demoProject()];
  }
}

export function saveProjects(projects: MockProject[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(projects));
  window.dispatchEvent(new CustomEvent("vidrial:projects"));
}

export function upsertProject(project: MockProject) {
  const all = loadProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  saveProjects(all);
}

export function deleteProject(id: string) {
  const next = loadProjects().filter((p) => p.id !== id);
  saveProjects(next);
}