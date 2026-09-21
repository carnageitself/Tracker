"use server";

import { revalidatePath } from "next/cache";
import { fetchAccount } from "@/lib/calendar/calendly";
import { fetchContactsFor } from "@/lib/calendar/connections";
import type { ImportedContact } from "@/lib/calendar/types";
import { createClient } from "@/lib/supabase/server";
import type { CalendarProvider } from "@/lib/supabase/database.types";

export type ActionResult = { error?: string };

export async function connectCalendly(token: string): Promise<ActionResult> {
  const trimmed = token.trim();
  if (!trimmed) return { error: "Paste your Calendly personal access token." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  try {
    // Verify before storing, so a bad token fails here rather than at import.
    const account = await fetchAccount(trimmed);

    const { error } = await supabase.from("calendar_connections").upsert(
      {
        user_id: user.id,
        provider: "calendly" as const,
        access_token: trimmed,
        account_email: account.email,
      },
      { onConflict: "user_id,provider" },
    );

    if (error) return { error: error.message };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : "Could not reach Calendly.",
    };
  }

  revalidatePath("/integrations");
  return {};
}

export async function disconnect(provider: CalendarProvider): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("calendar_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) return { error: error.message };
  revalidatePath("/integrations");
  return {};
}

/** Discriminated on `ok` — an optional `error` wouldn't narrow on truthiness. */
export type PreviewResult =
  | { ok: false; error: string }
  | { ok: true; contacts: ImportedContact[]; alreadyImported: string[] };

/** Fetch calendar contacts and flag the ones already in this list. */
export async function previewImport(
  provider: CalendarProvider,
  daysBack: number,
  daysForward: number,
): Promise<PreviewResult> {
  try {
    const contacts = await fetchContactsFor(provider, daysBack, daysForward);
    if (contacts.length === 0) return { ok: true, contacts: [], alreadyImported: [] };

    const supabase = await createClient();
    const { data } = await supabase
      .from("leads")
      .select("external_id")
      .in(
        "external_id",
        contacts.map((contact) => contact.externalId),
      );

    return {
      ok: true,
      contacts,
      alreadyImported: (data ?? [])
        .map((row) => row.external_id)
        .filter((id): id is string => Boolean(id)),
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Could not load calendar events.",
    };
  }
}

export type ImportSummary = { error?: string; imported?: number; updated?: number };

/**
 * Upserts on (owner_id, external_id), so re-importing an event refreshes the
 * contact details instead of creating a second lead. Pipeline dates and PV
 * already recorded against an existing lead are left untouched.
 */
export async function importContacts(
  ownerId: string,
  contacts: ImportedContact[],
): Promise<ImportSummary> {
  if (contacts.length === 0) return { error: "Nothing selected." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("leads")
    .select("external_id")
    .eq("owner_id", ownerId)
    .in(
      "external_id",
      contacts.map((contact) => contact.externalId),
    );

  const known = new Set(
    (existing ?? []).map((row) => row.external_id).filter(Boolean) as string[],
  );

  const rows = contacts.map((contact) => ({
    owner_id: ownerId,
    external_id: contact.externalId,
    source: contact.provider,
    full_name: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    lead_date: contact.date,
  }));

  const { error } = await supabase
    .from("leads")
    .upsert(rows as never, { onConflict: "owner_id,external_id" });

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/integrations");

  return {
    imported: rows.length - known.size,
    updated: known.size,
  };
}
