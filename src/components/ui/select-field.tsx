import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink">
        {label}
      </label>
      <Select name={name} value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label} className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={6}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-ink-mute">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {option.badge ? (
                  <span className="ml-auto shrink-0 rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold text-ink-mute">
                    {option.badge}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint ? <div className="text-xs leading-5 text-ink-mute">{hint}</div> : null}
    </div>
  );
}
