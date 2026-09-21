"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { removeShare, shareList } from "@/app/actions";
import type { ListRef, ShareGrant } from "@/lib/data";
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, DIALOG, INPUT, LABEL } from "./ui";

function GrantRow({
  email,
  canEdit,
  actionLabel,
  onAction,
  pending,
}: {
  email: string;
  canEdit: boolean;
  actionLabel: string;
  onAction: () => void;
  pending: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0 truncate text-sm text-ink">{email}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs text-ink-muted sm:inline">
          {canEdit ? "Can edit" : "View only"}
        </span>
        <button type="button" disabled={pending} onClick={onAction} className={BTN_GHOST}>
          {actionLabel}
        </button>
      </span>
    </li>
  );
}

export function ShareDialog({
  open,
  onClose,
  userId,
  sharedByMe,
  sharedWithMe,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  sharedByMe: ShareGrant[];
  /** Lists other people have given you — you can leave these. */
  sharedWithMe: ListRef[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const canEdit = data.get("can_edit") === "on";

    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await shareList(email, canEdit);
      if (result.error) setError(result.error);
      else {
        setNotice(`Shared with ${email}.`);
        form.reset();
      }
    });
  }

  function revoke(ownerIdValue: string, sharedWithId: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await removeShare(ownerIdValue, sharedWithId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="share-dialog-title"
      className={`${DIALOG} sm:w-[min(34rem,calc(100vw-2rem))]`}
    >
      <div className="flex max-h-dvh flex-col sm:max-h-[90dvh]">
        <header className="border-b border-gridline px-5 py-4">
          <h2 id="share-dialog-title" className="font-semibold tracking-tight text-ink">
            Sharing
          </h2>
          <p className="mt-0.5 text-sm text-ink-secondary">
            Give another user access to your list. They need an account here first.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <form onSubmit={handleSubmit}>
            <label htmlFor="share-email" className={LABEL}>
              Email
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="share-email"
                type="email"
                name="email"
                required
                placeholder="teammate@example.com"
                className={INPUT}
              />
              <button type="submit" disabled={pending} className={BTN_PRIMARY}>
                {pending ? "Working…" : "Share"}
              </button>
            </div>
            <label className="mt-2.5 flex items-center gap-2 text-sm text-ink-secondary">
              <input type="checkbox" name="can_edit" defaultChecked className="size-4" />
              Allow them to add and edit leads
            </label>
          </form>

          {error ? (
            <p
              role="alert"
              className="mt-4 text-sm"
              style={{ color: "var(--status-critical)" }}
            >
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="mt-4 text-sm" style={{ color: "var(--status-good)" }}>
              {notice}
            </p>
          ) : null}

          <section className="mt-6">
            <h3 className="text-sm font-medium text-ink">
              People with access to your list
            </h3>
            {sharedByMe.length === 0 ? (
              <p className="mt-1.5 text-sm text-ink-muted">Nobody yet.</p>
            ) : (
              <ul className="mt-1.5 divide-y divide-gridline border-t border-gridline">
                {sharedByMe.map((grant) => (
                  <GrantRow
                    key={grant.userId}
                    email={grant.email}
                    canEdit={grant.canEdit}
                    actionLabel="Revoke"
                    pending={pending}
                    onAction={() => revoke(userId, grant.userId)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-medium text-ink">Lists shared with you</h3>
            {sharedWithMe.length === 0 ? (
              <p className="mt-1.5 text-sm text-ink-muted">None.</p>
            ) : (
              <ul className="mt-1.5 divide-y divide-gridline border-t border-gridline">
                {sharedWithMe.map((list) => (
                  <GrantRow
                    key={list.ownerId}
                    email={list.ownerEmail}
                    canEdit={list.canEdit}
                    actionLabel="Leave"
                    pending={pending}
                    onAction={() => revoke(list.ownerId, userId)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="flex justify-end border-t border-gridline px-5 py-4">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Done
          </button>
        </footer>
      </div>
    </dialog>
  );
}
