import { useEffect } from 'react';

/**
 * Elements where a drag gesture should behave as a normal interaction
 * (click, select, type, resize) instead of starting a table drag-scroll.
 */
const INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'label',
  '[role="checkbox"]',
  '[role="button"]',
  '[contenteditable="true"]',
  '[class*="cursor-col-resize"]', // DataTable column-resize handle
  '[class*="resize-handle"]',
].join(', ');

const DRAG_THRESHOLD_PX = 5;

function isScrollableX(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  return /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
}

/** Walk up from a node to find the nearest ancestor that actually scrolls horizontally. */
function findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start;
  while (el && el !== document.body) {
    if (isScrollableX(el)) return el;
    el = el.parentElement;
  }
  return null;
}

/** Resolve the drag-scrollable container for a table under the given event target, if any. */
function getTableScrollContainer(target: EventTarget | null): HTMLElement | null {
  const el = target as HTMLElement | null;
  if (!el) return null;
  const tableEl = el.closest('table');
  if (!tableEl) return null;
  return findScrollableAncestor(tableEl.parentElement);
}

/**
 * Installs a single, app-wide click-and-drag horizontal scroll behavior for
 * every table on the page (both the shared DataTable components and plain
 * `overflow-x-auto` table wrappers used across feature pages).
 *
 * Behavior is auto-detected per pointer event: on mousedown, it looks for a
 * `<table>` under the cursor and, if that table's nearest ancestor actually
 * overflows horizontally, turns a subsequent mouse-drag into a scroll. No
 * per-table wiring is required, and nothing changes for touch devices, which
 * already get native swipe-scrolling from `overflow-x-auto`/`overflow-auto`.
 *
 * Mount this once near the app root (see App.tsx). Reused across the whole
 * ERP instead of duplicating drag logic in every table component.
 */
export function useGlobalTableDragScroll() {
  useEffect(() => {
    let container: HTMLElement | null = null;
    let hoverContainer: HTMLElement | null = null;
    let isDown = false;
    let hasDragged = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_SELECTOR)) return;

      const found = getTableScrollContainer(target);
      if (!found) return;

      container = found;
      isDown = true;
      hasDragged = false;
      startX = e.pageX;
      startScrollLeft = container.scrollLeft;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDown && container) {
        const walk = e.pageX - startX;
        if (Math.abs(walk) > DRAG_THRESHOLD_PX) {
          hasDragged = true;
          e.preventDefault();
        }
        container.scrollLeft = startScrollLeft - walk;
        return;
      }

      // Not dragging: show a "grab" cursor while hovering a scrollable table,
      // so the affordance is visible before the user starts dragging.
      const target = e.target as HTMLElement | null;
      const nextHover =
        target && !target.closest(INTERACTIVE_SELECTOR) ? getTableScrollContainer(target) : null;

      if (nextHover !== hoverContainer) {
        if (hoverContainer) hoverContainer.style.cursor = '';
        if (nextHover) nextHover.style.cursor = 'grab';
        hoverContainer = nextHover;
      }
    };

    const endDrag = () => {
      if (!isDown) return;
      isDown = false;
      if (container) {
        container.style.userSelect = '';
        container.style.cursor = container === hoverContainer ? 'grab' : '';
      }
      // Let the click event that follows mouseup run through onClickCapture
      // first (so a real drag can still suppress it), then reset.
      setTimeout(() => {
        hasDragged = false;
      }, 0);
    };

    // Swallow the click that follows a real drag so row-click / sort-toggle
    // handlers don't fire from what was actually a scroll gesture.
    const onClickCapture = (e: MouseEvent) => {
      if (hasDragged) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('click', onClickCapture, true);

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('click', onClickCapture, true);
      if (container) {
        container.style.cursor = '';
        container.style.userSelect = '';
      }
      if (hoverContainer) hoverContainer.style.cursor = '';
    };
  }, []);
}
