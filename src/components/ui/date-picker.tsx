import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { DateRange } from "react-day-picker"

interface DatePickerProps {
  selected?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  className?: string
  maxDate?: Date
  minDate?: Date
  // Legacy props for backward compatibility
  date?: Date
  onDateChange?: (date: Date) => void
}

export function DatePicker({ 
  selected, 
  onChange, 
  placeholder = "Pick a date", 
  disabled,
  className,
  maxDate,
  minDate,
  // Legacy props
  date,
  onDateChange
}: DatePickerProps) {
  // Use legacy props if provided, otherwise use new props
  const dateValue = selected || date
  const handleChange = onChange || ((date) => onDateChange && date && onDateChange(date))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? format(dateValue, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleChange}
          disabled={disabled || ((date) => {
            if (maxDate && date > maxDate) return true;
            if (minDate && date < minDate) return true;
            if (date < new Date("1900-01-01")) return true;
            return false;
          })}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  )
}

interface DatePickerWithRangeProps {
  className?: string
  selected?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  placeholder?: string
  // Legacy props for backward compatibility
  date?: DateRange
  setDate?: (range: DateRange) => void
}

export function DatePickerWithRange({
  className,
  selected,
  onSelect,
  placeholder = "Pick a date range",
  // Legacy props
  date,
  setDate
}: DatePickerWithRangeProps) {
  // Use legacy props if provided, otherwise use new props
  const dateValue = selected || date
  const handleSelect = onSelect || ((range) => setDate && range && setDate(range))

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !dateValue && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateValue?.from ? (
              dateValue.to ? (
                <>
                  {format(dateValue.from, "LLL dd, y")} -{" "}
                  {format(dateValue.to, "LLL dd, y")}
                </>
              ) : (
                format(dateValue.from, "LLL dd, y")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateValue?.from}
            selected={dateValue}
            onSelect={handleSelect}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}