import { z } from "zod";

import { KUWAIT_TIME_ZONE } from "@/lib/datetime/kuwait";

export const datePresetSchema = z.enum([
  "today", "7d", "30d", "90d", "this_month", "previous_month", "custom",
]);

export type DatePreset = z.infer<typeof datePresetSchema>;

function kuwaitDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KUWAIT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function calendarDate(parts: { year: number; month: number; day: number }) {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function moveCalendarDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

function monthStart(value: string, offset = 0) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10);
}

export function kuwaitCalendarDateToUtc(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day));
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: KUWAIT_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(guess);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(local.find((part) => part.type === type)?.value);
  const representedAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess.getTime() - (representedAsUtc - guess.getTime()));
}

export function resolveAnalyticsRange(input: {
  preset?: string;
  from?: string;
  to?: string;
  now?: Date;
}) {
  const preset = datePresetSchema.catch("30d").parse(input.preset);
  const today = calendarDate(kuwaitDateParts(input.now ?? new Date()));
  let from: string;
  let toExclusive: string;
  if (preset === "today") {
    from = today;
    toExclusive = moveCalendarDate(today, 1);
  } else if (preset === "7d" || preset === "30d" || preset === "90d") {
    const days = Number.parseInt(preset, 10);
    from = moveCalendarDate(today, -(days - 1));
    toExclusive = moveCalendarDate(today, 1);
  } else if (preset === "this_month") {
    from = monthStart(today);
    toExclusive = monthStart(today, 1);
  } else if (preset === "previous_month") {
    from = monthStart(today, -1);
    toExclusive = monthStart(today);
  } else {
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    from = valid.test(input.from ?? "") ? input.from! : moveCalendarDate(today, -29);
    const inclusiveTo = valid.test(input.to ?? "") ? input.to! : today;
    toExclusive = moveCalendarDate(inclusiveTo, 1);
  }
  const start = kuwaitCalendarDateToUtc(from);
  const end = kuwaitCalendarDateToUtc(toExclusive);
  if (end <= start || end.getTime() - start.getTime() > 366 * 86400000) {
    throw new Error("Analytics date range must be between 1 and 366 days");
  }
  const days = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  return {
    preset,
    from,
    to: moveCalendarDate(toExclusive, -1),
    start: start.toISOString(),
    end: end.toISOString(),
    bucket: days > 120 ? "month" : days > 31 ? "week" : "day",
  } as const;
}
