import { describe, expect, it } from "vitest";
import { buildSocialCopyRunRows } from "./runs-model";

const actor = { userId: "u", workspaceId: "w" };
const batchId = "6f1c0a54-0000-4000-8000-0000000000aa";

describe("social copy run rows", () => {
  it("creates one idempotent row per clip that references, never embeds, content", () => {
    const rows = buildSocialCopyRunRows({
      actor,
      clips: [
        { clipId: "c1", clipJobId: "j1" },
        { clipId: "c2", clipJobId: "j1" },
      ],
      batchId,
      model: null,
    });
    expect(rows).toEqual([
      expect.objectContaining({
        workspace_id: "w",
        user_id: "u",
        purpose: "social_copy",
        credential_id: null,
        model_id: null,
        input_json: { clipId: "c1" },
        idempotency_key: `social_copy:${batchId}:c1`,
      }),
      expect.objectContaining({
        input_json: { clipId: "c2" },
        idempotency_key: `social_copy:${batchId}:c2`,
      }),
    ]);
    // Same batch, same keys: a retry cannot queue duplicates.
    expect(
      buildSocialCopyRunRows({
        actor,
        clips: [{ clipId: "c1", clipJobId: "j1" }],
        batchId,
        model: null,
      })[0].idempotency_key,
    ).toBe(rows[0].idempotency_key);
    expect(
      buildSocialCopyRunRows({
        actor,
        clips: [{ clipId: "c1", clipJobId: "j1" }],
        batchId: "another-batch-id",
        model: null,
      })[0].idempotency_key,
    ).not.toBe(rows[0].idempotency_key);
  });

  it("records an explicit model choice on the run", () => {
    const [row] = buildSocialCopyRunRows({
      actor,
      clips: [{ clipId: "c1", clipJobId: "j1" }],
      batchId,
      model: { credentialId: "cred", modelId: "claude-opus-5" },
    });
    expect(row).toMatchObject({ credential_id: "cred", model_id: "claude-opus-5" });
    expect(JSON.stringify(row)).not.toMatch(/sk-|key_encrypted/);
  });
});
