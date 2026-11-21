import { normalizeCollectionList } from '../utils/collections.js';
import {
  buildCodiceDatabase,
  createUuid,
  hydrateAppSnapshotFromDatabase,
  migrateDatabase,
  validateReferentialIntegrity,
} from './codiceDatabase.js';

export const AUTO_SNAPSHOT_DB_NAME = 'codice_auto_snapshots_v1';
export const AUTO_SNAPSHOT_STORE_NAME = 'snapshots';
export const MAX_AUTO_SNAPSHOTS = 5;

const memorySnapshotStore = new Map();

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

export function clearMemorySnapshotsForTests() {
  memorySnapshotStore.clear();
}

export function stripChecksumEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const rest = { ...payload };
  delete rest.checksum;
  return rest;
}

export async function computeSha256Hex(rawText) {
  const input = String(rawText ?? '');
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle?.digest) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hashBuffer);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback determinístico caso SubtleCrypto não esteja exposto
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < data.length; i += 1) {
    h1 = Math.imul(h1 ^ data[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (data[i] + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export async function exportSignedBackupPayload(db) {
  const baseDb = migrateDatabase(db);
  const canonicalJson = JSON.stringify(stripChecksumEnvelope(baseDb));
  const digest = await computeSha256Hex(canonicalJson);

  return {
    ...baseDb,
    checksum: {
      algorithm: 'SHA-256',
      digest,
      signedAt: new Date().toISOString(),
    },
  };
}

export function countDatabaseEntities(db, snapshot) {
  const tables = db?.tables || {};
  const worksCount = (tables.works || snapshot?.items || []).length;
  const quotesFromWorks = (snapshot?.items || []).reduce(
    (sum, item) => sum + (Array.isArray(item.quotes) ? item.quotes.length : 0),
    0
  );
  const quotesCount = Array.isArray(tables.quotes_notes)
    ? tables.quotes_notes.length
    : quotesFromWorks;

  return {
    works: worksCount,
    authors: Array.isArray(tables.authors) ? tables.authors.length : 0,
    quotes: quotesCount,
    reviews: Array.isArray(tables.reviews) ? tables.reviews.length : 0,
    journalEntries: Array.isArray(tables.journal_entries)
      ? tables.journal_entries.length
      : (snapshot?.posts || []).length,
    readingSessions: Array.isArray(tables.reading_sessions)
      ? tables.reading_sessions.length
      : (snapshot?.readingSessions || []).length,
  };
}

export async function inspectBackupPayload(rawText) {
  try {
    const parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (!Array.isArray(parsed) &&
        !Array.isArray(parsed.items) &&
        !(parsed.tables && typeof parsed.tables === 'object'))
    ) {
      return {
        ok: false,
        error: 'Arquivo JSON inválido ou incompatível com o Projeto Códice.',
      };
    }

    const declaredDigest = parsed?.checksum?.digest
      ? String(parsed.checksum.digest).toLowerCase().trim()
      : '';
    let checksumStatus = 'unsigned';
    let computedDigest = '';

    if (declaredDigest) {
      const canonical = JSON.stringify(stripChecksumEnvelope(parsed));
      computedDigest = (await computeSha256Hex(canonical)).toLowerCase();
      checksumStatus = computedDigest === declaredDigest ? 'valid' : 'tampered';
    } else {
      const dbTemp = migrateDatabase(parsed);
      computedDigest = await computeSha256Hex(
        JSON.stringify(stripChecksumEnvelope(dbTemp))
      );
    }

    const db = migrateDatabase(parsed);
    const integrity = validateReferentialIntegrity(db);
    const snapshot = hydrateAppSnapshotFromDatabase(db);
    const counts = countDatabaseEntities(db, snapshot);

    return {
      ok: true,
      checksumStatus,
      declaredDigest,
      computedDigest,
      integrity,
      counts,
      detectedSchemaVersion: parsed?.schemaVersion || (Array.isArray(parsed) ? '1.0' : '2.0'),
      schemaVersion: db.schemaVersion,
      db,
      snapshot,
    };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível ler o JSON selecionado. Verifique se o arquivo está íntegro.',
    };
  }
}

function mergeQuotesArrays(currentQuotes = [], incomingQuotes = []) {
  const map = new Map();
  for (const q of currentQuotes) {
    if (!q?.text) continue;
    const key = String(q.id || q.text.trim().toLowerCase());
    map.set(key, q);
  }
  for (const q of incomingQuotes) {
    if (!q?.text) continue;
    const key = String(q.id || q.text.trim().toLowerCase());
    const existing = map.get(key);
    if (!existing) {
      map.set(key, q);
    } else {
      const incomingTime = Date.parse(q.updatedAt || q.createdAt || '') || 0;
      const existingTime =
        Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
      map.set(key, incomingTime > existingTime ? q : existing);
    }
  }
  return Array.from(map.values());
}

export function mergeSnapshots(currentSnapshot = {}, incomingSnapshot = {}) {
  const currentItems = Array.isArray(currentSnapshot.items)
    ? currentSnapshot.items
    : [];
  const incomingItems = Array.isArray(incomingSnapshot.items)
    ? incomingSnapshot.items
    : [];

  const itemMap = new Map();
  for (const item of currentItems) {
    if (item?.id) itemMap.set(String(item.id), item);
  }

  for (const incoming of incomingItems) {
    if (!incoming?.id) continue;
    const key = String(incoming.id);
    const existing = itemMap.get(key);
    if (!existing) {
      itemMap.set(key, incoming);
    } else {
      const existingUpdated = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
      const incomingUpdated = Date.parse(incoming.updatedAt || incoming.createdAt || '') || 0;
      const primary = incomingUpdated > existingUpdated ? incoming : existing;
      const secondary = primary === incoming ? existing : incoming;
      itemMap.set(key, {
        ...secondary,
        ...primary,
        quotes: mergeQuotesArrays(existing.quotes, incoming.quotes),
      });
    }
  }

  const mergeById = (currList = [], incList = []) => {
    const map = new Map();
    for (const row of currList) {
      if (row?.id) map.set(String(row.id), row);
    }
    for (const row of incList) {
      if (!row?.id) continue;
      const key = String(row.id);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, row);
      } else {
        const incT = Date.parse(row.updatedAt || row.createdAt || '') || 0;
        const curT = Date.parse(existing.updatedAt || existing.createdAt || '') || 0;
        if (incT > curT) map.set(key, row);
      }
    }
    return Array.from(map.values());
  };

  const currProfile = currentSnapshot.profile || {};
  const incProfile = incomingSnapshot.profile || {};
  const mergedProfile = {
    ...incProfile,
    ...currProfile,
    displayName: currProfile.displayName || incProfile.displayName,
    bio: currProfile.bio || incProfile.bio || '',
    avatarUrl: currProfile.avatarUrl || incProfile.avatarUrl || '',
    coverUrl: currProfile.coverUrl || incProfile.coverUrl || '',
  };

  const currStreak = currentSnapshot.streak || { count: 0, lastDate: null, history: [], dailyLogs: {} };
  const incStreak = incomingSnapshot.streak || { count: 0, lastDate: null, history: [], dailyLogs: {} };
  const mergedHistory = Array.from(
    new Set([...(currStreak.history || []), ...(incStreak.history || [])])
  ).sort();
  const mergedDailyLogs = {
    ...(incStreak.dailyLogs && typeof incStreak.dailyLogs === 'object' ? incStreak.dailyLogs : {}),
    ...(currStreak.dailyLogs && typeof currStreak.dailyLogs === 'object' ? currStreak.dailyLogs : {}),
  };
  const latestLastDate =
    [currStreak.lastDate, incStreak.lastDate].filter(Boolean).sort().pop() || null;

  return {
    items: Array.from(itemMap.values()),
    posts: mergeById(currentSnapshot.posts, incomingSnapshot.posts),
    readingSessions: mergeById(
      currentSnapshot.readingSessions,
      incomingSnapshot.readingSessions
    ),
    collections: normalizeCollectionList([
      ...(currentSnapshot.collections || []),
      ...(incomingSnapshot.collections || []),
    ]),
    profile: mergedProfile,
    streak: {
      count: Math.max(Number(currStreak.count) || 0, Number(incStreak.count) || 0),
      lastDate: latestLastDate,
      history: mergedHistory,
      dailyLogs: mergedDailyLogs,
    },
  };
}

