"use client";

import { useMemo, useState } from "react";
import { formatDate, formatPv, todayISO } from "@/lib/leads";
import { reachedCount, type Lead } from "@/lib/types";
import { MilestoneTrack } from "./MilestoneTrack";
import { BTN_GHOST, CARD } from "./ui";

type SortKey = "full_name" | "lead_date" | "follow_up" | "progress" | "pv_amount";

const HEADERS: Array<{ key: SortKey | null; label: string; align?: "right" }> = [
  { key: "full_name", label: "Lead" },
  { key: "lead_date", label: "Date" },
  { key: "follow_up", label: "Follow up" },
  { key: "progress", label: "Pipeline" },
  { key: "pv_amount", label: "PV", align: "right" },
  { key: null, label: "" },
];

function compare(a: Lead, b: Lead, key: SortKey): number {
  switch (key) {
    case "full_name":
      return a.full_name.localeCompare(b.full_name);
    case "progress":
      return reachedCount(a) - reachedCount(b);
    case "pv_amount":
      return Number(a.pv_amount) - Number(b.pv_amount);
    default:
      return (a[key] ?? "").localeCompare(b[key] ?? "");
  }
}

function DueFlag() {
  // Icon + label, so the state never rests on colour alone.
  return (
    <span
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: "var(--status-serious)" }}
    >
      <span aria-hidden>●</span> due
    </span>
  );
}

export function LeadTable({
  leads,
  canEdit,
  onEdit,
  onDelete,
  onError,
}: {
  leads: Lead[];
  canEdit: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onError: (message: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "progress",
    desc: true,
  });

  const today = todayISO();

  const sorted = useMemo(() => {
    const rows = [...leads];
    rows.sort((a, b) => {
      const result = compare(a, b, sort.key);
      return sort.desc ? -result : result;
    });
    return rows;
  }, [leads, sort]);

  function toggle(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, desc: !prev.desc } : { key, desc: true },
    );
  }

  function isDue(lead: Lead) {
    return Boolean(lead.follow_up) && lead.follow_up! <= today && !lead.starter_pack;
  }

  if (leads.length === 0) {
    return (
      <div className={`${CARD} p-10 text-center sm:p-12`}>
        <p className="font-medium text-ink">No leads here yet</p>
        <p className="mt-1 text-sm text-ink-muted">
          {canEdit
            ? "Add one, or import contacts from your calendar."
            : "This list is empty."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ------------- phones and tablets: stacked cards ------------------ */}
      {/* The table needs ~1024px before the Lead column stops wrapping
          names and phone numbers onto three lines. */}
      <ul className="space-y-3 lg:hidden">
        {sorted.map((lead) => (
          <li key={lead.id} className={`${CARD} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{lead.full_name}</p>
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="tabular text-sm text-ink-secondary underline-offset-2 hover:underline"
                  >
                    {lead.phone}
                  </a>
                ) : (
                  <span className="text-sm text-ink-muted">No phone</span>
                )}
              </div>
              <span className="tabular shrink-0 text-right">
                <span className="block text-sm font-medium text-ink">
                  {formatPv(Number(lead.pv_amount))}
                </span>
                <span className="block text-xs text-ink-muted">PV</span>
              </span>
            </div>

            <div className="mt-3">
              <MilestoneTrack lead={lead} canEdit={canEdit} onError={onError} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div>
                <dt className="text-ink-muted">Date</dt>
                <dd className="text-ink-secondary">{formatDate(lead.lead_date)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Follow up</dt>
                <dd className="text-ink-secondary">
                  {formatDate(lead.follow_up)} {isDue(lead) ? <DueFlag /> : null}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex justify-end gap-1 border-t border-gridline pt-3">
              <button type="button" onClick={() => onEdit(lead)} className={BTN_GHOST}>
                {canEdit ? "Edit" : "View"}
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => onDelete(lead)}
                  className={BTN_GHOST}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* -------------------- desktop and up: table ----------------------- */}
      <div className={`${CARD} hidden overflow-x-auto lg:block`}>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gridline">
              {HEADERS.map(({ key, label, align }) => (
                <th
                  key={label || "actions"}
                  scope="col"
                  aria-sort={
                    key && sort.key === key
                      ? sort.desc
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                  className={`px-4 py-2.5 text-xs font-medium text-ink-secondary ${
                    align === "right" ? "text-right" : ""
                  }`}
                >
                  {key ? (
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {label}
                      <span aria-hidden className="text-[10px] text-ink-muted">
                        {sort.key === key ? (sort.desc ? "↓" : "↑") : "↕"}
                      </span>
                    </button>
                  ) : (
                    <span className="sr-only">Actions</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-gridline last:border-0 hover:bg-wash"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium text-ink">{lead.full_name}</div>
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="tabular text-xs text-ink-muted underline-offset-2 hover:underline"
                    >
                      {lead.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">
                  {formatDate(lead.lead_date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-ink-secondary">{formatDate(lead.follow_up)}</span>
                  {isDue(lead) ? (
                    <span className="ml-1.5">
                      <DueFlag />
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <MilestoneTrack lead={lead} canEdit={canEdit} onError={onError} />
                </td>
                <td className="tabular px-4 py-3 text-right font-medium text-ink">
                  {formatPv(Number(lead.pv_amount))}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(lead)}
                      className={BTN_GHOST}
                    >
                      {canEdit ? "Edit" : "View"}
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => onDelete(lead)}
                        className={BTN_GHOST}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
