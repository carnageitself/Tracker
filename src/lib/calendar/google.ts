import "server-only";

import {
  findPhone,
  isoDateOf,
  nameFromEmail,
  type ImportedContact,
} from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Calendar is not configured. Set GOOGLE_CLIENT_ID and " +
        "GOOGLE_CLIENT_SECRET in .env.local.",
    );
  }
  return { clientId, clientSecret };
}

export function redirectUri(origin: string): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL || origin}/api/google/callback`;
}

export function consentUrl(origin: string, state: string): string {
  const { clientId } = googleCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    // offline + consent is what actually returns a refresh_token.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
};

function expiryFrom(expiresIn: number): string {
  // A minute of slack so a token never expires mid-request.
  return new Date(Date.now() + (expiresIn - 60) * 1000).toISOString();
}

export async function exchangeCode(
  code: string,
  origin: string,
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: expiryFrom(data.expires_in),
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleCredentials();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(
      "Google access expired and could not be renewed. Reconnect the account.",
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  // A refresh response doesn't resend the refresh token; keep the stored one.
  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: expiryFrom(data.expires_in),
  };
}

export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    self?: boolean;
    organizer?: boolean;
    resource?: boolean;
  }>;
};

/**
 * Attendees of events in the window, one contact per attendee. The organiser
 * and the connected account itself are skipped — they aren't leads.
 */
export async function fetchContacts(
  accessToken: string,
  daysBack: number,
  daysForward: number,
): Promise<ImportedContact[]> {
  const now = Date.now();
  const params = new URLSearchParams({
    timeMin: new Date(now - daysBack * 86_400_000).toISOString(),
    timeMax: new Date(now + daysForward * 86_400_000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const response = await fetch(`${EVENTS_URL}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google Calendar request failed: ${await response.text()}`);
  }

  const data = (await response.json()) as { items?: GoogleEvent[] };
  const contacts: ImportedContact[] = [];

  for (const event of data.items ?? []) {
    const startsAt = event.start?.dateTime ?? event.start?.date;
    if (!startsAt) continue;

    for (const attendee of event.attendees ?? []) {
      if (!attendee.email || attendee.self || attendee.organizer || attendee.resource) {
        continue;
      }

      contacts.push({
        externalId: `google:${event.id}:${attendee.email.toLowerCase()}`,
        provider: "google",
        fullName: attendee.displayName?.trim() || nameFromEmail(attendee.email),
        email: attendee.email.toLowerCase(),
        phone: findPhone(event.description, event.location),
        date: isoDateOf(startsAt),
        eventTitle: event.summary?.trim() || "(no title)",
        startsAt,
      });
    }
  }

  return contacts;
}
