"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MILESTONES, type LeadDraft } from "@/lib/types";

export type ActionResult = { error?: string };

function toRow(draft: LeadDraft) {
  const row: Record<string, unknown> = {
    full_name: draft.full_name.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim().toLowerCase(),
    lead_date: draft.lead_date,
    notes: draft.notes.trim(),
    pv_amount: Number.isFinite(draft.pv_amount) ? Math.max(0, draft.pv_amount) : 0,
  };
  for (const milestone of MILESTONES) row[milestone] = draft[milestone] || null;
  return row;
}

function validate(draft: LeadDraft): string | null {
  if (!draft.full_name.trim()) return "Full name is required.";
  if (!draft.lead_date) return "Date is required.";
  return null;
}

export async function createLead(
  ownerId: string,
  draft: LeadDraft,
): Promise<ActionResult> {
  const invalid = validate(draft);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .insert({ ...toRow(draft), owner_id: ownerId } as never);

  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

export async function updateLead(
  id: string,
  draft: LeadDraft,
): Promise<ActionResult> {
  const invalid = validate(draft);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update(toRow(draft) as never)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

export async function deleteLead(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

/** Toggle a single milestone straight from the table row. */
export async function setMilestone(
  id: string,
  milestone: (typeof MILESTONES)[number],
  date: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ [milestone]: date } as never)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

export async function shareList(
  email: string,
  canEdit: boolean,
): Promise<ActionResult> {
  const trimmed = email.trim();
  if (!trimmed) return { error: "Enter an email address." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("share_list_with_email", {
    target_email: trimmed,
    allow_edit: canEdit,
  });

  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

/** Owner revoking a grant, or a recipient leaving a list they were given. */
export async function removeShare(
  ownerId: string,
  sharedWithId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("list_shares")
    .delete()
    .eq("owner_id", ownerId)
    .eq("shared_with_id", sharedWithId);

  if (error) return { error: error.message };
  revalidatePath("/");
  return {};
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
