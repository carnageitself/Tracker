import "server-only";

import { findPhone, isoDateOf, type ImportedContact } from "./types";

const API = "https://api.calendly.com";

/**
 * Calendly is connected with a personal access token rather than OAuth —
 * no app review, and each user pastes their own token, which fits the
 * per-user model here. Create one at calendly.com/integrations/api_webhooks.
 */
async function call<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new Error("Calendly rejected the token. Paste a fresh one.");
  }
  if (!response.ok) {
    throw new Error(`Calendly request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}

type CalendlyUser = { resource: { uri: string; email: string; name: string } };

export async function fetchAccount(
  token: string,
): Promise<{ uri: string; email: string }> {
  const data = await call<CalendlyUser>(token, "/users/me");
  return { uri: data.resource.uri, email: data.resource.email };
}

type ScheduledEvent = {
  uri: string;
  name?: string;
  start_time: string;
  status: string;
};

type Invitee = {
  uri: string;
  name?: string;
  email?: string;
  text_reminder_number?: string | null;
  questions_and_answers?: Array<{ question: string; answer: string }>;
};

function phoneOf(invitee: Invitee): string {
  if (invitee.text_reminder_number) return invitee.text_reminder_number;

  const answer = invitee.questions_and_answers?.find((entry) =>
    /phone|mobile|cell|whatsapp|number/i.test(entry.question),
  );
  // Fall back to scanning every answer — booking forms word this many ways.
  return (
    answer?.answer.trim() ||
    findPhone(...(invitee.questions_and_answers ?? []).map((entry) => entry.answer))
  );
}

/** Invitees of non-cancelled bookings in the window. */
export async function fetchContacts(
  token: string,
  daysBack: number,
  daysForward: number,
): Promise<ImportedContact[]> {
  const account = await fetchAccount(token);
  const now = Date.now();

  const params = new URLSearchParams({
    user: account.uri,
    min_start_time: new Date(now - daysBack * 86_400_000).toISOString(),
    max_start_time: new Date(now + daysForward * 86_400_000).toISOString(),
    count: "100",
    sort: "start_time:desc",
  });

  const events = await call<{ collection: ScheduledEvent[] }>(
    token,
    `/scheduled_events?${params}`,
  );

  const active = events.collection.filter((event) => event.status !== "canceled");

  // One invitee request per event; Calendly has no bulk invitee endpoint.
  const perEvent = await Promise.all(
    active.map(async (event) => {
      const uuid = event.uri.split("/").pop();
      if (!uuid) return [];

      const invitees = await call<{ collection: Invitee[] }>(
        token,
        `/scheduled_events/${uuid}/invitees`,
      );

      return invitees.collection.flatMap<ImportedContact>((invitee) => {
        if (!invitee.email) return [];
        return [
          {
            externalId: `calendly:${invitee.uri}`,
            provider: "calendly",
            fullName: invitee.name?.trim() || invitee.email,
            email: invitee.email.toLowerCase(),
            phone: phoneOf(invitee),
            date: isoDateOf(event.start_time),
            eventTitle: event.name?.trim() || "Calendly booking",
            startsAt: event.start_time,
          },
        ];
      });
    }),
  );

  return perEvent.flat();
}
