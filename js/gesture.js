// gesture.js — long press (touch/pen/mouse) + contextmenu on list rows (PRD FR-11).
// Never preventDefault on touchstart/pointerdown: that would kill native scrolling (Risk R1).
export const LONG_PRESS_MS = 500;
export const MOVE_TOLERANCE_PX = 10;

/**
 * @param container element holding the rows
 * @param rowSelector selector matching a row
 * @param {{onTap(row), onLongPress(row)}} handlers
 * @returns detach function
 */
export function attachRowGestures(container, rowSelector, { onTap, onLongPress }) {
  let timer = null;
  let start = null;       // {x, y, row, pointerId}
  let swallowNextClick = false;
  let firedAt = 0;

  // After a touch long press the finger is still down while the sheet opens under it; lifting it
  // dispatches a click to whatever is now under the finger (the sheet backdrop). Swallow exactly
  // that click, wherever it lands. Any fresh pointerdown means a new interaction: stop swallowing.
  const swallowClick = (e) => {
    if (!swallowNextClick) return;
    swallowNextClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const freshPress = () => { swallowNextClick = false; };

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (start?.row) start.row.classList.remove('pressing');
    start = null;
  };
  const fire = (row, fromPointer) => {
    firedAt = Date.now();
    swallowNextClick = fromPointer;
    try { navigator.vibrate?.(10); } catch { /* unsupported */ }
    onLongPress(row);
  };

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return; // right-click is handled by contextmenu
    const row = e.target.closest(rowSelector);
    if (!row || !container.contains(row)) return;
    cancel();
    start = { x: e.clientX, y: e.clientY, row, pointerId: e.pointerId };
    row.classList.add('pressing');
    timer = setTimeout(() => {
      const r = start?.row;
      cancel();
      if (r) fire(r, true);
    }, LONG_PRESS_MS);
  };
  const onMove = (e) => {
    if (!start || e.pointerId !== start.pointerId) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
  };
  const onClick = (e) => {
    const row = e.target.closest(rowSelector);
    if (!row) return;
    onTap(row);
  };
  const onContext = (e) => {
    const row = e.target.closest(rowSelector);
    if (!row) return;
    e.preventDefault();
    cancel();
    // Android synthesises contextmenu on long press, right after (or before) our timer fires.
    if (Date.now() - firedAt < 800 || document.getElementById('sheet')?.hidden === false) return;
    fire(row, false); // a right-click is not followed by a click
  };
  const onKey = (e) => {
    const row = e.target.closest(rowSelector);
    if (!row) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(row); }
  };

  document.addEventListener('pointerdown', freshPress, true);
  document.addEventListener('click', swallowClick, true);
  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', cancel);
  container.addEventListener('pointercancel', cancel);
  container.addEventListener('pointerleave', cancel);
  window.addEventListener('scroll', cancel, { passive: true });
  container.addEventListener('click', onClick);
  container.addEventListener('contextmenu', onContext);
  container.addEventListener('keydown', onKey);
  return () => {
    cancel();
    document.removeEventListener('pointerdown', freshPress, true);
    document.removeEventListener('click', swallowClick, true);
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', cancel);
    container.removeEventListener('pointercancel', cancel);
    container.removeEventListener('pointerleave', cancel);
    window.removeEventListener('scroll', cancel);
    container.removeEventListener('click', onClick);
    container.removeEventListener('contextmenu', onContext);
    container.removeEventListener('keydown', onKey);
  };
}
