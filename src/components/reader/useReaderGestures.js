import { useCallback, useEffect, useRef } from 'react';

export const LEFT_TAP_ZONE_MAX = 0.28;
export const RIGHT_TAP_ZONE_MIN = 0.72;
export const TAP_MAX_MOVE_PX = 10;
export const TAP_MAX_DURATION_MS = 250;
export const DOUBLE_TAP_WINDOW_MS = 260;
export const LONG_PRESS_SETTINGS_MS = 900;

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="dialog"]',
  '[role="slider"]',
  '[role="switch"]',
  '[contenteditable="true"]',
  'mark[data-codice-hl-id]',
  'header',
  'footer',
  'nav',
  '.codice-no-gesture',
].join(',');

export function classifyTapZone(xRatio) {
  const safe = Number(xRatio);
  if (!Number.isFinite(safe)) return 'center';
  if (safe < LEFT_TAP_ZONE_MAX) return 'left';
  if (safe > RIGHT_TAP_ZONE_MIN) return 'right';
  return 'center';
}

export function isSelectionActive(doc) {
  try {
    const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
    const selText = win?.getSelection?.()?.toString?.()?.trim();
    if (selText) return true;
  } catch {
    // Ignora falha cross-origin improvável
  }
  return false;
}

export function shouldIgnoreGestureTarget(target, clientX = null, containerEl = null) {
  if (target && typeof target.closest === 'function') {
    if (target.closest(INTERACTIVE_SELECTOR)) {
      return true;
    }
  }
  if (
    containerEl &&
    typeof clientX === 'number' &&
    typeof containerEl.getBoundingClientRect === 'function'
  ) {
    const rect = containerEl.getBoundingClientRect();
    const scrollbarWidth = (containerEl.offsetWidth || 0) - (containerEl.clientWidth || 0);
    if (scrollbarWidth > 4 && clientX >= rect.left + containerEl.clientWidth - 2) {
      return true;
    }
  }
  return false;
}

export function scrollContainerByViewportFraction(
  scrollEl,
  direction = 1,
  fraction = 0.9
) {
  if (!scrollEl || typeof scrollEl.scrollBy !== 'function') return false;
  const visibleHeight =
    scrollEl.clientHeight ||
    (typeof window !== 'undefined' ? window.innerHeight : 640);
  const delta = Math.round(visibleHeight * fraction) * (direction >= 0 ? 1 : -1);
  const prefersReduced =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

  scrollEl.scrollBy({
    top: delta,
    behavior: prefersReduced ? 'auto' : 'smooth',
  });
  return true;
}

