import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { B } from "./bunik";

export type SelectOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  placeholder?: string;
  id?: string;
};

/** On-theme dropdown. Radix portals the list, so it is never clipped by a
 *  parent's overflow:hidden and the options can be fully styled. */
export function BunikSelect({ value, onChange, options, ariaLabel, placeholder, id }: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger id={id} className="bunik-field bunik-select-trigger" aria-label={ariaLabel}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown size={18} style={{ color: B.muted }} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="bunik-popover bunik-select-content">
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} className="bunik-select-item">
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator style={{ marginLeft: "auto", display: "inline-flex" }}>
                  <Check size={15} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