function openSnapshotDb() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB indisponível.'));
      return;
    }
    const req = indexedDB.open(AUTO_SNAPSHOT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUTO_SNAPSHOT_STORE_NAME)) {
        db.createObjectStore(AUTO_SNAPSHOT_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir snapshots'));
  });
}

async function readAllSnapshotsRaw() {
  if (!hasIndexedDb()) {
    return Array.from(memorySnapshotStore.values());
  }
  try {
    const db = await openSnapshotDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(AUTO_SNAPSHOT_STORE_NAME, 'readonly');
      const req = tx.objectStore(AUTO_SNAPSHOT_STORE_NAME).getAll();
      req.onsuccess = () => {
        db.close();
        resolve(Array.isArray(req.result) ? req.result : []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export async function listAutoSnapshots() {
  const list = await readAllSnapshotsRaw();
  return list
    .filter((entry) => entry && entry.id && entry.payload)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, MAX_AUTO_SNAPSHOTS);
}

function stripTimestampsForContentHash(obj) {
  if (Array.isArray(obj)) return obj.map(stripTimestampsForContentHash);
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'createdAt' || k === 'updatedAt' || k === 'exportedAt' || k === 'signedAt') {
      continue;
    }
    out[k] = stripTimestampsForContentHash(v);
  }
  return out;
}

export async function saveAutoSnapshot(
  workspaceData = {},
  { reason = 'auto', label = '', force = false } = {}
) {
  const db =
    workspaceData?.tables && workspaceData?.schemaVersion
      ? migrateDatabase(workspaceData)
      : buildCodiceDatabase({
          items: workspaceData.items || [],
          profile: workspaceData.profile || null,
          posts: workspaceData.posts || [],
          streak: workspaceData.streak || null,
          readingSessions: workspaceData.readingSessions || [],
          collections: workspaceData.collections || [],
        });

  const snapshot = hydrateAppSnapshotFromDatabase(db);
  const counts = countDatabaseEntities(db, snapshot);
  const signedPayload = await exportSignedBackupPayload(db);

  // Hash estrutural sem timestamps transitórios para evitar snapshots duplicados
  const contentHash = await computeSha256Hex(
    JSON.stringify({
      tables: stripTimestampsForContentHash(db.tables),
      streak: db.metadata?.streak || null,
    })
  );

  const existing = await listAutoSnapshots();
  if (!force && existing.length > 0 && existing[0].contentHash === contentHash) {
    return { saved: false, deduplicated: true, snapshot: existing[0] };
  }

  const createdAt = new Date().toISOString();
  const record = {
    id: `snap_${Date.now()}_${createUuid().slice(0, 8)}`,
    reason,
    label:
      label ||
      (reason === 'manual' ? 'Ponto de restauração manual' : 'Auto-snapshot automático'),
    createdAt,
    schemaVersion: signedPayload.schemaVersion,
    digest: signedPayload.checksum.digest,
    contentHash,
    counts,
    payload: signedPayload,
  };

  if (!hasIndexedDb()) {
    memorySnapshotStore.set(record.id, record);
    const ordered = await listAutoSnapshots();
    const keepIds = new Set(ordered.map((r) => r.id));
    for (const k of Array.from(memorySnapshotStore.keys())) {
      if (!keepIds.has(k)) memorySnapshotStore.delete(k);
    }
    return { saved: true, deduplicated: false, snapshot: record };
  }

  const idb = await openSnapshotDb();
  const allAfter = [...existing, record]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const toDelete = allAfter.slice(MAX_AUTO_SNAPSHOTS).map((r) => r.id);

  await new Promise((resolve, reject) => {
    const tx = idb.transaction(AUTO_SNAPSHOT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUTO_SNAPSHOT_STORE_NAME);
    store.put(record);
    for (const oldId of toDelete) {
      store.delete(oldId);
    }
    tx.oncomplete = () => {
      idb.close();
      resolve();
    };
    tx.onerror = () => {
      idb.close();
      reject(tx.error || new Error('Erro ao gravar auto-snapshot'));
    };
  });

  return { saved: true, deduplicated: false, snapshot: record };
}

export async function deleteAutoSnapshot(snapshotId) {
  if (!snapshotId) return;
  if (!hasIndexedDb()) {
    memorySnapshotStore.delete(snapshotId);
    return;
  }
  try {
    const db = await openSnapshotDb();
    await new Promise((resolve) => {
      const tx = db.transaction(AUTO_SNAPSHOT_STORE_NAME, 'readwrite');
      tx.objectStore(AUTO_SNAPSHOT_STORE_NAME).delete(snapshotId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Silencioso
  }
}
