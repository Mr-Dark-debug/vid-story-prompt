export type ClipId = string;
export type TrackKind = "video" | "audio" | "caption";

export type Clip = {
  id: ClipId;
  assetId: string;
  name: string;
  trackId: string;
  start: number; // timeline seconds
  in: number; // source in
  out: number; // source out
  kind: TrackKind;
  color?: string;
  label?: string;
};

export type Track = {
  id: string;
  kind: TrackKind;
  label: string;
};

export type TimelineState = {
  tracks: Track[];
  clips: Clip[];
  playhead: number;
  duration: number;
  selection: ClipId[];
  zoom: number; // px per second
};

export type PlanOp =
  | { id: string; type: "insert"; clip: Omit<Clip, "id"> & { id?: string }; note?: string }
  | { id: string; type: "trim"; clipId: string; newIn?: number; newOut?: number; note?: string }
  | { id: string; type: "ripple-delete"; clipId: string; note?: string }
  | { id: string; type: "move"; clipId: string; toStart: number; toTrack?: string; note?: string }
  | { id: string; type: "split"; clipId: string; at: number; note?: string }
  | { id: string; type: "caption-preset"; preset: string; note?: string }
  | { id: string; type: "audio-duck"; trackId: string; db: number; note?: string };

export type Plan = {
  id: string;
  prompt: string;
  createdAt: string;
  summary: string;
  estimatedMinutes: number;
  ops: (PlanOp & { status: "pending" | "accepted" | "rejected" })[];
  warnings?: string[];
};