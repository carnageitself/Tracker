"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createLead, deleteLead, signOut, updateLead } from "@/app/actions";
import { computeStats, formatPv } from "@/lib/leads";
import type { ListRef, Workspace } from "@/lib/data";
import type { Lead, LeadDraft } from "@/lib/types";
import { LeadDialog } from "./LeadDialog";
import { LeadTable } from "./LeadTable";
import { ShareDialog } from "./ShareDialog";
import { StatTile } from "./StatTile";
import { ThemeToggle } from "./ThemeToggle";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, SELECT } from "./ui";

export function Dashboard({
  workspace,
  activeList,
  leads,
}: {
  workspace: Workspace;
  activeList: ListRef;
  leads: Lead[];
}) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(leads), [leads]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) =>
      [lead.full_name, lead.phone, lead.email, lead.notes].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [leads, query]);

  const sharedWithMe = workspace.lists.filter((list) => !list.isOwn);

  function openAdd() {
    setEditing(null);
    setError(null);
    setLeadDialogOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setError(null);
    setLeadDialogOpen(true);
  }

  /** Returns an error message for the dialog to show, or null on success. */
  async function handleSubmit(draft: LeadDraft): Promise<string | null> {
    const result = editing
      ? await updateLead(editing.id, draft)
      : await createLead(activeList.ownerId, draft);

    if (result.error) return result.error;

    setLeadDialogOpen(false);
    setEditing(null);
    router.refresh();
    return null;
  }

  async function handleDelete(lead: Lead) {
    if (!window.confirm(`Delete ${lead.full_name}? This can't be undone.`)) return;
    const result = await deleteLead(lead.id);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  function switchList(ownerId: string) {
    router.push(ownerId === workspace.userId ? "/" : `/?list=${ownerId}`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-hairline bg-plane/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <div className="mr-auto min-w-0">
            <h1 className="text-base font-semibold tracking-tight text-ink">
              Lead Tracker
            </h1>
            <p className="truncate text-xs text-ink-secondary">
              {activeList.isOwn
                ? workspace.userEmail
                : `${activeList.ownerEmail} · ${
                    activeList.canEdit ? "can edit" : "view only"
                  }`}
            </p>
          </div>

          {workspace.lists.length > 1 ? (
            <label className="min-w-0">
              <span className="sr-only">Which list to view</span>
              <select
                value={activeList.ownerId}
                onChange={(event) => switchList(event.target.value)}
                className={`${SELECT} max-w-40`}
              >
                {workspace.lists.map((list) => (
                  <option key={list.ownerId} value={list.ownerId}>
                    {list.isOwn ? "My list" : list.ownerEmail}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <ThemeToggle />

          <Link href="/integrations" className={BTN_SECONDARY}>
            Import
          </Link>

          <button
            type="button"
            onClick={() => setShareDialogOpen(true)}
            className={BTN_SECONDARY}
          >
            Share
          </button>

          <form action={signOut}>
            <button type="submit" className={BTN_SECONDARY}>
              Sign out
            </button>
          </form>

          {activeList.canEdit ? (
            <button type="button" onClick={openAdd} className={BTN_PRIMARY}>
              Add lead
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <section
          aria-label="Pipeline summary"
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          <StatTile
            hero
            label="Total PV"
            value={formatPv(stats.totalPv, true)}
            detail={`across ${stats.total} ${stats.total === 1 ? "lead" : "leads"}`}
          />
          <StatTile
            label="Total leads"
            value={String(stats.total)}
            detail={`${stats.active} still in progress`}
          />
          <StatTile
            label="Starter packs"
            value={String(stats.starterPacks)}
            detail={
              stats.conversion === null
                ? "No leads yet"
                : `${Math.round(stats.conversion * 100)}% conversion`
            }
          />
          <StatTile
            label="Follow-ups due"
            value={String(stats.followUpsDue)}
            detail="Dated today or earlier"
          />
        </section>

        {error ? (
          <p
            role="alert"
            className="mt-5 text-sm"
            style={{ color: "var(--status-critical)" }}
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone, email, notes…"
            aria-label="Search leads"
            className={`${INPUT} sm:max-w-sm`}
          />
        </div>

        <section aria-label="Leads" className="mt-4">
          <LeadTable
            leads={visible}
            canEdit={activeList.canEdit}
            onEdit={openEdit}
            onDelete={handleDelete}
            onError={setError}
          />
        </section>
      </main>

      <LeadDialog
        open={leadDialogOpen}
        lead={editing}
        canEdit={activeList.canEdit}
        onSubmit={handleSubmit}
        onClose={() => {
          setLeadDialogOpen(false);
          setEditing(null);
        }}
      />

      <ShareDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        userId={workspace.userId}
        sharedByMe={workspace.sharedByMe}
        sharedWithMe={sharedWithMe}
      />
    </div>
  );
}
