import { Check, ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SelectFieldOption = {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  disabled?: boolean;
};

export type SelectFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectFieldOption[];
  hint?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
  triggerClassName?: string;
};

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  hint,
  placeholder = "Choose an option",
  disabled,
  name,
  className,
  triggerClassName,
}: SelectFieldProps) {
  const id = useId();
  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink">
        {label}
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-label={label}
            disabled={disabled}
            className={cn(
              "group flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-line bg-surface-panel px-3 text-left text-sm text-ink shadow-sm outline-none transition",
              "hover:border-line-strong focus-visible:border-ember focus-visible:ring-2 focus-visible:ring-ember/20",
              "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-mute disabled:opacity-70",
              triggerClassName,
            )}
          >
            <span className={cn("min-w-0 truncate", !selected && "text-ink-mute")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[12rem]"
        >
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                textValue={`${option.label}${option.badge ? ` ${option.badge}` : ""}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block truncate text-[11px] font-normal text-ink-mute">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {option.badge ? (
                    <span className="ml-auto shrink-0 rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold text-ink-mute">
                      {option.badge}
                    </span>
                  ) : null}
                  {option.value === value ? (
                    <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ember" />
                  ) : null}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {name ? <input type="hidden" name={name} value={value} disabled={disabled} /> : null}
      {hint ? <div className="text-xs leading-5 text-ink-mute">{hint}</div> : null}
    </div>
  );
}
