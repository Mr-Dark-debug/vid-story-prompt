import { z } from "zod";
export type MotionMessage = { system: string; user: string };
export type MotionCompletion = { text: string; modelUsed: string; tokensUsed: number };
export interface MotionAiAdapter {
  completeText(
    prompt: MotionMessage,
    options: { signal: AbortSignal; images?: string[] },
  ): Promise<MotionCompletion>;
  completeJson(
    prompt: MotionMessage,
    options: { signal: AbortSignal; images?: string[] },
  ): Promise<{ value: unknown; modelUsed: string; tokensUsed: number }>;
}

/** Minimal credential-resolution seam; replace platform credentials with BYOK after that branch merges. */
export function resolveAiCredential(input: {
  enabled: boolean;
  allowedModels: string[];
  modelId: string;
  platformKey?: string;
}) {
  if (!input.enabled || !input.platformKey || !input.allowedModels.includes(input.modelId))
    throw new Error("motion_model_unavailable");
  return { provider: "openrouter" as const, modelId: input.modelId, key: input.platformKey };
}
const envelopeSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().max(512_000) }) })).min(1),
  usage: z.object({ total_tokens: z.number().int().nonnegative() }).optional(),
});
export function openRouterMotionAdapter(
  credential: ReturnType<typeof resolveAiCredential>,
  request: typeof fetch = fetch,
): MotionAiAdapter {
  async function completeText(
    prompt: MotionMessage,
    options: { signal: AbortSignal; images?: string[] },
  ) {
    if (
      options.images &&
      (options.images.length > 4 ||
        options.images.some(
          (image) => !/^data:image\/(png|jpeg);base64,/.test(image) || image.length > 3_000_000,
        ))
    )
      throw new Error("motion_reference_over_limit");
    const content = options.images?.length
      ? [
          { type: "text", text: prompt.user },
          ...options.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : prompt.user;
    const response = await request("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${credential.key}`,
        "content-type": "application/json",
        "x-title": "Vidrial Motion Studio",
      },
      signal: AbortSignal.any([options.signal, AbortSignal.timeout(120_000)]),
      body: JSON.stringify({
        model: credential.modelId,
        temperature: 0.4,
        max_tokens: 16000,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content },
        ],
      }),
    });
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "motion_provider_rate_limit"
          : response.status >= 500
            ? "motion_provider_unavailable"
            : "motion_provider_rejected",
      );
    if (!response.body) throw new Error("motion_provider_invalid_response");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > 1024 * 1024) throw new Error("motion_provider_over_limit");
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const parsed = envelopeSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) throw new Error("motion_provider_invalid_response");
    return {
      text: parsed.data.choices[0].message.content,
      modelUsed: credential.modelId,
      tokensUsed: parsed.data.usage?.total_tokens ?? 0,
    };
  }
  return {
    completeText,
    completeJson: async (prompt, options) => {
      const result = await completeText(prompt, options);
      let value: unknown;
      try {
        value = JSON.parse(result.text.replace(/^\s*```(?:json)?\s*\n?|\n?```\s*$/g, ""));
      } catch {
        throw new Error("motion_provider_invalid_json");
      }
      return { value, modelUsed: result.modelUsed, tokensUsed: result.tokensUsed };
    },
  };
}
