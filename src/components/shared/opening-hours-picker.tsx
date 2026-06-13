"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type OpeningHoursState = {
  weekdayOpen: string;
  weekdayClose: string;
};

const DEFAULT_HOURS: OpeningHoursState = {
  weekdayOpen: "09:00",
  weekdayClose: "22:00",
};

function formatTime12h(time24: string): string {
  if (!time24) return "";
  const [hourPart, minutePart] = time24.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time24;

  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function serializeOpeningHours(state: OpeningHoursState): string {
  return `Mon–Fri ${formatTime12h(state.weekdayOpen)} – ${formatTime12h(state.weekdayClose)}`;
}

function parseTimeTo24h(timeStr: string): string | null {
  const trimmed = timeStr.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = match12[2];
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return `${String(Number(match24[1])).padStart(2, "0")}:${match24[2]}`;
  }

  return null;
}

export function parseOpeningHours(value: string | null | undefined): OpeningHoursState {
  if (!value?.trim()) return { ...DEFAULT_HOURS };

  const weekdayMatch = value.match(/Mon[–-]Fri\s+(.+?)\s*[–-]\s*([^,]+)/i);
  const weekdayOpen = weekdayMatch ? parseTimeTo24h(weekdayMatch[1]) : null;
  const weekdayClose = weekdayMatch ? parseTimeTo24h(weekdayMatch[2]) : null;

  if (!weekdayOpen && !weekdayClose) {
    return { ...DEFAULT_HOURS };
  }

  return {
    weekdayOpen: weekdayOpen ?? DEFAULT_HOURS.weekdayOpen,
    weekdayClose: weekdayClose ?? DEFAULT_HOURS.weekdayClose,
  };
}

type OpeningHoursPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function OpeningHoursPicker({ value, onChange }: OpeningHoursPickerProps) {
  const [hours, setHours] = useState<OpeningHoursState>(() => parseOpeningHours(value));

  useEffect(() => {
    setHours(parseOpeningHours(value));
  }, [value]);

  function updateHours(patch: Partial<OpeningHoursState>) {
    const next = { ...hours, ...patch };
    setHours(next);
    onChange(serializeOpeningHours(next));
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <div className="rounded-lg border bg-background/80 p-3">
        <p className="mb-3 text-sm font-medium text-foreground">Mon–Fri</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Opens</Label>
            <Input
              type="time"
              value={hours.weekdayOpen}
              onChange={(e) => updateHours({ weekdayOpen: e.target.value })}
              className="cursor-pointer bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Closes</Label>
            <Input
              type="time"
              value={hours.weekdayClose}
              onChange={(e) => updateHours({ weekdayClose: e.target.value })}
              className="cursor-pointer bg-background"
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{serializeOpeningHours(hours)}</p>
    </div>
  );
}
