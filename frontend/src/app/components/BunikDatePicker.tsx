import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { DayPicker } from "react-day-picker";
import { vi } from "date-fns/locale";
import { format, isValid, parse } from "date-fns";
import { CalendarDays } from "lucide-react";
import "react-day-picker/dist/style.css";
import { B } from "./bunik";

type Props = {
  value: string; // ISO yyyy-MM-dd, or "" when empty
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
};

function parseISO(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

/** On-theme date picker. Vietnamese locale, dd/MM/yyyy display, and month/year
 *  dropdowns so distant years (e.g. a date of birth) are one click away. */
export function BunikDatePicker({ value, onChange, placeholder = "Chọn ngày", ariaLabel, id }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const thisYear = new Date().getFullYear();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" id={id} className="bunik-field bunik-select-trigger" aria-label={ariaLabel ?? placeholder}>
          <span style={{ color: selected ? B.ink : B.muted }}>
            {selected ? format(selected, "dd/MM/yyyy") : placeholder}
          </span>
          <CalendarDays size={18} style={{ color: B.muted }} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} className="bunik-popover">
          <DayPicker
            mode="single"
            locale={vi}
            selected={selected}
            defaultMonth={selected ?? new Date(thisYear - 16, 0)}
            captionLayout="dropdown-buttons"
            fromYear={thisYear - 100}
            toYear={thisYear}
            showOutsideDays
            className="bunik-datepicker"
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
