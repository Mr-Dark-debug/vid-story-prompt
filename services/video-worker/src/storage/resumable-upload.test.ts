import { afterEach, describe, expect, it, vi } from "vitest";
type TestOptions = {
  onSuccess: () => void;
  onShouldRetry: (error: { originalResponse: { getStatus: () => number } }) => boolean;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  chunkSize: number;
};
const state = vi.hoisted(() => ({ options: {} as TestOptions, destroy: vi.fn() }));
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  const createReadStream = () => ({ destroy: state.destroy });
  return { ...original, createReadStream, default: { ...original, createReadStream } };
});
vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(_stream: unknown, options: TestOptions) {
      state.options = options;
    }
    start() {
      state.options.onSuccess();
    }
    abort() {
      return Promise.resolve();
    }
  },
}));
import { storageUploadEndpoint, uploadResumable } from "./resumable-upload.js";
afterEach(() => vi.clearAllMocks());
describe("resumable storage uploads", () => {
  it("uses direct storage for hosted Supabase and preserves custom hosts", () => {
    expect(storageUploadEndpoint("https://project123.supabase.co")).toBe(
      "https://project123.storage.supabase.co/storage/v1/upload/resumable",
    );
    expect(storageUploadEndpoint("http://localhost:54321")).toBe(
      "http://localhost:54321/storage/v1/upload/resumable",
    );
  });
  it("keeps media immutable and closes streams after upload", async () => {
    await uploadResumable({
      projectUrl: "https://project123.supabase.co",
      key: "test-key",
      bucket: "clip-previews",
      path: "workspace/user/job/preview/id.mp4",
      file: "test.mp4",
      size: 7000000,
      contentType: "video/mp4",
    });
    expect(state.options.headers["x-upsert"]).toBe("false");
    // Hosted resumable uploads require both project API routing and bearer auth.
    expect(state.options.headers.apikey).toBe("test-key");
    expect(state.options.headers.authorization).toBe("Bearer test-key");
    expect(state.options.metadata.contentType).toBe("video/mp4");
    expect(state.options.chunkSize).toBe(6 * 1024 * 1024);
    expect(state.destroy).toHaveBeenCalledOnce();
    expect(state.options.onShouldRetry({ originalResponse: { getStatus: () => 413 } })).toBe(false);
    expect(state.options.onShouldRetry({ originalResponse: { getStatus: () => 503 } })).toBe(true);
  });
});
