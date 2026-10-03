import type { AiConnection } from "@/services/ai/server";

export type ConnectionBadge = {
  label: string;
  variant: "success" | "warning" | "danger" | "muted";
  /** Short, honest explanation shown beside the badge. */
  detail?: string;
};

/** Maps stored status and the last failure code to what a user should see. Never optimistic. */
export function describeConnection(connection: AiConnection): ConnectionBadge {
  if (connection.status === "revoked") {
    return { label: "Revoked", variant: "muted", detail: "The stored key was erased." };
  }
  if (connection.status === "invalid") {
    return {
      label: "Needs reconnect",
      variant: "danger",
      detail: "The provider rejected this key. Replace it to keep using it.",
    };
  }
  if (connection.lastErrorCode === "rate_limited") {
    return {
      label: "Rate limited",
      variant: "warning",
      detail: "The provider is limiting this key. It is still saved.",
    };
  }
  if (connection.lastErrorCode === "network") {
    return {
      label: "Could not verify",
      variant: "warning",
      detail: "The last check could not reach the provider.",
    };
  }
  return { label: "Active", variant: "success" };
}

export function formatVerified(iso: string | null, now = Date.now()): string {
  if (!iso) return "Not verified yet";
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "Verified just now";
  if (minutes < 60) return `Verified ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Verified ${hours} h ago`;
  return `Verified ${Math.round(hours / 24)} days ago`;
}
