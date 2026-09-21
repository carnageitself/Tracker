import "server-only";

import { createClient } from "./supabase/server";
import type { Lead } from "./types";

export type ListRef = {
  ownerId: string;
  ownerEmail: string;
  canEdit: boolean;
  isOwn: boolean;
};

export type ShareGrant = {
  userId: string;
  email: string;
  canEdit: boolean;
};

export type Workspace = {
  userId: string;
  userEmail: string;
  /** Your own list first, then every list shared with you. */
  lists: ListRef[];
  /** People you have given access to your list. */
  sharedByMe: ShareGrant[];
};

/**
 * list_shares points at auth.users, which PostgREST can't join to profiles,
 * so emails are resolved with a second lookup rather than an embedded select.
 */
async function emailsFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email").in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, row.email]));
}

export async function getWorkspace(): Promise<Workspace | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [received, given] = await Promise.all([
    supabase
      .from("list_shares")
      .select("owner_id, can_edit")
      .eq("shared_with_id", user.id),
    supabase
      .from("list_shares")
      .select("shared_with_id, can_edit")
      .eq("owner_id", user.id),
  ]);

  const receivedRows = received.data ?? [];
  const givenRows = given.data ?? [];

  const emails = await emailsFor([
    ...receivedRows.map((row) => row.owner_id),
    ...givenRows.map((row) => row.shared_with_id),
  ]);

  const userEmail = user.email ?? "You";

  return {
    userId: user.id,
    userEmail,
    lists: [
      { ownerId: user.id, ownerEmail: userEmail, canEdit: true, isOwn: true },
      ...receivedRows.map((row) => ({
        ownerId: row.owner_id,
        ownerEmail: emails.get(row.owner_id) ?? "Unknown user",
        canEdit: row.can_edit,
        isOwn: false,
      })),
    ],
    sharedByMe: givenRows.map((row) => ({
      userId: row.shared_with_id,
      email: emails.get(row.shared_with_id) ?? "Unknown user",
      canEdit: row.can_edit,
    })),
  };
}

export async function getLeads(ownerId: string): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });

  // RLS turns "no access" into an empty result, which the page renders as an
  // empty list — surfacing a real query failure is worth the throw.
  if (error) throw new Error(error.message);
  return data ?? [];
}
