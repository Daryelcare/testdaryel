import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateTextPickerProps {
  value: Date | string | undefined;
  onChange: (value: Date | string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateTextPicker({
  value,
  onChange,
  placeholder = "Pick a date or enter text",
  className,
}: DateTextPickerProps) {
  const [isTextMode, setIsTextMode] = React.useState(
    value instanceof Date ? false : !!value
  );
  const [textValue, setTextValue] = React.useState(
    value instanceof Date ? "" : (value as string) || ""
  );

  const dateValue = value instanceof Date ? value : undefined;

  const handleTextChange = (text: string) => {
    setTextValue(text);
    onChange(text);
  };

  const handleDateChange = (date: Date | undefined) => {
    onChange(date);
  };

  const toggleMode = () => {
    setIsTextMode(!isTextMode);
    if (!isTextMode) {
      // Switching to text mode
      onChange(textValue);
    } else {
      // Switching to date mode
      onChange(undefined);
      setTextValue("");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={isTextMode ? "outline" : "default"}
          size="sm"
          onClick={toggleMode}
          className="px-2 py-1 h-auto text-xs"
        >
          Date
        </Button>
        <Button
          type="button"
          variant={isTextMode ? "default" : "outline"}
          size="sm"
          onClick={toggleMode}
          className="px-2 py-1 h-auto text-xs"
        >
          Text
        </Button>
      </div>
      
      {isTextMode ? (
        <Input
          value={textValue}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateValue && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleDateChange}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}