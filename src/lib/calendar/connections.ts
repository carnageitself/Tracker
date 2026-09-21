import "server-only";

import { createClient } from "../supabase/server";
import type { CalendarProvider } from "../supabase/database.types";
import * as calendly from "./calendly";
import * as google from "./google";
import type { ImportedContact } from "./types";

export type ConnectionInfo = {
  provider: CalendarProvider;
  accountEmail: string | null;
  connectedAt: string;
};

export async function getConnections(): Promise<ConnectionInfo[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("calendar_connections")
    .select("provider, account_email, created_at")
    .eq("user_id", user.id);

  return (data ?? []).map((row) => ({
    provider: row.provider,
    accountEmail: row.account_email,
    connectedAt: row.created_at,
  }));
}

/**
 * Returns a usable Google access token, refreshing and re-storing it first
 * if the stored one has expired.
 */
async function googleAccessToken(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (!data?.access_token) {
    throw new Error("Google Calendar is not connected.");
  }

  const expired = !data.expires_at || new Date(data.expires_at) <= new Date();
  if (!expired) return data.access_token;

  if (!data.refresh_token) {
    throw new Error("Google access expired. Reconnect the account.");
  }

  const refreshed = await google.refreshAccessToken(data.refresh_token);
  await supabase
    .from("calendar_connections")
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
    })
    .eq("user_id", userId)
    .eq("provider", "google");

  return refreshed.accessToken;
}

export async function fetchContactsFor(
  provider: CalendarProvider,
  daysBack: number,
  daysForward: number,
): Promise<ImportedContact[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  if (provider === "google") {
    return google.fetchContacts(await googleAccessToken(user.id), daysBack, daysForward);
  }

  const { data } = await supabase
    .from("calendar_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "calendly")
    .maybeSingle();

  if (!data?.access_token) throw new Error("Calendly is not connected.");
  return calendly.fetchContacts(data.access_token, daysBack, daysForward);
}
