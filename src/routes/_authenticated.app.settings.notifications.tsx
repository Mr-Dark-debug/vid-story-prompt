import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  SettingsSaveBar,
  SettingsSection,
  SettingsToggle,
} from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { userFacingError } from "@/lib/user-facing-error";
import { getAccountPreferences, saveNotificationPreferences } from "@/services/settings/server";

export const Route = createFileRoute("/_authenticated/app/settings/notifications")({
  loader: () => getAccountPreferences(),
  component: Notifications,
});

function Notifications() {
  const loaded = Route.useLoaderData();
  const router = useRouter();
  const [values, setValues] = useState(loaded.notifications);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await saveNotificationPreferences({ data: values });
      toast.success("Notification preferences saved.");
      await router.invalidate();
    } catch (cause) {
      toast.error(userFacingError(cause, "Notification preferences could not be saved."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <SettingsSection
        title="Production notifications"
        description="Choose the events Vidrial should bring to your attention."
      >
        <SettingsToggle
          id="notify-export"
          title="Export completed"
          description="Get notified when a rendered export is ready."
          checked={values.exportComplete}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, exportComplete: checked }))
          }
        />
        <SettingsToggle
          id="notify-analysis"
          title="AI analysis completed"
          description="Know when a clipping plan is ready to review."
          checked={values.aiPlanComplete}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, aiPlanComplete: checked }))
          }
        />
        <SettingsToggle
          id="notify-usage"
          title="Weekly usage summary"
          description="Receive a concise account usage overview."
          checked={values.weeklyUsage}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, weeklyUsage: checked }))
          }
        />
        <SettingsToggle
          id="notify-product"
          title="Product updates"
          description="Occasional announcements about meaningful Vidrial improvements."
          checked={values.productUpdates}
          onCheckedChange={(checked) =>
            setValues((current) => ({ ...current, productUpdates: checked }))
          }
        />
      </SettingsSection>
      <SettingsSaveBar>
        <Button onClick={() => void save()} loading={saving} loadingText="Saving…">
          <Save />
          Save notifications
        </Button>
      </SettingsSaveBar>
    </>
  );
}
