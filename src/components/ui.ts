/**
 * Shared class strings. Geist proportions: 32px controls, 6px radii on
 * interactive elements, 12px on cards, hairline borders doing the work that
 * shadows would elsewhere.
 */

export const BTN_BASE =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm " +
  "font-medium whitespace-nowrap transition-colors disabled:pointer-events-none " +
  "disabled:opacity-50";

/** Inverts against the page, the way Vercel's primary action does. */
export const BTN_PRIMARY = `${BTN_BASE} bg-btn text-btn-fg hover:opacity-85`;

export const BTN_SECONDARY = `${BTN_BASE} border border-hairline bg-surface text-ink hover:bg-wash`;

export const BTN_GHOST = `${BTN_BASE} text-ink-secondary hover:bg-wash hover:text-ink`;

/** Square icon-only variant, same height as the text buttons. */
export const BTN_ICON =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md border " +
  "border-hairline bg-surface text-ink-secondary transition-colors hover:bg-wash hover:text-ink";

export const INPUT =
  "h-8 w-full rounded-md border border-hairline bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-ink-muted transition-colors focus:border-transparent";

export const TEXTAREA =
  "w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-sm text-ink " +
  "placeholder:text-ink-muted transition-colors focus:border-transparent";

export const SELECT = `${INPUT} pr-8`;

export const CARD = "rounded-xl border border-hairline bg-surface";

export const LABEL = "mb-1.5 block text-xs font-medium text-ink-secondary";

/** Full-bleed sheet on phones, centred card from `sm` up. */
export const DIALOG =
  "m-auto max-h-dvh w-full rounded-none border-hairline bg-surface p-0 text-ink " +
  "sm:max-h-[90dvh] sm:rounded-xl sm:border";
