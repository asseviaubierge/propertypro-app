"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
  align?: "start" | "center" | "end";
  fromYear?: number;
  toYear?: number;
  id?: string;
}

const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Sélectionner une date",
  disabled,
  className,
  fromYear = 1920,
  toYear,
  id,
}: DatePickerProps) {
  const currentYear = new Date().getFullYear();
  const firstYear = Math.max(1920, fromYear || 1920);
  const requestedLastYear = toYear ?? currentYear;
  const lastYear = Math.max(firstYear, requestedLastYear);

  const [day, setDay] = React.useState(date ? date.getDate() : 0);
  const [month, setMonth] = React.useState(date ? date.getMonth() + 1 : 0);
  const [year, setYear] = React.useState(date ? date.getFullYear() : 0);

  React.useEffect(() => {
    setDay(date ? date.getDate() : 0);
    setMonth(date ? date.getMonth() + 1 : 0);
    setYear(date ? date.getFullYear() : 0);
  }, [date?.getTime()]);

  const maxDays = year && month ? daysInMonth(year, month) : 31;
  const years = React.useMemo(
    () => Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, i) => lastYear - i),
    [firstYear, lastYear]
  );

  const emitDate = (nextDay: number, nextMonth: number, nextYear: number) => {
    setDay(nextDay);
    setMonth(nextMonth);
    setYear(nextYear);

    if (!nextDay || !nextMonth || !nextYear) {
      onSelect?.(undefined);
      return;
    }

    const safeDay = Math.min(nextDay, daysInMonth(nextYear, nextMonth));
    if (safeDay !== nextDay) setDay(safeDay);

    const selected = new Date(nextYear, nextMonth - 1, safeDay, 12, 0, 0, 0);
    if (disabled?.(selected)) return;
    onSelect?.(selected);
  };

  const triggerClass = cn(
    "h-10 min-w-0 bg-white px-2 text-xs sm:h-11 sm:px-3 sm:text-sm",
    "[&_[data-slot=select-value]]:truncate"
  );
  const contentClass = "z-[100] max-h-[min(18rem,var(--radix-select-content-available-height))] bg-white";

  return (
    <div
      id={id}
      className={cn("grid w-full min-w-0 grid-cols-3 gap-2", className)}
      aria-label={placeholder}
    >
      <Select
        value={day ? String(day) : undefined}
        onValueChange={(value) => emitDate(Number(value), month, year)}
      >
        <SelectTrigger className={triggerClass} aria-label="Jour">
          <SelectValue placeholder="Jour" />
        </SelectTrigger>
        <SelectContent className={contentClass} position="popper" sideOffset={4}>
          {Array.from({ length: maxDays }, (_, index) => index + 1).map((value) => (
            <SelectItem key={value} value={String(value)}>{value}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={month ? String(month) : undefined}
        onValueChange={(value) => emitDate(day, Number(value), year)}
      >
        <SelectTrigger className={triggerClass} aria-label="Mois">
          <SelectValue placeholder="Mois" />
        </SelectTrigger>
        <SelectContent className={contentClass} position="popper" sideOffset={4}>
          {MONTHS.map((label, index) => (
            <SelectItem key={label} value={String(index + 1)}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={year ? String(year) : undefined}
        onValueChange={(value) => emitDate(day, month, Number(value))}
      >
        <SelectTrigger className={triggerClass} aria-label="Année">
          <SelectValue placeholder="Année" />
        </SelectTrigger>
        <SelectContent className={contentClass} position="popper" sideOffset={4}>
          {years.map((value) => (
            <SelectItem key={value} value={String(value)}>{value}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface FormDatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  className?: string;
  align?: "start" | "center" | "end";
  fromYear?: number;
  toYear?: number;
  id?: string;
}

export function FormDatePicker({ value, onChange, ...props }: FormDatePickerProps) {
  return <DatePicker date={value} onSelect={onChange} {...props} />;
}
