export const COLLECTIONS_STORAGE_KEY = 'codice_custom_collections';

export const COLLECTION_SUGGESTIONS = [
  'Favoritos da Vida',
  'Faculdade / TCC',
  'Para Ler nas Férias',
];

function createCollectionId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `col-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeCollectionRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  return {
    id: String(raw.id || createCollectionId()),
    name,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export function normalizeCollectionList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set();
  const seenNames = new Set();
  const result = [];
  rawList.forEach((entry) => {
    const normalized = normalizeCollectionRecord(entry);
    if (!normalized) return;
    const keyName = normalized.name.toLowerCase();
    if (seenIds.has(normalized.id) || seenNames.has(keyName)) return;
    seenIds.add(normalized.id);
    seenNames.add(keyName);
    result.push(normalized);
  });
  return result;
}

export function loadSavedCollections() {
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeCollectionList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCollections(collections) {
  try {
    localStorage.setItem(
      COLLECTIONS_STORAGE_KEY,
      JSON.stringify(normalizeCollectionList(collections))
    );
  } catch {
    // Ignora erro de quota no storage
  }
}

export function createCustomCollection(name, existingCollections = []) {
  const cleanName = String(name || '').trim();
  const list = normalizeCollectionList(existingCollections);
  if (!cleanName) {
    return { collections: list, created: null, duplicate: false };
  }

  const duplicate = list.find(
    (col) => col.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    return { collections: list, created: duplicate, duplicate: true };
  }

  const created = {
    id: createCollectionId(),
    name: cleanName,
    createdAt: new Date().toISOString(),
  };

  return {
    collections: [...list, created],
    created,
    duplicate: false,
  };
}

export function toggleWorkInCollection(workCollectionIds = [], collectionId) {
  if (!collectionId) return Array.isArray(workCollectionIds) ? workCollectionIds : [];
  const current = Array.isArray(workCollectionIds)
    ? Array.from(new Set(workCollectionIds.map(String).filter(Boolean)))
    : [];
  const id = String(collectionId);
  if (current.includes(id)) {
    return current.filter((entry) => entry !== id);
  }
  return [...current, id];
}

export function filterWorksByCollection(items = [], collectionId = 'all') {
  const safeItems = Array.isArray(items) ? items : [];
  if (!collectionId || collectionId === 'all') return safeItems;
  const target = String(collectionId);
  return safeItems.filter(
    (item) =>
      Array.isArray(item?.collectionIds) &&
      item.collectionIds.map(String).includes(target)
  );
}
