"use client";

import { useEffect, useRef, useState } from "react";
import { todayISO } from "@/lib/leads";
import {
  MILESTONES,
  MILESTONE_LABELS,
  type Lead,
  type LeadDraft,
} from "@/lib/types";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  DIALOG,
  INPUT,
  LABEL,
  TEXTAREA,
} from "./ui";

function Field({
  label,
  children,
  span2 = false,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <label className={`block ${span2 ? "sm:col-span-2" : ""}`}>
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

export function LeadDialog({
  open,
  lead,
  canEdit,
  onSubmit,
  onClose,
}: {
  open: boolean;
  /** Present when editing, null when adding. */
  lead: Lead | null;
  canEdit: boolean;
  onSubmit: (draft: LeadDraft) => Promise<string | null>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Native <dialog> gives us Escape, the backdrop, and focus containment.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? "").trim();

    const draft = {
      full_name: read("full_name"),
      phone: read("phone"),
      email: read("email"),
      lead_date: read("lead_date") || todayISO(),
      notes: read("notes"),
      pv_amount: Math.max(0, Number(data.get("pv_amount")) || 0),
    } as LeadDraft;

    for (const milestone of MILESTONES) {
      draft[milestone] = read(milestone) || null;
    }

    setPending(true);
    setError(null);
    const failure = await onSubmit(draft);
    setPending(false);
    if (failure) setError(failure);
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="lead-dialog-title"
      className={`${DIALOG} sm:w-[min(44rem,calc(100vw-2rem))]`}
    >
      {/* Remounting per lead resets every uncontrolled field to its defaults. */}
      <form
        key={lead?.id ?? "new"}
        onSubmit={handleSubmit}
        className="flex max-h-dvh flex-col sm:max-h-[90dvh]"
      >
        <header className="border-b border-gridline px-5 py-4">
          <h2
            id="lead-dialog-title"
            className="font-semibold tracking-tight text-ink"
          >
            {canEdit ? (lead ? "Edit lead" : "Add lead") : "Lead details"}
          </h2>
        </header>

        {/* The scroll container is a div, not the fieldset: a fieldset as a
            flex item ignores the height cap, letting content slide under the
            footer once the form is taller than the viewport. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <fieldset disabled={!canEdit} className="m-0 border-0 p-0">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name">
                {/* showModal() focuses the autofocus element; without it the
                    scrollable div above takes focus first. */}
                <input
                  name="full_name"
                  required
                  autoFocus
                  autoComplete="off"
                  defaultValue={lead?.full_name}
                  className={INPUT}
                />
              </Field>
              <Field label="Phone number">
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={lead?.phone}
                  className={INPUT}
                />
              </Field>
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  defaultValue={lead?.email}
                  className={INPUT}
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  name="lead_date"
                  required
                  defaultValue={lead?.lead_date ?? todayISO()}
                  className={INPUT}
                />
              </Field>
              <Field label="PV (personal volume)">
                <input
                  type="number"
                  name="pv_amount"
                  min={0}
                  step="0.01"
                  defaultValue={lead?.pv_amount ?? 0}
                  className={`${INPUT} tabular`}
                />
              </Field>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-ink">Pipeline</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Set the date each step happened. Leave blank for steps not
                reached yet.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MILESTONES.map((milestone) => (
                  <Field key={milestone} label={MILESTONE_LABELS[milestone]}>
                    <input
                      type="date"
                      name={milestone}
                      defaultValue={lead?.[milestone] ?? ""}
                      className={INPUT}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={lead?.notes}
                  className={TEXTAREA}
                />
              </Field>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-4 text-sm"
                style={{ color: "var(--status-critical)" }}
              >
                {error}
              </p>
            ) : null}
          </fieldset>
        </div>

        <footer className="flex justify-end gap-2 border-t border-gridline px-5 py-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            {canEdit ? "Cancel" : "Close"}
          </button>
          {canEdit ? (
            <button type="submit" disabled={pending} className={BTN_PRIMARY}>
              {pending ? "Saving…" : lead ? "Save changes" : "Add lead"}
            </button>
          ) : null}
        </footer>
      </form>
    </dialog>
  );
}
