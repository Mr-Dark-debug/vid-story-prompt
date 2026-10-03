import { useState } from "react";
import { toast } from "sonner";
import { AI_PURPOSE_LABELS } from "@/domain/ai/providers";
import type { AiPurpose } from "@/domain/ai/types";
import { userFacingError } from "@/lib/user-facing-error";
import { setAiPreference, type AiModelGroup, type AiPreference } from "@/services/ai/server";
import { modelKey } from "./model-catalog";
import { ModelPicker } from "./model-picker";

export type PurposeCopy = { purpose: AiPurpose; description: string; noneLabel: string };

export function DefaultModelsPanel({
  purposes,
  groups,
  preferences,
  onSaved,
}: {
  purposes: readonly PurposeCopy[];
  groups: readonly AiModelGroup[];
  preferences: readonly AiPreference[];
  onSaved: () => void;
}) {
  const [savingPurpose, setSavingPurpose] = useState<AiPurpose | null>(null);
  const valueFor = (purpose: AiPurpose) => {
    const preference = preferences.find((item) => item.purpose === purpose);
    return preference ? modelKey(preference.credentialId, preference.modelId) : null;
  };

  return (
    <section
      aria-labelledby="ai-default-models"
      className="rounded-xl border border-line bg-surface-panel p-5"
    >
      <h3 id="ai-default-models" className="font-display text-lg text-ink">
        Default models
      </h3>
      <p className="mt-1 text-sm text-ink-soft">
        Choose which of your models each feature uses by default.
      </p>
      <div className="mt-4 grid gap-4">
        {purposes.map(({ purpose, description, noneLabel }) => (
          <div
            key={purpose}
            className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-center sm:gap-6"
          >
            <div>
              <div className="text-sm font-medium text-ink">{AI_PURPOSE_LABELS[purpose]}</div>
              <p className="text-xs text-ink-mute">{description}</p>
            </div>
            <ModelPicker
              groups={groups}
              value={valueFor(purpose)}
              ariaLabel={`Default model for ${AI_PURPOSE_LABELS[purpose]}`}
              none={{ label: noneLabel }}
              disabled={savingPurpose === purpose}
              onChange={async (model) => {
                setSavingPurpose(purpose);
                try {
                  await setAiPreference({
                    data: {
                      purpose,
                      credentialId: model?.credentialId ?? null,
                      modelId: model?.modelId ?? null,
                    },
                  });
                  toast.success(
                    model
                      ? `${AI_PURPOSE_LABELS[purpose]} will use ${model.displayName}.`
                      : `${AI_PURPOSE_LABELS[purpose]} default cleared.`,
                  );
                  onSaved();
                } catch (cause) {
                  toast.error(userFacingError(cause, "The default model could not be saved."));
                } finally {
                  setSavingPurpose(null);
                }
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
