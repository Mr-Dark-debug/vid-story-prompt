import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CONNECTOR_REGISTRY, getConnector } from "@/domain/connectors/registry";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSession } from "@/services/auth/server";
import { connectorConfigured } from "./oauth.server";

type ConnectorDb = {
  from(table: string): ConnectorQuery;
};

type ConnectorQuery = PromiseLike<{
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
}> & {
  select(columns?: string): ConnectorQuery;
  insert(values: Record<string, unknown>): ConnectorQuery;
  upsert(values: Record<string, unknown>, options?: Record<string, unknown>): ConnectorQuery;
  eq(column: string, value: unknown): ConnectorQuery;
  order(column: string, options?: Record<string, unknown>): ConnectorQuery;
};

const connectorIdSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((id) => Boolean(getConnector(id)), "Unknown connector");

export const getPublicConnectorCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  const connected = new Set<string>();
  if (session?.workspaceId) {
    const client = getSupabaseAdminClient() as unknown as ConnectorDb;
    const { data } = await client
      .from("connector_connections")
      .select("connector_id,status")
      .eq("workspace_id", session.workspaceId);
    for (const item of data ?? [])
      if (item.status === "connected" && typeof item.connector_id === "string")
        connected.add(item.connector_id);
  }
  return CONNECTOR_REGISTRY.map((definition) => ({
    ...definition,
    connected: connected.has(definition.id),
    configured:
      definition.id === "google_drive" ||
      definition.id === "dropbox" ||
      definition.id === "onedrive"
        ? connectorConfigured(definition.id)
        : definition.availability === "available",
    executable:
      definition.availability === "available" ||
      ((definition.id === "google_drive" ||
        definition.id === "dropbox" ||
        definition.id === "onedrive") &&
        connectorConfigured(definition.id)),
  }));
});

export const joinConnectorWaitlist = createServerFn({ method: "POST" })
  .validator(z.object({ connectorId: connectorIdSchema }))
  .handler(async ({ data }) => {
    const session = await getCurrentSession();
    if (!session?.workspaceId) throw new Error("Log in before joining a connector waitlist.");
    const connector = getConnector(data.connectorId)!;
    if (connector.availability !== "coming_soon" && connector.availability !== "beta")
      throw new Error("This connector is already available.");
    const client = getSupabaseServerClient() as unknown as ConnectorDb;
    const { error } = await client
      .from("connector_waitlist")
      .upsert(
        { workspace_id: session.workspaceId, user_id: session.id, connector_id: connector.id },
        { onConflict: "workspace_id,user_id,connector_id", ignoreDuplicates: true },
      );
    if (error) throw new Error(`Waitlist interest could not be saved: ${error.message}`);
    const audit = getSupabaseAdminClient() as unknown as ConnectorDb;
    await audit.from("connector_audit_events").insert({
      workspace_id: session.workspaceId,
      user_id: session.id,
      connector_id: connector.id,
      event_type: "connector_waitlist_joined",
      metadata_json: { availability: connector.availability },
    });
    return { ok: true, connectorId: connector.id };
  });

export const listConnectorWaitlist = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session?.workspaceId) return [] as { connectorId: string; createdAt: string }[];
  const client = getSupabaseServerClient() as unknown as ConnectorDb;
  const { data, error } = await client
    .from("connector_waitlist")
    .select("connector_id,created_at")
    .eq("workspace_id", session.workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((item) =>
    typeof item.connector_id === "string" && typeof item.created_at === "string"
      ? [{ connectorId: item.connector_id, createdAt: item.created_at }]
      : [],
  );
});
