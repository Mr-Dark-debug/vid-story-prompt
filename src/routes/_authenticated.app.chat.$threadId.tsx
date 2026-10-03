import { createFileRoute, getRouteApi, Link, useRouter } from "@tanstack/react-router";
import { ChatView } from "@/components/ai/chat/chat-view";
import { getChatThread } from "@/services/ai/threads";

export const Route = createFileRoute("/_authenticated/app/chat/$threadId")({
  loader: ({ params }) => getChatThread({ data: { threadId: params.threadId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.thread.title ?? "Chat"} — Vidrial` }],
  }),
  errorComponent: ChatNotFound,
  component: ChatThreadPage,
});

const layoutRoute = getRouteApi("/_authenticated/app/chat");

function ChatNotFound() {
  return (
    <div className="grid flex-1 place-items-center text-center">
      <div>
        <h1 className="font-display text-2xl text-ink">That chat is not available</h1>
        <p className="mt-2 text-sm text-ink-soft">
          It may have been deleted, or it belongs to another account.
        </p>
        <Link
          to="/app/chat"
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-sm font-medium text-surface-page hover:bg-ink/90"
        >
          Start a new chat
        </Link>
      </div>
    </div>
  );
}

function ChatThreadPage() {
  const { thread, messages } = Route.useLoaderData();
  const { models, jobs } = layoutRoute.useLoaderData();
  const router = useRouter();
  return (
    <>
      <header className="mb-1 flex min-w-0 items-baseline gap-3 px-1">
        <h1 className="truncate font-display text-xl text-ink">{thread.title}</h1>
      </header>
      <ChatView
        // A different thread is a different conversation: reset all local stream state.
        key={thread.id}
        thread={thread}
        messages={messages}
        groups={models}
        jobs={jobs}
        onChanged={() => void router.invalidate()}
      />
    </>
  );
}