export function createTapGestureEngine(handlers = {}) {
  let enabled = handlers.enabled !== false;
  let allowCenterDoubleTap = handlers.allowCenterDoubleTap !== false;
  const activePointers = new Map();
  let multiTouch = false;
  let activeSession = null;
  let longPressTimer = null;
  let centerTapTimer = null;

  const clearLongPressTimer = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const clearCenterTapTimer = () => {
    if (centerTapTimer !== null) {
      clearTimeout(centerTapTimer);
      centerTapTimer = null;
    }
  };

  const resetPointerState = () => {
    clearLongPressTimer();
    activeSession = null;
  };

  const updateConfig = (nextHandlers = {}) => {
    Object.assign(handlers, nextHandlers);
    enabled = handlers.enabled !== false;
    allowCenterDoubleTap = handlers.allowCenterDoubleTap !== false;
    if (!enabled) {
      clearLongPressTimer();
      clearCenterTapTimer();
      activeSession = null;
    }
  };

  const destroy = () => {
    clearLongPressTimer();
    clearCenterTapTimer();
    activePointers.clear();
    activeSession = null;
    multiTouch = false;
  };

  const onPointerDown = ({
    pointerId = 1,
    button = 0,
    clientX = 0,
    clientY = 0,
    target = null,
    doc = null,
    containerEl = null,
    timestamp = Date.now(),
  }) => {
    if (!enabled) return;
    if (typeof button === 'number' && button !== 0) return;

    const isBlockedStart =
      shouldIgnoreGestureTarget(target, clientX, containerEl) ||
      isSelectionActive(doc) ||
      isSelectionActive(typeof document !== 'undefined' ? document : null);

    if (activePointers.size === 0 && isBlockedStart) {
      activeSession = null;
      return;
    }

    activePointers.set(pointerId, { clientX, clientY });
    if (activePointers.size > 1) {
      multiTouch = true;
      resetPointerState();
      clearCenterTapTimer();
      return;
    }

    if (isBlockedStart) {
      activeSession = null;
      return;
    }

    multiTouch = false;
    activeSession = {
      pointerId,
      startX: clientX,
      startY: clientY,
      startTime: timestamp,
      moved: false,
      longPressTriggered: false,
      doc,
      containerEl,
    };

    clearLongPressTimer();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (!activeSession || activeSession.pointerId !== pointerId) return;
      if (activeSession.moved || multiTouch) return;
      if (
        isSelectionActive(activeSession.doc) ||
        isSelectionActive(typeof document !== 'undefined' ? document : null)
      ) {
        return;
      }
      activeSession.longPressTriggered = true;
      clearCenterTapTimer();
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(10);
        } catch {
          // Vibração opcional silenciosa
        }
      }
      handlers.onLongPressSettings?.();
    }, LONG_PRESS_SETTINGS_MS);
  };

  const onPointerMove = ({ pointerId = 1, clientX = 0, clientY = 0 }) => {
    if (!activeSession || activeSession.pointerId !== pointerId) return;
    const dist = Math.hypot(
      clientX - activeSession.startX,
      clientY - activeSession.startY
    );
    if (dist >= TAP_MAX_MOVE_PX) {
      activeSession.moved = true;
      clearLongPressTimer();
    }
  };

  const onPointerCancel = ({ pointerId = 1 }) => {
    activePointers.delete(pointerId);
    if (activePointers.size === 0) {
      multiTouch = false;
    }
    if (activeSession?.pointerId === pointerId) {
      resetPointerState();
    }
  };

  const onPointerUp = ({
    pointerId = 1,
    clientX = 0,
    clientY = 0,
    viewportLeft = 0,
    viewportTop = 0,
    viewportWidth = 1,
    viewportHeight = 1,
    doc = null,
    target = null,
    timestamp = Date.now(),
  }) => {
    activePointers.delete(pointerId);
    const wasMulti = multiTouch;
    if (activePointers.size === 0) {
      multiTouch = false;
    }

    const session = activeSession;
    clearLongPressTimer();
    if (!session || session.pointerId !== pointerId) return;
    activeSession = null;

    if (!enabled || wasMulti || session.moved || session.longPressTriggered) {
      return;
    }

    if (
      shouldIgnoreGestureTarget(target, clientX, session.containerEl) ||
      isSelectionActive(doc || session.doc) ||
      isSelectionActive(typeof document !== 'undefined' ? document : null)
    ) {
      return;
    }

    const totalDist = Math.hypot(
      clientX - session.startX,
      clientY - session.startY
    );
    const duration = timestamp - session.startTime;
    if (totalDist >= TAP_MAX_MOVE_PX || duration >= TAP_MAX_DURATION_MS) {
      return;
    }

    const width = Math.max(1, Number(viewportWidth) || 1);
    const xRatio = (clientX - viewportLeft) / width;
    const zone = classifyTapZone(xRatio);

    if (zone === 'left') {
      clearCenterTapTimer();
      handlers.onLeftTap?.({ xRatio });
      return;
    }
    if (zone === 'right') {
      clearCenterTapTimer();
      handlers.onRightTap?.({ xRatio });
      return;
    }

    // Zona central: aguarda janela de 260ms para diferenciar toque simples vs duplo
    if (centerTapTimer !== null) {
      clearCenterTapTimer();
      if (allowCenterDoubleTap) {
        handlers.onCenterDoubleTap?.({
          xRatio,
          clientX,
          clientY,
          viewportLeft,
          viewportTop,
          viewportWidth,
          viewportHeight,
        });
      }
      return;
    }

    centerTapTimer = setTimeout(() => {
      centerTapTimer = null;
      handlers.onCenterTap?.({ xRatio });
    }, DOUBLE_TAP_WINDOW_MS);
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    updateConfig,
    destroy,
  };
}

