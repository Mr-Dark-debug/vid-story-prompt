import { createFileRoute, Outlet, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ThreadList } from "@/components/ai/chat/thread-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConfirmationDialog } from "@/components/ui/status-dialog";
import { userFacingError } from "@/lib/user-facing-error";
import { getAiPreferences, listAiModels } from "@/services/ai/server";
import {
  deleteChatThread,
  listAttachableClipJobs,
  listChatThreads,
  updateChatThread,
  type ChatThreadSummary,
} from "@/services/ai/threads";

export const Route = createFileRoute("/_authenticated/app/chat")({
  head: () => ({
    meta: [
      { title: "AI chat — Vidrial" },
      { name: "description", content: "Chat with the models behind your own provider keys." },
    ],
  }),
  loader: async () => {
    const [threads, archived, models, preferences, jobs] = await Promise.all([
      listChatThreads({ data: { archived: false } }),
      listChatThreads({ data: { archived: true } }),
      listAiModels(),
      getAiPreferences(),
      listAttachableClipJobs(),
    ]);
    return { threads, archived, models, preferences, jobs };
  },
  component: ChatLayout,
});

function ChatLayout() {
  const { threads, archived } = Route.useLoaderData();
  const params = useParams({ strict: false }) as { threadId?: string };
  const router = useRouter();
  const navigate = useNavigate();
  const [listOpen, setListOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatThreadSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const refresh = () => void router.invalidate();

  async function mutate(work: () => Promise<unknown>, failure: string) {
    try {
      await work();
      refresh();
    } catch (cause) {
      toast.error(userFacingError(cause, failure));
    }
  }

  const list = (
    <ThreadList
      active={threads}
      archived={archived}
      activeId={params.threadId ?? null}
      onNavigate={() => setListOpen(false)}
      onRename={(thread, title) =>
        void mutate(
          () => updateChatThread({ data: { threadId: thread.id, title } }),
          "The chat could not be renamed.",
        )
      }
      onArchive={(thread, archive) =>
        void mutate(
          () => updateChatThread({ data: { threadId: thread.id, archived: archive } }),
          "The chat could not be updated.",
        )
      }
      onDelete={setPendingDelete}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[30rem] gap-4">
      <aside
        aria-label="Chats"
        className="hidden w-72 shrink-0 rounded-xl border border-line bg-surface-panel p-3 lg:block"
      >
        {list}
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2 lg:hidden">
          <Sheet open={listOpen} onOpenChange={setListOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                <Menu aria-hidden /> Chats
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(20rem,calc(100vw-2rem))] p-3">
              <SheetTitle className="sr-only">Chats</SheetTitle>
              <SheetDescription className="sr-only">Your chat history</SheetDescription>
              <div className="mt-6 h-[calc(100%-1.5rem)]">{list}</div>
            </SheetContent>
          </Sheet>
        </div>
        <Outlet />
      </section>

      <ConfirmationDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        destructive
        busy={deleting}
        title="Delete this chat permanently?"
        description="The conversation and every message in it are erased from Vidrial. This cannot be undone."
        confirmLabel="Delete chat"
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeleting(true);
          try {
            await deleteChatThread({ data: { threadId: pendingDelete.id } });
            toast.success("Chat deleted.");
            if (params.threadId === pendingDelete.id) await navigate({ to: "/app/chat" });
            refresh();
          } catch (cause) {
            toast.error(userFacingError(cause, "The chat could not be deleted."));
          } finally {
            setDeleting(false);
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}
