export function sortComicEntriesNaturally(names = []) {
  return [...names].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
}

export function computeVisibleWebtoonWindow(currentIdx = 0, totalCount = 0, buffer = 5) {
  const safeTotal = Math.max(0, Number(totalCount) || 0);
  if (safeTotal === 0) return { start: 0, end: -1 };
  const clamped = Math.max(0, Math.min(safeTotal - 1, Number(currentIdx) || 0));
  return {
    start: Math.max(0, clamped - buffer),
    end: Math.min(safeTotal - 1, clamped + buffer),
  };
}

export function resolveComicVisualFilter(cbzFilter = 'none') {
  if (cbzFilter === 'sumi-eink') {
    return 'grayscale(100%) contrast(1.24) brightness(1.03)';
  }
  if (cbzFilter === 'night-inverted') {
    return 'invert(0.92) contrast(1.06)';
  }
  return 'none';
}

export function computeZoomOriginAtPoint({
  clientX = 0,
  clientY = 0,
  rect = { left: 0, top: 0, width: 100, height: 100 },
} = {}) {
  const width = Math.max(1, Number(rect?.width) || 1);
  const height = Math.max(1, Number(rect?.height) || 1);
  const pctX = ((clientX - (Number(rect?.left) || 0)) / width) * 100;
  const pctY = ((clientY - (Number(rect?.top) || 0)) / height) * 100;
  const clampedX = Math.max(8, Math.min(92, Math.round(pctX)));
  const clampedY = Math.max(8, Math.min(92, Math.round(pctY)));
  return {
    originX: `${clampedX}%`,
    originY: `${clampedY}%`,
    originCss: `${clampedX}% ${clampedY}%`,
  };
}
