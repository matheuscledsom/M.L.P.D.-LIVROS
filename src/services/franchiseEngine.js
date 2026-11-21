import { normalizeOwnedVolumes } from '../utils/backlogHelpers.js';
import { createUuid } from './codiceDatabase.js';

function normalizeSeriesKey(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSeriesBaseInfo(item = {}) {
  const explicitSeries = String(item.seriesName || '').trim();
  const explicitIndexNum = Number.parseInt(String(item.seriesIndex || '').trim(), 10);

  if (explicitSeries) {
    return {
      seriesName: explicitSeries,
      seriesKey: normalizeSeriesKey(explicitSeries),
      indexNumber:
        Number.isFinite(explicitIndexNum) && explicitIndexNum > 0 ? explicitIndexNum : null,
    };
  }

  const rawTitle = String(item.title || '').trim();
  const volMatch = rawTitle.match(
    /^(.+?)\s*(?:[-:—]\s*|\s+)(?:vol(?:ume)?\.?|v\.?|#|tomo|livro|part(?:e)?)\s*0*(\d{1,3})\b/i
  );

  if (volMatch) {
    const baseName = volMatch[1].trim();
    const num = Number.parseInt(volMatch[2], 10);
    if (baseName.length >= 2 && Number.isFinite(num) && num > 0) {
      return {
        seriesName: baseName,
        seriesKey: normalizeSeriesKey(baseName),
        indexNumber: num,
      };
    }
  }

  const hasMultiVolMeta =
    (Number(item.volumeTotal ?? item.totalVolumes) || 0) > 1 ||
    (Array.isArray(item.ownedVolumes) && item.ownedVolumes.length > 0);

  if (hasMultiVolMeta && rawTitle) {
    return {
      seriesName: rawTitle,
      seriesKey: normalizeSeriesKey(rawTitle),
      indexNumber: null,
    };
  }

  return null;
}

export function analyzeFranchises(items = [], { externalHints = {} } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.inBacklog !== false
  );

  const groups = new Map();

  for (const item of safeItems) {
    const info = extractSeriesBaseInfo(item);
    if (!info || !info.seriesKey) continue;

    if (!groups.has(info.seriesKey)) {
      groups.set(info.seriesKey, {
        seriesKey: info.seriesKey,
        name: info.seriesName,
        entries: [],
      });
    }
    groups.get(info.seriesKey).entries.push({ item, indexNumber: info.indexNumber });
  }

  const franchises = [];

  for (const group of groups.values()) {
    const isSingleSerializedTracker =
      group.entries.length === 1 &&
      ((Number(group.entries[0].item.volumeTotal ?? group.entries[0].item.totalVolumes) || 0) > 1 ||
        (Array.isArray(group.entries[0].item.ownedVolumes) &&
          group.entries[0].item.ownedVolumes.length > 0));

    if (group.entries.length < 2 && !isSingleSerializedTracker) {
      continue;
    }

    const rep =
      group.entries.find((e) => e.item.coverUrl || e.item.status === 'playing')?.item ||
      group.entries[0].item;

    const hintTotal = Number(externalHints[group.seriesKey]?.totalVolumes) || 0;

    let maxDeclaredTotal = hintTotal;
    const ownedSet = new Set();
    const readSet = new Set();

    group.entries.forEach(({ item, indexNumber }) => {
      const itemTot = Number(item.volumeTotal ?? item.totalVolumes) || 0;
      if (itemTot > maxDeclaredTotal) maxDeclaredTotal = itemTot;

      const curVol = Number(item.volumeCurrent ?? item.currentVolume) || 0;
      if (curVol > maxDeclaredTotal) maxDeclaredTotal = curVol;

      if (indexNumber && indexNumber > maxDeclaredTotal) {
        maxDeclaredTotal = indexNumber;
      }

      if (indexNumber) {
        ownedSet.add(indexNumber);
        if (item.status === 'completed') readSet.add(indexNumber);
      }

      for (const v of normalizeOwnedVolumes(item.ownedVolumes)) {
        ownedSet.add(v);
        if (v > maxDeclaredTotal) maxDeclaredTotal = v;
      }

      if (curVol > 0 && isSingleSerializedTracker) {
        for (let v = 1; v <= curVol; v += 1) {
          readSet.add(v);
          if (ownedSet.size === 0) ownedSet.add(v);
        }
      }
    });

    const totalVolumes = Math.max(
      maxDeclaredTotal,
      ownedSet.size,
      group.entries.length
    );

    const missingVolumes = [];
    for (let v = 1; v <= totalVolumes && missingVolumes.length < 24; v += 1) {
      if (!ownedSet.has(v)) {
        missingVolumes.push(v);
      }
    }

    const coveredCount = Math.min(totalVolumes, Math.max(ownedSet.size, readSet.size));
    const completionPct =
      totalVolumes > 0 ? Math.min(100, Math.round((coveredCount / totalVolumes) * 100)) : 0;

    franchises.push({
      id: `franchise-${group.seriesKey.replace(/\s+/g, '-')}`,
      seriesKey: group.seriesKey,
      name: group.name,
      representativeItem: rep,
      items: group.entries.map((e) => e.item),
      author: rep.author || '',
      workType: rep.workType || 'book',
      genres: Array.isArray(rep.genres) ? rep.genres : [],
      coverUrl: rep.coverUrl || null,
      totalVolumes,
      ownedCount: ownedSet.size,
      readCount: readSet.size,
      completionPct,
      missingVolumes,
      nextVolumeNumber: missingVolumes[0] || null,
      isComplete: missingVolumes.length === 0 && completionPct >= 100,
    });
  }

  return franchises.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    return b.completionPct - a.completionPct || b.ownedCount - a.ownedCount;
  });
}

export function buildMissingVolumeDraft(franchise, volumeNumber) {
  const targetVol = Number(volumeNumber ?? franchise?.nextVolumeNumber) || 1;
  const rep = franchise?.representativeItem || {};
  return {
    id: createUuid(),
    title: `${franchise?.name || rep.seriesName || 'Série'} — Vol. ${targetVol}`,
    seriesName: franchise?.name || rep.seriesName || '',
    seriesIndex: String(targetVol),
    author: franchise?.author || rep.author || '',
    publisher: rep.publisher || '',
    workType: franchise?.workType || rep.workType || 'book',
    genres: Array.isArray(franchise?.genres) ? [...franchise.genres] : [],
    coverUrl: franchise?.coverUrl || rep.coverUrl || null,
    status: 'queued',
    inBacklog: true,
    isWishlist: false,
  };
}

export async function fetchSeriesHintsFromApis(seriesName, { signal } = {}) {
  const clean = String(seriesName || '').trim();
  if (!clean || typeof fetch !== 'function') return null;

  try {
    const url = new URL('https://openlibrary.org/search.json');
    url.search = new URLSearchParams({
      title: clean,
      limit: '5',
      fields: 'title,number_of_pages_median,edition_count',
    }).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const onAbort = () => controller.abort();
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) return null;
      const json = await res.json();
      const docs = Array.isArray(json?.docs) ? json.docs : [];
      if (docs.length === 0) return null;
      return {
        seriesKey: normalizeSeriesKey(clean),
        matchedWorks: docs.length,
      };
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  } catch {
    return null;
  }
}
