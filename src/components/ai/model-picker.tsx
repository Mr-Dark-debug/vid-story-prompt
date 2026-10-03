import { Check, ChevronsUpDown, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ModelLogo } from "@/components/primitives/provider-logo";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { AiModelGroup } from "@/services/ai/server";
import {
  buildSections,
  capabilityChips,
  flattenGroups,
  formatContext,
  priceHint,
  pushRecent,
  toggleFavorite,
  type PickerModel,
} from "./model-catalog";

const FAVORITES_KEY = "vidrial.ai.favorite-models";
const RECENTS_KEY = "vidrial.ai.recent-models";

/** Per-viewer convenience only; storage may be unavailable, in which case the list is in-memory. */
function useStoredList(storageKey: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(parsed)) setList(parsed.filter((item) => typeof item === "string"));
    } catch {
      // Keep the empty default.
    }
  }, [storageKey]);
  const update = useCallback(
    (next: (current: string[]) => string[]) => {
      setList((current) => {
        const value = next(current);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(value));
        } catch {
          // Storage can be blocked; the in-memory value still applies.
        }
        return value;
      });
    },
    [storageKey],
  );
  return [list, update] as const;
}

function ModelRow({
  model,
  selected,
  favorite,
  onToggleFavorite,
}: {
  model: PickerModel;
  selected: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const context = formatContext(model.contextWindow);
  const price = priceHint(model.pricing);
  const chips = capabilityChips(model);
  return (
    <>
      <ModelLogo family={model.family} provider={model.providerId} size={22} className="mr-3" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{model.displayName}</span>
          {selected ? <Check aria-hidden className="size-3.5 shrink-0 text-ink" /> : null}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-mute">
          {context ? <span>{context} context</span> : null}
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded border border-line bg-surface-sunken px-1 py-px text-[10px] font-medium text-ink-soft"
            >
              {chip}
            </span>
          ))}
          {price ? <span>{price}</span> : null}
        </span>
      </span>
      <button
        type="button"
        aria-label={`${favorite ? "Remove" : "Add"} ${model.displayName} ${favorite ? "from" : "to"} favorites`}
        aria-pressed={favorite}
        className="ml-2 grid size-8 shrink-0 place-items-center rounded-md text-ink-mute hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
      >
        <Star aria-hidden className={cn("size-4", favorite && "fill-current text-ink")} />
      </button>
    </>
  );
}

function PickerBody({
  models,
  value,
  none,
  onSelect,
}: {
  models: PickerModel[];
  value: string | null;
  none?: { label: string };
  onSelect: (model: PickerModel | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [favorites, updateFavorites] = useStoredList(FAVORITES_KEY);
  const [recents, updateRecents] = useStoredList(RECENTS_KEY);
  const sections = useMemo(
    () => buildSections(models, { query, favorites, recents }),
    [models, query, favorites, recents],
  );

  return (
    <Command shouldFilter={false} loop label="Search models" className="bg-transparent">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search models, makers or providers"
      />
      <CommandList className="max-h-[min(24rem,60dvh)]">
        {models.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-soft">
            No models yet. Connect a provider key in AI providers settings.
          </p>
        ) : (
          <CommandEmpty>No models match your search.</CommandEmpty>
        )}
        {none && !query ? (
          <CommandGroup>
            <CommandItem value="__none__" onSelect={() => onSelect(null)}>
              <span className="text-sm text-ink-soft">{none.label}</span>
              {value === null ? <Check aria-hidden className="ml-auto size-3.5" /> : null}
            </CommandItem>
          </CommandGroup>
        ) : null}
        {sections.map((section) => (
          <CommandGroup key={section.id} heading={section.label}>
            {section.models.map((model) => (
              <CommandItem
                key={`${section.id}:${model.key}`}
                value={`${section.id}:${model.key}`}
                onSelect={() => {
                  updateRecents((current) => pushRecent(current, model.key));
                  onSelect(model);
                }}
                className="min-h-12 items-center py-2"
              >
                <ModelRow
                  model={model}
                  selected={model.key === value}
                  favorite={favorites.includes(model.key)}
                  onToggleFavorite={() =>
                    updateFavorites((current) => toggleFavorite(current, model.key))
                  }
                />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  );
}

export type ModelPickerProps = {
  groups: readonly AiModelGroup[];
  /** `credentialId::modelId`, or null for "nothing chosen". */
  value: string | null;
  onChange: (model: PickerModel | null) => void;
  placeholder?: string;
  none?: { label: string };
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export function ModelPicker({
  groups,
  value,
  onChange,
  placeholder = "Choose a model",
  none,
  disabled,
  className,
  ariaLabel = "Model",
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const models = useMemo(() => flattenGroups(groups), [groups]);
  const selected = useMemo(
    () => models.find((model) => model.key === value) ?? null,
    [models, value],
  );

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={open}
      disabled={disabled}
      className={cn("w-full justify-between gap-2 font-normal", className)}
    >
      <span className="flex min-w-0 items-center gap-2">
        {selected ? (
          <ModelLogo family={selected.family} provider={selected.providerId} size={18} />
        ) : null}
        <span className={cn("truncate", !selected && "text-ink-mute")}>
          {selected ? selected.displayName : (none?.label ?? placeholder)}
        </span>
      </span>
      <ChevronsUpDown aria-hidden className="size-4 opacity-60" />
    </Button>
  );
  const body = (
    <PickerBody
      models={models}
      value={value}
      none={none}
      onSelect={(model) => {
        onChange(model);
        setOpen(false);
      }}
    />
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="h-[85dvh] gap-0 rounded-t-2xl p-0">
          <SheetTitle className="px-4 pt-4 text-base">Choose a model</SheetTitle>
          <SheetDescription className="px-4 pb-2 text-xs">
            Models from your connected provider keys.
          </SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[min(34rem,calc(100vw-2rem))] p-0">
        {body}
      </PopoverContent>
    </Popover>
  );
}
