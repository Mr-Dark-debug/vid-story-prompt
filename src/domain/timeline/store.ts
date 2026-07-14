import { create } from "zustand";
import type { Clip, PlanOp, TimelineState, Track } from "./types";

type Snapshot = Pick<TimelineState, "tracks" | "clips" | "duration">;

type Actions = {
  reset: (init?: Partial<TimelineState>) => void;
  addClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  splitClip: (id: string, at: number) => void;
  trimClip: (id: string, patch: { newIn?: number; newOut?: number }) => void;
  rippleDelete: (id: string) => void;
  moveClip: (id: string, toStart: number, toTrack?: string) => void;
  select: (ids: string[]) => void;
  setPlayhead: (t: number) => void;
  setZoom: (z: number) => void;
  applyOps: (ops: PlanOp[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}`;
let snapEnabled = true;
const snapTime = (value: number) => (snapEnabled ? Math.round(value * 10) / 10 : value);

export function setTimelineSnapEnabled(enabled: boolean) {
  snapEnabled = enabled;
}

const initialTracks: Track[] = [
  { id: "vt1", kind: "video", label: "Video 1" },
  { id: "vt2", kind: "video", label: "B-roll" },
  { id: "at1", kind: "audio", label: "Dialogue" },
  { id: "at2", kind: "audio", label: "Music" },
  { id: "ct1", kind: "caption", label: "Captions" },
];

function recomputeDuration(clips: Clip[]): number {
  return clips.reduce((m, c) => Math.max(m, c.start + (c.out - c.in)), 0);
}

export const useTimeline = create<TimelineState & Actions & { _past: Snapshot[]; _future: Snapshot[] }>()((set, get) => {
  const snap = (): Snapshot => ({
    tracks: get().tracks,
    clips: get().clips,
    duration: get().duration,
  });
  const commit = (mutate: (s: Snapshot) => Snapshot) => {
    const past = [...get()._past, snap()].slice(-50);
    const next = mutate(snap());
    set({
      tracks: next.tracks,
      clips: next.clips,
      duration: recomputeDuration(next.clips),
      _past: past,
      _future: [],
    });
  };
  return {
    tracks: initialTracks,
    clips: [],
    playhead: 0,
    duration: 0,
    selection: [],
    zoom: 40,
    _past: [],
    _future: [],
    reset: (init) =>
      set((s) => ({
        tracks: init?.tracks ?? initialTracks,
        clips: init?.clips ?? [],
        playhead: 0,
        duration: recomputeDuration(init?.clips ?? []),
        selection: [],
        zoom: init?.zoom ?? s.zoom,
        _past: [],
        _future: [],
      })),
    addClip: (clip) => commit((s) => ({ ...s, clips: [...s.clips, clip] })),
    removeClip: (id) => commit((s) => ({ ...s, clips: s.clips.filter((c) => c.id !== id) })),
    splitClip: (id, at) =>
      commit((s) => {
        const c = s.clips.find((x) => x.id === id);
        if (!c) return s;
        const snappedAt = snapTime(at);
        const offset = snappedAt - c.start;
        if (offset <= 0 || offset >= c.out - c.in) return s;
        const left: Clip = { ...c, out: c.in + offset };
        const right: Clip = { ...c, id: uid("c"), start: snappedAt, in: c.in + offset };
        return { ...s, clips: [...s.clips.filter((x) => x.id !== id), left, right] };
      }),
    trimClip: (id, patch) =>
      commit((s) => ({
        ...s,
        clips: s.clips.map((c) =>
          c.id === id
            ? {
                ...c,
                in: patch.newIn === undefined ? c.in : snapTime(patch.newIn),
                out: patch.newOut === undefined ? c.out : snapTime(patch.newOut),
              }
            : c,
        ),
      })),
    rippleDelete: (id) =>
      commit((s) => {
        const c = s.clips.find((x) => x.id === id);
        if (!c) return s;
        const gap = c.out - c.in;
        return {
          ...s,
          clips: s.clips
            .filter((x) => x.id !== id)
            .map((x) =>
              x.trackId === c.trackId && x.start >= c.start ? { ...x, start: Math.max(0, x.start - gap) } : x,
            ),
        };
      }),
    moveClip: (id, toStart, toTrack) =>
      commit((s) => ({
        ...s,
        clips: s.clips.map((c) =>
          c.id === id ? { ...c, start: Math.max(0, snapTime(toStart)), trackId: toTrack ?? c.trackId } : c,
        ),
      })),
    select: (ids) => set({ selection: ids }),
    setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
    setZoom: (z) => set({ zoom: Math.max(10, Math.min(200, z)) }),
    applyOps: (ops) =>
      commit((s) => {
        let clips = [...s.clips];
        for (const op of ops) {
          if (op.type === "insert") {
            clips.push({ ...op.clip, id: op.clip.id ?? uid("c") } as Clip);
          } else if (op.type === "ripple-delete") {
            const c = clips.find((x) => x.id === op.clipId);
            if (c) {
              const gap = c.out - c.in;
              clips = clips
                .filter((x) => x.id !== op.clipId)
                .map((x) =>
                  x.trackId === c.trackId && x.start >= c.start ? { ...x, start: Math.max(0, x.start - gap) } : x,
                );
            }
          } else if (op.type === "trim") {
            clips = clips.map((c) =>
              c.id === op.clipId
                ? { ...c, in: op.newIn ?? c.in, out: op.newOut ?? c.out }
                : c,
            );
          } else if (op.type === "move") {
            clips = clips.map((c) =>
              c.id === op.clipId ? { ...c, start: op.toStart, trackId: op.toTrack ?? c.trackId } : c,
            );
          } else if (op.type === "split") {
            const c = clips.find((x) => x.id === op.clipId);
            if (c) {
              const offset = op.at - c.start;
              if (offset > 0 && offset < c.out - c.in) {
                clips = [
                  ...clips.filter((x) => x.id !== op.clipId),
                  { ...c, out: c.in + offset },
                  { ...c, id: uid("c"), start: op.at, in: c.in + offset },
                ];
              }
            }
          }
          // caption-preset / audio-duck: no timeline geometry change in this mock
        }
        return { ...s, clips };
      }),
    undo: () => {
      const past = get()._past;
      if (!past.length) return;
      const prev = past[past.length - 1];
      const future = [snap(), ...get()._future].slice(0, 50);
      set({
        tracks: prev.tracks,
        clips: prev.clips,
        duration: prev.duration,
        _past: past.slice(0, -1),
        _future: future,
      });
    },
    redo: () => {
      const future = get()._future;
      if (!future.length) return;
      const next = future[0];
      const past = [...get()._past, snap()].slice(-50);
      set({
        tracks: next.tracks,
        clips: next.clips,
        duration: next.duration,
        _past: past,
        _future: future.slice(1),
      });
    },
    canUndo: () => get()._past.length > 0,
    canRedo: () => get()._future.length > 0,
  };
});
