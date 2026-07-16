import { createFileRoute, useRouter } from "@tanstack/react-router";

import { useState } from "react";
import { toast } from "sonner";
import {
  SettingsSaveBar,
  SettingsSection,
  SettingsToggle,
  SettingRow,
} from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { userFacingError } from "@/lib/user-facing-error";
import {
  getAccountPreferences,
  resetAccountPreferences,
  saveEditorPreferences,
} from "@/services/settings/server";

export const Route = createFileRoute("/_authenticated/app/settings/preferences")({
  loader: () => getAccountPreferences(),
  component: Preferences,
});

function Preferences() {
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const [values, setValues] = useState(loaded.editor);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await saveEditorPreferences({ data: values });
      toast.success("Editor preferences saved.");
      await router.invalidate();
    } catch (cause) {
      toast.error(userFacingError(cause, "Preferences could not be saved."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <SettingsSection
        title="Editor defaults"
        description="These preferences follow your account across devices and apply to new editing sessions."
      >
        <SettingsToggle
          id="ai-plan-preview"
          title="Preview AI plans before applying"
          description="Review proposed edits before they change your project."
          checked={values.aiPlanPreview}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, aiPlanPreview: checked }))
          }
        />
        <SettingsToggle
          id="snap-to-words"
          title="Snap timeline edits to words"
          description="Align transcript-driven cuts to precise spoken-word boundaries."
          checked={values.snapToWords}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, snapToWords: checked }))
          }
        />
        <SettingsToggle
          id="low-resolution-preview"
          title="Bandwidth-saving preview"
          description="Use a lighter preview while editing; final exports remain full quality."
          checked={values.lowResolutionPreview}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, lowResolutionPreview: checked }))
          }
        />
        <SettingRow
          title="Autosave interval"
          description="Choose how frequently active editor changes are saved."
          htmlFor="autosave-seconds"
        >
          <SelectField
            className="min-w-40"
            label="Autosave interval"
            value={String(values.autosaveSeconds)}
            onValueChange={(value) =>
              setValues((current) => ({ ...current, autosaveSeconds: Number(value) }))
            }
            options={[
              { value: "0", label: "Off" },
              { value: "15", label: "15 seconds" },
              { value: "30", label: "30 seconds" },
              { value: "60", label: "1 minute" },
              { value: "120", label: "2 minutes" },
            ]}
          />
        </SettingRow>
      </SettingsSection>
      <SettingsSaveBar>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">
              Reset defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset account preferences?</AlertDialogTitle>
              <AlertDialogDescription>
                This restores editor and notification preferences to their recommended defaults on
                every device.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={resetting}
                onClick={async (event) => {
                  event.preventDefault();
                  setResetting(true);
                  try {
                    const result = await resetAccountPreferences({
                      data: { confirmation: "RESET" },
                    });
                    setValues(result.editor);
                    toast.success("Preferences reset.");
                    await router.invalidate();
                  } catch (cause) {
                    toast.error(userFacingError(cause, "Preferences could not be reset."));
                  } finally {
                    setResetting(false);
                  }
                }}
              >
                {resetting ? "Resetting…" : "Reset preferences"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button onClick={() => void save()} loading={saving} loadingText="Saving…">
          Save preferences
        </Button>
      </SettingsSaveBar>
    </>
  );
}
