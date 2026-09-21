"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, INPUT, LABEL } from "@/components/ui";
import { formatDate } from "@/lib/leads";
import type { ConnectionInfo } from "@/lib/calendar/connections";
import type { ImportedContact } from "@/lib/calendar/types";
import type { CalendarProvider } from "@/lib/supabase/database.types";
import { connectCalendly, disconnect, importContacts, previewImport } from "./actions";

const ERROR_TEXT: Record<string, string> = {
  google_not_configured:
    "Google isn't configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  google_denied: "You declined the Google permission request.",
  google_state_mismatch: "That sign-in link expired. Try connecting again.",
  google_exchange_failed: "Google wouldn't complete the connection. Try again.",
  google_save_failed: "Connected to Google, but saving the connection failed.",
};

const DAYS_BACK = 90;
const DAYS_FORWARD = 30;

export function IntegrationsPanel({
  userId,
  connections,
  googleConfigured,
  errorCode,
  connectedCode,
}: {
  userId: string;
  connections: ConnectionInfo[];
  googleConfigured: boolean;
  errorCode: string | null;
  connectedCode: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [message, setMessage] = useState<string | null>(
    errorCode ? (ERROR_TEXT[errorCode] ?? "Something went wrong.") : null,
  );
  const [isError, setIsError] = useState(Boolean(errorCode));
  const [token, setToken] = useState("");

  const [activeProvider, setActiveProvider] = useState<CalendarProvider | null>(null);
  const [contacts, setContacts] = useState<ImportedContact[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [alreadyImported, setAlreadyImported] = useState<Set<string>>(new Set());

  const byProvider = new Map(connections.map((entry) => [entry.provider, entry]));

  function report(text: string, failed: boolean) {
    setMessage(text);
    setIsError(failed);
  }

  function loadPreview(provider: CalendarProvider) {
    setActiveProvider(provider);
    setContacts(null);
    setMessage(null);

    startTransition(async () => {
      const result = await previewImport(provider, DAYS_BACK, DAYS_FORWARD);
      if (!result.ok) {
        report(result.error, true);
        setActiveProvider(null);
        return;
      }

      const done = new Set(result.alreadyImported);
      setContacts(result.contacts);
      setAlreadyImported(done);
      // Pre-tick everything new; leave already-imported rows unticked.
      setSelected(
        new Set(
          result.contacts
            .filter((contact) => !done.has(contact.externalId))
            .map((contact) => contact.externalId),
        ),
      );
    });
  }

  function runImport() {
    if (!contacts) return;
    const chosen = contacts.filter((contact) => selected.has(contact.externalId));

    startTransition(async () => {
      const result = await importContacts(userId, chosen);
      if (result.error) {
        report(result.error, true);
        return;
      }
      report(
        `Imported ${result.imported ?? 0} new lead${result.imported === 1 ? "" : "s"}` +
          (result.updated ? `, refreshed ${result.updated}.` : "."),
        false,
      );
      setContacts(null);
      setActiveProvider(null);
      router.refresh();
    });
  }

  function toggle(externalId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  }

  function handleCalendly(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await connectCalendly(token);
      if (result.error) report(result.error, true);
      else {
        report("Calendly connected.", false);
        setToken("");
        router.refresh();
      }
    });
  }

  function handleDisconnect(provider: CalendarProvider) {
    startTransition(async () => {
      const result = await disconnect(provider);
      if (result.error) report(result.error, true);
      else {
        report(`Disconnected ${provider}.`, false);
        if (activeProvider === provider) {
          setActiveProvider(null);
          setContacts(null);
        }
        router.refresh();
      }
    });
  }

  const google = byProvider.get("google");
  const calendly = byProvider.get("calendly");

  return (
    <div className="mt-6 space-y-4">
      {message ? (
        <p
          role={isError ? "alert" : "status"}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: isError ? "var(--status-critical)" : "var(--status-good)",
            color: isError ? "var(--status-critical)" : "var(--status-good)",
          }}
        >
          {message}
        </p>
      ) : connectedCode === "google" ? (
        <p role="status" className="text-sm" style={{ color: "var(--status-good)" }}>
          Google Calendar connected.
        </p>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-medium text-ink">Google Calendar</h2>
            <p className="mt-0.5 text-sm text-ink-secondary">
              {google
                ? `Connected as ${google.accountEmail ?? "your Google account"}`
                : "Import attendees from your calendar events."}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            {google ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => loadPreview("google")}
                  className={BTN_PRIMARY}
                >
                  Import
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDisconnect("google")}
                  className={BTN_SECONDARY}
                >
                  Disconnect
                </button>
              </>
            ) : googleConfigured ? (
              <a href="/api/google/connect" className={BTN_PRIMARY}>
                Connect
              </a>
            ) : (
              <span className="text-xs text-ink-muted">Not configured on the server</span>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-medium text-ink">Calendly</h2>
            <p className="mt-0.5 text-sm text-ink-secondary">
              {calendly
                ? `Connected as ${calendly.accountEmail ?? "your Calendly account"}`
                : "Import invitees from your scheduled bookings."}
            </p>
          </div>

          {calendly ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => loadPreview("calendly")}
                className={BTN_PRIMARY}
              >
                Import
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleDisconnect("calendly")}
                className={BTN_SECONDARY}
              >
                Disconnect
              </button>
            </div>
          ) : null}
        </div>

        {!calendly ? (
          <form onSubmit={handleCalendly} className="mt-4 max-w-md">
            <label htmlFor="calendly-token" className={LABEL}>
              Personal access token
            </label>
            <input
              id="calendly-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="eyJraWQiOi…"
              className={INPUT}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Create one under Calendly → Integrations → API &amp; Webhooks.
            </p>
            <button type="submit" disabled={pending} className={`${BTN_PRIMARY} mt-3`}>
              {pending ? "Checking…" : "Connect"}
            </button>
          </form>
        ) : null}
      </section>

      {/* ------------------------- import preview ------------------------ */}
      {pending && contacts === null && activeProvider ? (
        <p className="text-sm text-ink-secondary">Loading calendar events…</p>
      ) : null}

      {contacts ? (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gridline p-4">
            <div>
              <h2 className="font-medium text-ink">
                {contacts.length} contact{contacts.length === 1 ? "" : "s"} found
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Last {DAYS_BACK} days and next {DAYS_FORWARD}. Already-imported rows
                start unticked.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setContacts(null);
                  setActiveProvider(null);
                }}
                className={BTN_SECONDARY}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || selected.size === 0}
                onClick={runImport}
                className={BTN_PRIMARY}
              >
                {pending ? "Importing…" : `Import ${selected.size}`}
              </button>
            </div>
          </div>

          {contacts.length === 0 ? (
            <p className="p-6 text-sm text-ink-muted">
              No attendees found in that window.
            </p>
          ) : (
            <ul className="divide-y divide-gridline">
              {contacts.map((contact) => {
                const done = alreadyImported.has(contact.externalId);
                return (
                  <li key={contact.externalId}>
                    <label className="flex cursor-pointer items-start gap-3 p-4 hover:bg-wash">
                      <input
                        type="checkbox"
                        checked={selected.has(contact.externalId)}
                        onChange={() => toggle(contact.externalId)}
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-medium text-ink">{contact.fullName}</span>
                          {done ? (
                            <span className="text-xs text-ink-muted">
                              already imported
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-ink-secondary">
                          {contact.email}
                          {contact.phone ? ` · ${contact.phone}` : ""}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          {contact.eventTitle} · {formatDate(contact.date)}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
