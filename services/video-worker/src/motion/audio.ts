import { writeFile } from "node:fs/promises";
import { bounded } from "./browser.js";
import { HARD_LIMITS } from "./limits.js";
import type { Browser, Frame } from "playwright-core";

/** Scene returns PCM from OfflineAudioContext, not arbitrary file bytes. */
export async function renderAudio(
  scene: { frame: Frame; browser: Browser },
  path: string,
  duration: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const pcm = await bounded(
    scene.frame.evaluate(async () => {
      const render = (window as unknown as { renderAudio?: () => Promise<AudioBuffer> })
        .renderAudio;
      if (!render) return null;
      const buffer = await render();
      if (
        !(buffer instanceof AudioBuffer) ||
        buffer.numberOfChannels < 1 ||
        buffer.numberOfChannels > 2 ||
        buffer.sampleRate < 8000 ||
        buffer.sampleRate > 48000 ||
        buffer.length > 60 * 48000
      )
        throw new Error("motion_audio_invalid");
      return {
        rate: buffer.sampleRate,
        length: buffer.length,
        channels: Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
          Array.from(buffer.getChannelData(channel)),
        ),
      };
    }),
    Math.min(30_000, HARD_LIMITS.totalTimeoutMs),
    scene.browser,
    signal,
  );
  if (!pcm) return false;
  if (
    Math.abs(pcm.length / pcm.rate - duration) > 0.05 ||
    pcm.channels.some(
      (channel) =>
        channel.length !== pcm.length || channel.some((sample) => !Number.isFinite(sample)),
    )
  )
    throw new Error("motion_audio_duration_mismatch");
  const channels = pcm.channels.length;
  const bytes = pcm.length * channels * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + bytes, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(pcm.rate, 24);
  wav.writeUInt32LE(pcm.rate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(bytes, 40);
  for (let i = 0; i < pcm.length; i++)
    for (let c = 0; c < channels; c++)
      wav.writeInt16LE(
        Math.round(Math.max(-1, Math.min(1, pcm.channels[c][i])) * 32767),
        44 + (i * channels + c) * 2,
      );
  await writeFile(path, wav, { flag: "wx" });
  return true;
}
