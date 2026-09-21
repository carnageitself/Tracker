"use client";

import { useTransition } from "react";
import { setMilestone } from "@/app/actions";
import { formatDate, todayISO } from "@/lib/leads";
import {
  currentStage,
  hasStarterPack,
  MILESTONES,
  MILESTONE_LABELS,
  reachedCount,
  type Lead,
} from "@/lib/types";

/**
 * An ordinal meter, not a set of categories: one hue, reached segments in the
 * accent step and the rest in a lighter step of the same ramp. Position and
 * the stage label carry the meaning, so the six steps never need six hues.
 */
export function MilestoneTrack({
  lead,
  canEdit,
  onError,
}: {
  lead: Lead;
  canEdit: boolean;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const reached = reachedCount(lead);
  const done = hasStarterPack(lead);

  function toggle(milestone: (typeof MILESTONES)[number]) {
    const next = lead[milestone] ? null : todayISO();
    startTransition(async () => {
      const result = await setMilestone(lead.id, milestone, next);
      if (result.error) onError(result.error);
    });
  }

  return (
    <div className={pending ? "opacity-60" : undefined}>
      <div className="flex gap-0.5">
        {MILESTONES.map((milestone, index) => {
          const filled = index < reached;
          const isSet = Boolean(lead[milestone]);
          const label = `${MILESTONE_LABELS[milestone]}: ${
            isSet ? formatDate(lead[milestone]) : "not reached"
          }`;

          return (
            <button
              key={milestone}
              type="button"
              title={canEdit ? `${label} — click to toggle` : label}
              aria-label={label}
              aria-pressed={isSet}
              disabled={!canEdit || pending}
              onClick={() => toggle(milestone)}
              className="h-1.5 w-5 rounded-xs transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100 sm:w-7"
              style={{ background: filled ? "var(--accent)" : "var(--meter-track)" }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-xs text-ink-secondary">
        {done ? (
          <span aria-hidden style={{ color: "var(--status-good)" }}>
            ✓
          </span>
        ) : null}
        {currentStage(lead)}
        <span className="text-ink-muted">· {reached}/6</span>
      </div>
    </div>
  );
}
