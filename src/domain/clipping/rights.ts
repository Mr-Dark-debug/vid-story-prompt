import { z } from "zod";
export const RIGHTS_ATTESTATION_TEXT =
  "I own this content or have permission to upload, edit and export it.";
export const RIGHTS_ATTESTATION_VERSION = "youtube-clipper-rights-v1";
export const POLICY_VERSION = "vidrial-content-policy-v1";
export const rightsAttestationSchema = z.object({
  userId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  jobId: z.string().uuid(),
  sourceUrl: z.string().url().nullable(),
  youtubeVideoId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{11}$/)
    .nullable(),
  attestationVersion: z.literal(RIGHTS_ATTESTATION_VERSION),
  policyVersion: z.literal(POLICY_VERSION),
  acceptedAt: z.string().datetime(),
  requestMetadata: z.record(z.string(), z.unknown()),
});
