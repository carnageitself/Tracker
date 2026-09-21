import type { CalendarProvider } from "../supabase/database.types";

export type { CalendarProvider };

/** One person found on one calendar event — the unit the import UI lists. */
export type ImportedContact = {
  /** Stable per provider+event+person, so re-importing updates in place. */
  externalId: string;
  provider: CalendarProvider;
  fullName: string;
  email: string;
  phone: string;
  /** Event start as YYYY-MM-DD; becomes the lead's Date. */
  date: string;
  eventTitle: string;
  startsAt: string;
};

/** Best-effort phone scrape from free text (Google events have no phone field). */
export function findPhone(...sources: Array<string | null | undefined>): string {
  const pattern = /(\+?\d[\d\s().-]{7,}\d)/;
  for (const source of sources) {
    const match = source?.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

/** Local calendar date for an ISO timestamp, as a plain YYYY-MM-DD. */
export function isoDateOf(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ") || email
  );
}
