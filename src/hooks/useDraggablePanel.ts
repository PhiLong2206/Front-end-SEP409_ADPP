import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MIN_PANEL_W = 260;
export const MIN_PANEL_H = 200;
/** Below this width the card is a bottom sheet: no dragging. */
export const NARROW_SCREEN_PX = 640;
/** The height that stays on screen when the card is collapsed to its title bar. */
export const TITLE_BAR_H = 40;

/** Keeps the card inside the viewport: its size at least the minimum (and at most the screen), its corner on screen. */
export function clampRect(
  rect: PanelRect,
  vw: number,
  vh: number,
  collapsed = false,
  minW = MIN_PANEL_W,
  minH = MIN_PANEL_H
): PanelRect {
  const w = Math.min(Math.max(rect.w, minW), Math.max(minW, vw));
  const h = Math.min(Math.max(rect.h, minH), Math.max(minH, vh));
  const shownH = collapsed ? TITLE_BAR_H : h;
  const x = Math.min(Math.max(rect.x, 0), Math.max(0, vw - w));
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, vh - shownH));
  return { x, y, w, h };
}

interface Options {
  rect: PanelRect;
  onRectChange: (rect: PanelRect) => void;
  collapsed: boolean;
  /** Bottom sheet on a narrow screen: nothing to drag or resize. */
  disabled?: boolean;
  /** A drag or resize is over: the moment to save the place (not on every move). */
  onGestureEnd?: () => void;
}

type Gesture = { kind: "drag" | "resize"; startX: number; startY: number; start: PanelRect; pointerId: number };

/**
 * Drag the card by its title bar and resize it from its bottom-right corner. Pointer events with pointer capture, so
 * a mouse and a finger both work; the card is clamped to the viewport also when the window changes size.
 */
export function useDraggablePanel({ rect, onRectChange, collapsed, disabled = false, onGestureEnd }: Options) {
  const gestureRef = useRef<Gesture | null>(null);
  const rectRef = useRef(rect);
  rectRef.current = rect;
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < NARROW_SCREEN_PX);
  const [isDragging, setIsDragging] = useState(false);

  // Window resized: stay inside the viewport
  useEffect(() => {
    const onResize = () => {
      setIsNarrow(window.innerWidth < NARROW_SCREEN_PX);
      const current = rectRef.current;
      const next = clampRect(current, window.innerWidth, window.innerHeight, collapsed);
      if (next.x !== current.x || next.y !== current.y || next.w !== current.w || next.h !== current.h) onRectChange(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [collapsed, onRectChange]);

  const begin = useCallback(
    (kind: Gesture["kind"]) => (event: ReactPointerEvent<HTMLElement>) => {
      // A narrow screen shows a bottom sheet: nothing to drag or resize there
      if (disabled || window.innerWidth < NARROW_SCREEN_PX || event.button > 0) return;
      // A click on a button of the title bar is not a drag
      if (kind === "drag" && (event.target as HTMLElement).closest("button, input, textarea")) return;
      gestureRef.current = {
        kind,
        startX: event.clientX,
        startY: event.clientY,
        start: rectRef.current,
        pointerId: event.pointerId,
      };
      setIsDragging(true);
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // no capture: the move events still arrive while the pointer is over the card
      }
      if (kind === "resize") event.stopPropagation();
    },
    [disabled]
  );

  const move = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== event.pointerId) return;
      const dx = event.clientX - g.startX;
      const dy = event.clientY - g.startY;
      const next: PanelRect =
        g.kind === "drag"
          ? { ...g.start, x: g.start.x + dx, y: g.start.y + dy }
          : { ...g.start, w: g.start.w + dx, h: g.start.h + dy };
      onRectChange(clampRect(next, window.innerWidth, window.innerHeight, collapsed));
    },
    [collapsed, onRectChange]
  );

  const end = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    setIsDragging(false);
    onGestureEnd?.();
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // already released
    }
  }, [onGestureEnd]);

  return {
    isNarrow,
    isDragging,
    dragHandlers: { onPointerDown: begin("drag"), onPointerMove: move, onPointerUp: end, onPointerCancel: end },
    resizeHandlers: { onPointerDown: begin("resize"), onPointerMove: move, onPointerUp: end, onPointerCancel: end },
  };
}
