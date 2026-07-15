import { useNavigate } from "@tanstack/react-router";
import {
  FileVideo2,
  FolderKanban,
  Gauge,
  Plus,
  Scissors,
  Search,
  Settings,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { appNavItems, commonActions, settingsNavItems } from "@/config/app-navigation";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { userFacingError } from "@/lib/user-facing-error";
import { searchWorkspace, type WorkspaceSearchResult } from "@/services/search/server";

const resultIcons = {
  project: FolderKanban,
  upload: FileVideo2,
  "clipping-job": Scissors,
} as const;

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      requestId.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void searchWorkspace({ data: { query: trimmed } })
        .then((nextResults) => {
          if (requestId.current === currentRequest) setResults(nextResults);
        })
        .catch((cause) => {
          if (requestId.current === currentRequest) {
            setResults([]);
            setError(userFacingError(cause, "Search is temporarily unavailable."));
          }
        })
        .finally(() => {
          if (requestId.current === currentRequest) setLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const clientResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = (label: string, description: string, keywords = "") =>
      !normalized || `${label} ${description} ${keywords}`.toLowerCase().includes(normalized);
    return {
      actions: commonActions.filter((item) => matches(item.label, item.description, item.keywords)),
      pages: appNavItems.filter((item) => matches(item.label, item.description)),
      settings: settingsNavItems.filter((item) => matches(item.label, item.description)),
    };
  }, [query]);

  const go = (to: string) => {
    setOpen(false);
    void navigate({ to: to as never });
  };

  const projects = results.filter((result) => result.type === "project");
  const uploads = results.filter((result) => result.type === "upload");
  const jobs = results.filter((result) => result.type === "clipping-job");
  const hasAny =
    projects.length +
      uploads.length +
      jobs.length +
      clientResults.actions.length +
      clientResults.pages.length +
      clientResults.settings.length >
    0;

  return (
    <>
      <Button
        variant="outline"
        className="h-10 w-10 justify-center border-line bg-surface-panel px-0 text-ink-soft shadow-none sm:w-64 sm:justify-start sm:px-3"
        onClick={() => setOpen(true)}
        aria-label="Search workspace"
      >
        <Search className="h-4 w-4" />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search workspace…</span>
        <kbd className="hidden rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[10px] text-ink-mute sm:inline">
          Ctrl K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search projects, uploads, jobs, settings, and actions…"
        />
        <CommandList className="max-h-[min(30rem,70vh)] py-2">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-ink-mute" role="status">
              Searching your workspace…
            </div>
          ) : null}
          {error ? (
            <div className="mx-3 my-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {!loading && !error && !hasAny ? (
            <CommandEmpty>No matching workspace results.</CommandEmpty>
          ) : null}
          {clientResults.actions.length ? (
            <CommandGroup heading={query.trim() ? "Actions" : "Quick actions"}>
              {clientResults.actions.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`action-${item.id}-${item.label}`}
                  keywords={[item.description, item.keywords]}
                  onSelect={() => go(item.to)}
                >
                  {item.id === "new-clipping-job" ? (
                    <Scissors />
                  ) : item.id === "upload-media" ? (
                    <UploadCloud />
                  ) : (
                    <Plus />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    <span className="block truncate text-xs text-ink-mute">{item.description}</span>
                  </span>
                  {!query.trim() && item.id === "new-project" ? (
                    <CommandShortcut>N</CommandShortcut>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {projects.length ? (
            <ResultGroup heading="Projects" items={projects} onSelect={go} />
          ) : null}
          {uploads.length ? <ResultGroup heading="Uploads" items={uploads} onSelect={go} /> : null}
          {jobs.length ? <ResultGroup heading="Clipping jobs" items={jobs} onSelect={go} /> : null}
          {clientResults.pages.length || clientResults.settings.length ? (
            <CommandSeparator />
          ) : null}
          {clientResults.pages.length ? (
            <CommandGroup heading="Pages">
              {clientResults.pages.map((item) => (
                <CommandItem
                  key={item.to}
                  value={`page-${item.label}`}
                  keywords={[item.description]}
                  onSelect={() => go(item.to)}
                >
                  <Gauge />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    <span className="block truncate text-xs text-ink-mute">{item.description}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {clientResults.settings.length ? (
            <CommandGroup heading="Settings">
              {clientResults.settings.map((item) => (
                <CommandItem
                  key={item.to}
                  value={`setting-${item.label}`}
                  keywords={[item.description]}
                  onSelect={() => go(item.to)}
                >
                  <Settings />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    <span className="block truncate text-xs text-ink-mute">{item.description}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function ResultGroup({
  heading,
  items,
  onSelect,
}: {
  heading: string;
  items: WorkspaceSearchResult[];
  onSelect: (to: string) => void;
}) {
  return (
    <CommandGroup heading={heading}>
      {items.map((item) => {
        const Icon = resultIcons[item.type];
        return (
          <CommandItem
            key={`${item.type}-${item.id}`}
            value={`${item.type}-${item.title}-${item.id}`}
            onSelect={() => onSelect(item.to)}
          >
            <Icon />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{item.title}</span>
              <span className="block truncate text-xs text-ink-mute">{item.detail}</span>
            </span>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
