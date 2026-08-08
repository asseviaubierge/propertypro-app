"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

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
  // Les formulaires de naissance restent limités à l'année courante par défaut,
  // mais les formulaires métier (baux, échéances, etc.) peuvent explicitement
  // autoriser des années futures avec `toYear`.
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

    // Midi local évite le décalage d'un jour lors de la conversion ISO.
    const selected = new Date(nextYear, nextMonth - 1, safeDay, 12, 0, 0, 0);
    if (disabled?.(selected)) return;
    onSelect?.(selected);
  };

  const selectClass = cn(
    "h-11 min-w-0 rounded-md border-2 border-border/60 bg-background px-3 text-sm",
    "focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20",
    "disabled:cursor-not-allowed disabled:opacity-50"
  );

  return (
    <div id={id} className={cn("grid w-full grid-cols-3 gap-2", className)} aria-label={placeholder}>
      <select
        className={selectClass}
        value={day || ""}
        onChange={(event) => emitDate(Number(event.target.value), month, year)}
        aria-label="Jour"
      >
        <option value="">Jour</option>
        {Array.from({ length: maxDays }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={month || ""}
        onChange={(event) => emitDate(day, Number(event.target.value), year)}
        aria-label="Mois"
      >
        <option value="">Mois</option>
        {MONTHS.map((label, index) => (
          <option key={label} value={index + 1}>{label}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={year || ""}
        onChange={(event) => emitDate(day, month, Number(event.target.value))}
        aria-label="Année"
      >
        <option value="">Année</option>
        {years.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
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
