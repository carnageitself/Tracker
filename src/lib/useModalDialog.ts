"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Drives a native <dialog> from React state and adds backdrop dismissal,
 * which the element does not provide on its own.
 *
 * `open` stays the single source of truth. Escape is the one path that closes
 * the element without going through React, so the close event is mirrored
 * back into state -- otherwise `open` would stay `true` after dismissal and
 * the next `setOpen(true)` would be a no-op against an unchanged value.
 */
export function useModalDialog(
  ref: RefObject<HTMLDialogElement | null>,
  open: boolean,
  onClose: () => void,
) {
  // Callers pass an inline arrow; hold it in a ref so the listener below
  // subscribes once instead of on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [ref, open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const sync = () => onCloseRef.current();
    dialog.addEventListener("close", sync);
    return () => dialog.removeEventListener("close", sync);
  }, [ref]);

  // Backdrop click. Clicks on the backdrop target the dialog element itself,
  // because its single child fills it -- anything inside the panel targets a
  // descendant. That beats comparing pointer coordinates to the dialog's
  // rect, which would treat the date picker as "outside" whenever its popover
  // is placed beyond the dialog's bounds.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // Captured on press, not on click: dragging a text selection out of the
    // panel and releasing over the backdrop must not count as an outside
    // click, and a popover open at press time should absorb the dismiss.
    let startedOnBackdrop = false;
    let popoverWasOpen = false;

    const onPointerDown = (event: PointerEvent) => {
      startedOnBackdrop = event.target === dialog;
      popoverWasOpen = Boolean(dialog.querySelector(":popover-open"));
    };

    const onClick = (event: MouseEvent) => {
      // detail === 0 means a keyboard-synthesised click (Enter on a button).
      if (event.detail === 0) return;
      if (event.target !== dialog || !startedOnBackdrop) return;
      if (popoverWasOpen) return;
      // Ask React to close, exactly as the Cancel button does, rather than
      // calling close() here: state stays the source of truth and the sync
      // effect below does the DOM work.
      onCloseRef.current();
    };

    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("click", onClick);
    return () => {
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("click", onClick);
    };
  }, [ref]);
}
