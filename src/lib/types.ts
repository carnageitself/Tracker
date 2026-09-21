import type { LeadRow } from "./supabase/database.types";

export type Lead = LeadRow;

/**
 * The pipeline, in order. Each step is a nullable date column on `leads`:
 * a date means "reached, on that day"; null means "not there yet".
 */
export const MILESTONES = [
  "follow_up",
  "mg1",
  "mg2",
  "meet_in_person",
  "pv",
  "starter_pack",
] as const;

export type Milestone = (typeof MILESTONES)[number];

export const MILESTONE_LABELS: Record<Milestone, string> = {
  follow_up: "Follow up",
  mg1: "MG-1",
  mg2: "MG-2",
  meet_in_person: "Meet in person",
  pv: "PV",
  starter_pack: "Starter pack",
};

/** Short forms for the table's progress meter, where space is tight. */
export const MILESTONE_SHORT: Record<Milestone, string> = {
  follow_up: "FU",
  mg1: "MG1",
  mg2: "MG2",
  meet_in_person: "MIP",
  pv: "PV",
  starter_pack: "SP",
};

export type LeadDraft = {
  full_name: string;
  phone: string;
  email: string;
  lead_date: string;
  notes: string;
  pv_amount: number;
} & Record<Milestone, string | null>;

/** How far along the lead is: the furthest milestone with a date set. */
export function reachedCount(lead: Lead): number {
  let reached = 0;
  MILESTONES.forEach((milestone, index) => {
    if (lead[milestone]) reached = index + 1;
  });
  return reached;
}

export function currentStage(lead: Lead): string {
  const reached = reachedCount(lead);
  return reached === 0 ? "New" : MILESTONE_LABELS[MILESTONES[reached - 1]];
}

export function hasStarterPack(lead: Lead): boolean {
  return Boolean(lead.starter_pack);
}
