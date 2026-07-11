import type { TranscriptWord } from "./providers.js";
export function mergeTranscriptChunks(chunks: { offsetSeconds: number; text: string; words: TranscriptWord[] }[]) {
  const words: TranscriptWord[] = [];
  for (const chunk of [...chunks].sort((a,b) => a.offsetSeconds-b.offsetSeconds)) {
    for (const raw of chunk.words) { const word = { word: raw.word, start: raw.start+chunk.offsetSeconds, end: raw.end+chunk.offsetSeconds }; const prior = words.at(-1); if (prior && word.start <= prior.end+.3 && prior.word.trim().toLowerCase() === word.word.trim().toLowerCase()) continue; words.push(word); }
  }
  return { text: words.length ? words.map((word) => word.word).join(" ") : chunks.map((chunk) => chunk.text).join(" "), words };
}
