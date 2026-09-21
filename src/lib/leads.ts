import { hasStarterPack, reachedCount, type Lead } from "./types";

export type Stats = {
  total: number;
  active: number;
  starterPacks: number;
  totalPv: number;
  conversion: number | null;
  followUpsDue: number;
};

export function computeStats(leads: Lead[], today = todayISO()): Stats {
  let starterPacks = 0;
  let totalPv = 0;
  let followUpsDue = 0;

  for (const lead of leads) {
    totalPv += Number(lead.pv_amount) || 0;
    if (hasStarterPack(lead)) starterPacks += 1;
    // Due = a follow-up date that has arrived on a lead that hasn't converted.
    else if (lead.follow_up && lead.follow_up <= today) followUpsDue += 1;
  }

  return {
    total: leads.length,
    active: leads.length - starterPacks,
    starterPacks,
    totalPv,
    followUpsDue,
    conversion: leads.length === 0 ? null : starterPacks / leads.length,
  };
}

export function formatPv(value: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact && value >= 10_000 ? 1 : 2,
  }).format(value);
}

/** Dates are plain `date` columns — parse as local, never as UTC midnight. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Furthest-along first, then most recently touched. */
export function byProgressThenRecent(a: Lead, b: Lead): number {
  const diff = reachedCount(b) - reachedCount(a);
  return diff !== 0 ? diff : b.updated_at.localeCompare(a.updated_at);
}
