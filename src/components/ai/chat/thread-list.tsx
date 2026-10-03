import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatThreadSummary } from "@/services/ai/threads";
import { filterThreads, groupThreadsByDate } from "./chat-state";

export type ThreadListProps = {
  active: ChatThreadSummary[];
  archived: ChatThreadSummary[];
  activeId: string | null;
  onRename: (thread: ChatThreadSummary, title: string) => void;
  onArchive: (thread: ChatThreadSummary, archived: boolean) => void;
  onDelete: (thread: ChatThreadSummary) => void;
  /** Called after navigating, so a mobile sheet can close itself. */
  onNavigate?: () => void;
};

function ThreadRow({
  thread,
  current,
  onRename,
  onArchive,
  onDelete,
  onNavigate,
}: {
  thread: ChatThreadSummary;
  current: boolean;
} & Pick<ThreadListProps, "onRename" | "onArchive" | "onDelete" | "onNavigate">) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(thread.title);

  if (renaming) {
    return (
      <form
        className="px-1 py-1"
        onSubmit={(event) => {
          event.preventDefault();
          const title = draft.trim();
          setRenaming(false);
          if (title && title !== thread.title) onRename(thread, title);
        }}
      >
        <Input
          autoFocus
          value={draft}
          maxLength={160}
          aria-label="Chat title"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => setRenaming(false)}
          onKeyDown={(event) => event.key === "Escape" && setRenaming(false)}
          className="h-10"
        />
      </form>
    );
  }
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg pr-1 hover:bg-surface-sunken",
        current && "bg-surface-sunken",
      )}
    >
      <Link
        to="/app/chat/$threadId"
        params={{ threadId: thread.id }}
        aria-current={current ? "page" : undefined}
        onClick={onNavigate}
        className="min-h-11 min-w-0 flex-1 truncate rounded-lg px-3 py-2.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
      >
        {thread.title}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-ink-mute"
            aria-label={`Actions for ${thread.title}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(thread.title);
              setRenaming(true);
            }}
          >
            <Pencil aria-hidden className="mr-2 size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onArchive(thread, !thread.archivedAt)}>
            {thread.archivedAt ? (
              <ArchiveRestore aria-hidden className="mr-2 size-4" />
            ) : (
              <Archive aria-hidden className="mr-2 size-4" />
            )}
            {thread.archivedAt ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger focus:text-danger"
            onSelect={() => onDelete(thread)}
          >
            <Trash2 aria-hidden className="mr-2 size-4" /> Delete permanently
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ThreadList(props: ThreadListProps) {
  const { active, archived, activeId, onNavigate } = props;
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const source = showArchived ? archived : active;
  const groups = useMemo(() => groupThreadsByDate(filterThreads(source, query)), [source, query]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <Button asChild className="w-full justify-start gap-2">
        <Link to="/app/chat" onClick={onNavigate}>
          <Plus aria-hidden /> New chat
        </Link>
      </Button>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-mute"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          className="h-11 pl-9"
        />
      </div>
      <nav aria-label="Chat history" className="min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-mute">
            {query
              ? "No chats match your search."
              : showArchived
                ? "No archived chats."
                : "No chats yet. Start one to see it here."}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="mb-3">
              <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
                {group.label}
              </h3>
              {group.threads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  current={thread.id === activeId}
                  onRename={props.onRename}
                  onArchive={props.onArchive}
                  onDelete={props.onDelete}
                  onNavigate={onNavigate}
                />
              ))}
            </section>
          ))
        )}
      </nav>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-start text-ink-soft"
        aria-pressed={showArchived}
        onClick={() => setShowArchived((value) => !value)}
      >
        <Archive aria-hidden />
        {showArchived
          ? "Back to chats"
          : `Archived${archived.length ? ` (${archived.length})` : ""}`}
      </Button>
    </div>
  );
}
