import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AddKeyDialog } from "../../src/components/ai/add-key-dialog";
import { ChatView } from "../../src/components/ai/chat/chat-view";
import { ProviderCard } from "../../src/components/ai/provider-card";
import { Toaster } from "../../src/components/ui/sonner";
import { getAiProvider } from "../../src/domain/ai/providers";
import { connectAiProvider, listAiModels } from "@/services/ai/server";
import type { AiConnection, AiModelGroup } from "../../src/services/ai/server";
import "../../src/styles.css";

const anthropic = getAiProvider("anthropic")!;

// Mirrors the wiring in the settings route (which needs the real router and loader).
function ProvidersFixture() {
  const [connections, setConnections] = useState<AiConnection[]>([]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <ProviderCard
        provider={{ ...anthropic, connectable: true }}
        connections={connections}
        busyId={null}
        canAdd
        onAdd={() => setOpen(true)}
        onAction={() => undefined}
      />
      <AddKeyDialog
        provider={open ? anthropic : null}
        mode="add"
        onOpenChange={setOpen}
        onSubmit={async ({ label, apiKey }) => {
          const result = await connectAiProvider({
            data: { providerId: "anthropic", label, apiKey },
          });
          setConnections((current) => [
            ...current,
            {
              id: result.id,
              providerId: "anthropic",
              label,
              last4: apiKey.slice(-4),
              status: "active",
              lastVerifiedAt: new Date().toISOString(),
              lastErrorCode: null,
              modelCount: result.modelCount,
              modelsFetchedAt: new Date().toISOString(),
            },
          ]);
        }}
      />
    </>
  );
}

function ChatFixture() {
  const [groups, setGroups] = useState<AiModelGroup[]>([]);
  useEffect(() => {
    void listAiModels().then(setGroups);
  }, []);
  return (
    <div style={{ height: "calc(100dvh - 6rem)", display: "flex", flexDirection: "column" }}>
      <ChatView
        thread={{
          id: "t-fixture",
          title: "Hook ideas",
          archivedAt: null,
          lastMessageAt: new Date().toISOString(),
          providerId: "anthropic",
          modelId: "claude-opus-5",
          credentialId: "6f1c0a54-0000-4000-8000-000000000001",
          clipJobId: null,
        }}
        messages={[]}
        groups={groups}
        jobs={[]}
        onChanged={() => undefined}
      />
    </div>
  );
}

function Fixture() {
  const view = window.location.hash.replace("#", "");
  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 16 }}>
      <p className="text-xs">
        Browser UI contract fixture with FAKE server functions and a FAKE provider. No Supabase,
        real key or real model is involved.
      </p>
      {view === "chat" ? <ChatFixture /> : <ProvidersFixture />}
      <Toaster />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