export function useReaderGestures({
  enabled = true,
  allowCenterDoubleTap = true,
  viewportRef,
  onLeftTap,
  onRightTap,
  onCenterTap,
  onCenterDoubleTap,
  onLongPressSettings,
} = {}) {
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = createTapGestureEngine({
      enabled,
      allowCenterDoubleTap,
      onLeftTap,
      onRightTap,
      onCenterTap,
      onCenterDoubleTap,
      onLongPressSettings,
    });
  }

  useEffect(() => {
    engineRef.current.updateConfig({
      enabled,
      allowCenterDoubleTap,
      onLeftTap,
      onRightTap,
      onCenterTap,
      onCenterDoubleTap,
      onLongPressSettings,
    });
  }, [
    enabled,
    allowCenterDoubleTap,
    onLeftTap,
    onRightTap,
    onCenterTap,
    onCenterDoubleTap,
    onLongPressSettings,
  ]);

  useEffect(() => () => engineRef.current?.destroy(), []);

  const bindElementEvents = useCallback(
    (doc = null, frameEl = null) => {
      const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
      const viewportEl = viewportRef?.current || frameEl;
      if (!targetDoc) return () => {};

      const resolveViewportCoordinates = (e) => {
        const vRect = viewportEl?.getBoundingClientRect?.() || {
          left: 0,
          width: typeof window !== 'undefined' ? window.innerWidth : 360,
        };
        if (frameEl && targetDoc !== document) {
          const fRect = frameEl.getBoundingClientRect();
          return {
            clientX: fRect.left + e.clientX,
            clientY: fRect.top + e.clientY,
            viewportLeft: vRect.left,
            viewportWidth: vRect.width,
          };
        }
        return {
          clientX: e.clientX,
          clientY: e.clientY,
          viewportLeft: vRect.left,
          viewportWidth: vRect.width,
        };
      };

      const handleDown = (e) => {
        const coords = resolveViewportCoordinates(e);
        engineRef.current.onPointerDown({
          pointerId: e.pointerId ?? 1,
          button: e.button ?? 0,
          clientX: coords.clientX,
          clientY: coords.clientY,
          target: e.target,
          doc: targetDoc,
          containerEl: viewportEl,
        });
      };

      const handleMove = (e) => {
        const coords = resolveViewportCoordinates(e);
        engineRef.current.onPointerMove({
          pointerId: e.pointerId ?? 1,
          clientX: coords.clientX,
          clientY: coords.clientY,
        });
      };

      const handleUp = (e) => {
        const coords = resolveViewportCoordinates(e);
        engineRef.current.onPointerUp({
          pointerId: e.pointerId ?? 1,
          clientX: coords.clientX,
          clientY: coords.clientY,
          viewportLeft: coords.viewportLeft,
          viewportWidth: coords.viewportWidth,
          doc: targetDoc,
          target: e.target,
        });
      };

      const handleCancel = (e) => {
        engineRef.current.onPointerCancel({
          pointerId: e.pointerId ?? 1,
        });
      };

      targetDoc.addEventListener('pointerdown', handleDown, { passive: true });
      targetDoc.addEventListener('pointermove', handleMove, { passive: true });
      targetDoc.addEventListener('pointerup', handleUp, { passive: true });
      targetDoc.addEventListener('pointercancel', handleCancel, { passive: true });

      return () => {
        targetDoc.removeEventListener('pointerdown', handleDown);
        targetDoc.removeEventListener('pointermove', handleMove);
        targetDoc.removeEventListener('pointerup', handleUp);
        targetDoc.removeEventListener('pointercancel', handleCancel);
      };
    },
    [viewportRef]
  );

  const getContainerPointerProps = useCallback(
    () => ({
      onPointerDown: (e) => {
        const vRect = (viewportRef?.current || e.currentTarget).getBoundingClientRect();
        engineRef.current.onPointerDown({
          pointerId: e.pointerId ?? 1,
          button: e.button ?? 0,
          clientX: e.clientX,
          clientY: e.clientY,
          target: e.target,
          doc: typeof document !== 'undefined' ? document : null,
          containerEl: viewportRef?.current || e.currentTarget,
          rect: vRect,
        });
      },
      onPointerMove: (e) => {
        engineRef.current.onPointerMove({
          pointerId: e.pointerId ?? 1,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      },
      onPointerUp: (e) => {
        const vRect = (viewportRef?.current || e.currentTarget).getBoundingClientRect();
        engineRef.current.onPointerUp({
          pointerId: e.pointerId ?? 1,
          clientX: e.clientX,
          clientY: e.clientY,
          viewportLeft: vRect.left,
          viewportTop: vRect.top,
          viewportWidth: vRect.width,
          viewportHeight: vRect.height,
          doc: typeof document !== 'undefined' ? document : null,
          target: e.target,
        });
      },
      onPointerCancel: (e) => {
        engineRef.current.onPointerCancel({
          pointerId: e.pointerId ?? 1,
        });
      },
    }),
    [viewportRef]
  );

  return {
    bindElementEvents,
    getContainerPointerProps,
  };
}
