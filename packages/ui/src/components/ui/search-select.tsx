import { useState } from 'react'
import { AltArrowDownIcon, CheckIcon } from '../../icons'
import { Button } from './button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

type SearchOption = {
  value: string
  label: string
  description?: string
}

export function SearchSelect({
  id,
  value,
  options,
  placeholder,
  searchLabel,
  emptyLabel,
  customLabel,
  disabled,
  onChange,
}: {
  id: string
  value: string
  options: readonly SearchOption[]
  placeholder: string
  searchLabel: string
  emptyLabel: string
  customLabel?: (value: string) => string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.value === value)
  const typedValue = query.trim()
  const offerCustom = customLabel && typedValue
    && !options.some((option) => option.value.toLowerCase() === typedValue.toLowerCase())

  function select(next: string) {
    if (next !== value) onChange(next)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next)
      setQuery('')
    }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          role="combobox"
          variant="outline"
          aria-expanded={open}
          disabled={disabled}
          className="w-full min-w-0 justify-between px-3 font-normal"
        >
          <span className="truncate">{selected?.label || value || placeholder}</span>
          <AltArrowDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) max-w-(--radix-popover-content-available-width) overflow-hidden p-0"
      >
        <Command label={searchLabel}>
          <CommandInput aria-label={searchLabel} placeholder={searchLabel} value={query} onValueChange={setQuery} />
          <CommandList>
            {!offerCustom && <CommandEmpty>{emptyLabel}</CommandEmpty>}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.description ?? '']}
                  onSelect={() => select(option.value)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block wrap-anywhere">{option.label}</span>
                    {option.description ? (
                      <span className="block wrap-anywhere text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                  {option.value === value ? <CheckIcon /> : null}
                </CommandItem>
              ))}
              {offerCustom ? (
                <CommandItem value={`custom:${typedValue}`} forceMount onSelect={() => select(typedValue)}>
                  <span className="wrap-anywhere">{customLabel(typedValue)}</span>
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
