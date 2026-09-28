"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { INPUT } from "./ui";

/** Plain YYYY-MM-DD <-> Date, always local. Never round-trip through UTC. */
function parseISO(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toISO(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function label(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PANEL_W = 300;
const PANEL_H = 350;

export function DatePicker({
  name,
  defaultValue,
  required = false,
  placeholder = "Pick a date",
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  const [selected, setSelected] = useState<Date | undefined>(() =>
    parseISO(defaultValue),
  );
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  /** Anchor below the trigger, flipping up or centring when space is tight. */
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    // Phones get a centred sheet instead of a tethered popover.
    if (window.innerWidth < 640) {
      setPos({
        top: Math.max(8, (window.innerHeight - PANEL_H) / 2),
        left: Math.max(8, (window.innerWidth - PANEL_W) / 2),
      });
      return;
    }

    const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8);
    const below = window.innerHeight - r.bottom;
    const flipUp = below < PANEL_H + 8 && r.top > PANEL_H + 8;

    // Flipping pins the panel's bottom edge rather than computing a top from
    // an assumed height -- the calendar is a row taller in 6-week months, and
    // a guessed height would leave a visible gap above the trigger.
    setPos(
      flipUp
        ? { bottom: window.innerHeight - r.top + 8, left }
        : { top: r.bottom + 8, left },
    );
  }, []);

  // The popover lives in the top layer, so the dialog's overflow can't clip it.
  // Placement happens in the click handler, keeping this effect free of state.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof panel.showPopover !== "function") return;
    if (open) panel.showPopover();
    else if (panel.matches(":popover-open")) panel.hidePopover();
  }, [open]);

  // Light dismiss (Esc, click outside) closes the popover itself; mirror it.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const sync = (event: Event) => {
      const e = event as ToggleEvent;
      if (e.newState === "closed") setOpen(false);
    };
    panel.addEventListener("toggle", sync);
    return () => panel.removeEventListener("toggle", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
  }

  function choose(date: Date | undefined) {
    setSelected(date);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const day =
    "size-9 rounded-md text-sm text-ink hover:bg-wash aria-selected:bg-btn " +
    "aria-selected:text-btn-fg aria-selected:hover:bg-btn";

  return (
    <>
      {/* Carries the value into FormData, so the form stays uncontrolled. */}
      <input
        type="hidden"
        name={name}
        value={selected ? toISO(selected) : ""}
        required={required}
      />

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={`${INPUT} flex items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        <span className={selected ? "text-ink" : "text-ink-muted"}>
          {selected ? label(selected) : placeholder}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-4 shrink-0 text-ink-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        >
          <rect x="2" y="3.5" width="12" height="11" rx="2" />
          <path d="M2 6.5h12M5.5 2v3M10.5 2v3" />
        </svg>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-label="Choose a date"
        style={pos ?? undefined}
        className="date-popover fixed m-0 w-[300px] rounded-xl border border-hairline bg-surface p-3 shadow-[var(--shadow-overlay)]"
      >
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={choose}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(new Date().getFullYear() - 5, 0)}
          endMonth={new Date(new Date().getFullYear() + 5, 11)}
          showOutsideDays
          classNames={{
            root: "w-full",
            months: "relative",
            month_caption: "flex items-center justify-center h-8 mb-1",
            dropdowns: "flex items-center gap-1.5",
            dropdown_root: "relative",
            dropdown:
              "h-7 rounded-md border border-hairline bg-surface px-1.5 text-sm text-ink",
            caption_label: "hidden",
            nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
            button_previous:
              "size-7 rounded-md text-ink-secondary hover:bg-wash hover:text-ink inline-flex items-center justify-center",
            button_next:
              "size-7 rounded-md text-ink-secondary hover:bg-wash hover:text-ink inline-flex items-center justify-center",
            chevron: "size-4 fill-current",
            month_grid: "w-full border-collapse",
            weekdays: "flex",
            weekday: "size-9 text-xs font-normal text-ink-muted flex items-center justify-center",
            week: "flex w-full",
            day: "p-0",
            day_button: day,
            today: "font-semibold text-accent aria-selected:text-btn-fg",
            outside: "text-ink-muted opacity-50",
            disabled: "opacity-30",
          }}
        />

        <div className="mt-2 flex justify-between border-t border-gridline pt-2">
          <button
            type="button"
            onClick={() => choose(new Date())}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-wash hover:text-ink"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => choose(undefined)}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-wash hover:text-ink"
          >
            Clear
          </button>
        </div>
      </div>
    </>
  );
}
