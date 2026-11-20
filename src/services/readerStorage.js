import { detectBookFileFormat } from '../utils/fileFormatDetector.js';

const DB_NAME = 'codice_reader_files_v1';
const STORE_NAME = 'book_files';
const AI_CACHE_STORE_NAME = 'ai_cache';
const DB_VERSION = 3;

// Fallback em memória para ambientes headless/Node de teste sem IndexedDB
const memoryStore = new Map();
const aiCacheMemoryStore = new Map();

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

export function clearMemoryReaderStoreForTests() {
  memoryStore.clear();
  aiCacheMemoryStore.clear();
}

export function buildQuickReaderBookId(fileName = 'arquivo', size = 0) {
  const safeName = String(fileName || 'arquivo').trim() || 'arquivo';
  const safeSize = Math.max(0, Number(size) || 0);
  return `quick:${safeName}:${safeSize}`;
}

export function normalizeStoredFormat(format = '', fileName = '') {
  const f = String(format || '').toLowerCase().trim();
  if (f === 'md') return 'markdown';
  if (f === 'epub' || f === 'pdf' || f === 'cbz' || f === 'txt' || f === 'markdown') {
    return f;
  }
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.epub')) return 'epub';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.cbz')) return 'cbz';
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.txt')) return 'txt';
  return 'epub';
}

export function formatStorageSizeLabel(sizeBytes = 0) {
  const bytes = Math.max(0, Number(sizeBytes) || 0);
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${bytes} B`;
}

function openReaderDb() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'workId' });
      }
      if (!db.objectStoreNames.contains(AI_CACHE_STORE_NAME)) {
        db.createObjectStore(AI_CACHE_STORE_NAME, { keyPath: 'cacheKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('Erro ao abrir IndexedDB'));
  });
}

async function getAllStoredRecordsRaw() {
  if (!hasIndexedDb()) {
    return Array.from(memoryStore.values());
  }
  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
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

export async function saveBookFile(
  workId,
  {
    blob = null,
    fileHandle = null,
    fileName = '',
    format = 'pdf',
    size = 0,
    readerState = undefined,
    lastOpenedAt = undefined,
  }
) {
  if (!workId) return null;
  const key = String(workId);
  const nowIso = new Date().toISOString();

  if (!hasIndexedDb()) {
    const existing = memoryStore.get(key) || null;
    const resolvedName = String(fileName || existing?.fileName || 'obra');
    const savedRecord = {
      workId: key,
      blob: blob ?? existing?.blob ?? null,
      fileHandle: fileHandle ?? existing?.fileHandle ?? null,
      fileName: resolvedName,
      format: normalizeStoredFormat(format || existing?.format, resolvedName),
      size: Number(size) || blob?.size || existing?.size || 0,
      readerState:
        readerState !== undefined ? readerState : existing?.readerState || null,
      savedAt: existing?.savedAt || nowIso,
      lastOpenedAt:
        lastOpenedAt !== undefined
          ? lastOpenedAt
          : existing?.lastOpenedAt || nowIso,
    };
    memoryStore.set(key, savedRecord);
    return savedRecord;
  }

  const db = await openReaderDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let savedRecord = null;
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      const existing = getReq.result || null;
      const resolvedName = String(fileName || existing?.fileName || 'obra');
      savedRecord = {
        workId: key,
        blob: blob ?? existing?.blob ?? null,
        fileHandle: fileHandle ?? existing?.fileHandle ?? null,
        fileName: resolvedName,
        format: normalizeStoredFormat(format || existing?.format, resolvedName),
        size: Number(size) || blob?.size || existing?.size || 0,
        readerState:
          readerState !== undefined ? readerState : existing?.readerState || null,
        savedAt: existing?.savedAt || nowIso,
        lastOpenedAt:
          lastOpenedAt !== undefined
            ? lastOpenedAt
            : existing?.lastOpenedAt || nowIso,
      };
      store.put(savedRecord);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(savedRecord);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Falha ao salvar arquivo no IndexedDB'));
    };
  });
}

export async function saveBookReaderState(workId, readerState) {
  if (!workId || !readerState || typeof readerState !== 'object') return false;
  const key = String(workId);
  const nowIso = new Date().toISOString();

  if (!hasIndexedDb()) {
    const existing = memoryStore.get(key) || {
      workId: key,
      blob: null,
      fileHandle: null,
      fileName: 'obra',
      format: '',
      size: 0,
      savedAt: nowIso,
      lastOpenedAt: nowIso,
    };
    memoryStore.set(key, {
      ...existing,
      workId: key,
      readerState,
      readerUpdatedAt: nowIso,
      lastOpenedAt: nowIso,
    });
    return true;
  }

  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const existing = req.result || {
          workId: key,
          blob: null,
          fileHandle: null,
          fileName: 'obra',
          format: '',
          size: 0,
          savedAt: nowIso,
        };
        store.put({
          ...existing,
          workId: key,
          readerState,
          readerUpdatedAt: nowIso,
          lastOpenedAt: nowIso,
        });
      };
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function markStoredBookOpened(workId) {
  if (!workId) return false;
  const key = String(workId);
  const nowIso = new Date().toISOString();

  if (!hasIndexedDb()) {
    const existing = memoryStore.get(key);
    if (!existing) return false;
    memoryStore.set(key, { ...existing, lastOpenedAt: nowIso });
    return true;
  }

  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) {
          store.put({ ...req.result, lastOpenedAt: nowIso });
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function getBookReaderState(workId) {
  const record = await getBookFileRecord(workId);
  return record?.readerState || null;
}

export async function getBookEpubLocations(workId) {
  const record = await getBookFileRecord(workId);
  return record?.epubLocations || null;
}

export async function saveBookEpubLocations(workId, epubLocations) {
  if (!workId || !epubLocations) return false;
  const key = String(workId);
  const nowIso = new Date().toISOString();

  if (!hasIndexedDb()) {
    const existing = memoryStore.get(key) || {
      workId: key,
      blob: null,
      fileHandle: null,
      fileName: 'obra',
      format: 'epub',
      size: 0,
      savedAt: nowIso,
      lastOpenedAt: nowIso,
    };
    memoryStore.set(key, {
      ...existing,
      workId: key,
      epubLocations,
    });
    return true;
  }

  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const existing = req.result || {
          workId: key,
          blob: null,
          fileHandle: null,
          fileName: 'obra',
          format: 'epub',
          size: 0,
          savedAt: nowIso,
          lastOpenedAt: nowIso,
        };
        store.put({
          ...existing,
          workId: key,
          epubLocations,
        });
      };
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function getAiCachedResult(cacheKey) {
  const key = String(cacheKey || '').trim();
  if (!key) return null;

  if (!hasIndexedDb()) {
    return aiCacheMemoryStore.get(key) || null;
  }

  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      if (!db.objectStoreNames.contains(AI_CACHE_STORE_NAME)) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction(AI_CACHE_STORE_NAME, 'readonly');
      const req = tx.objectStore(AI_CACHE_STORE_NAME).get(key);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function saveAiCachedResult(cacheKey, payload) {
  const key = String(cacheKey || '').trim();
  if (!key || !payload || typeof payload !== 'object') return false;

  const record = {
    ...payload,
    cacheKey: key,
    updatedAt: new Date().toISOString(),
  };

  if (!hasIndexedDb()) {
    aiCacheMemoryStore.set(key, record);
    return true;
  }

  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      if (!db.objectStoreNames.contains(AI_CACHE_STORE_NAME)) {
        db.close();
        resolve(false);
        return;
      }
      const tx = db.transaction(AI_CACHE_STORE_NAME, 'readwrite');
      tx.objectStore(AI_CACHE_STORE_NAME).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function getBookFileRecord(workId) {
  if (!workId) return null;
  const key = String(workId);

  if (!hasIndexedDb()) {
    return memoryStore.get(key) || null;
  }

  try {
    const db = await openReaderDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function resolveStoredFileBlob(record) {
  if (!record) return null;
  if (record.blob && typeof record.blob.size === 'number') {
    return record.blob;
  }
  if (record.fileHandle && typeof record.fileHandle.getFile === 'function') {
    const perm = await record.fileHandle.queryPermission?.({ mode: 'read' });
    if (perm !== 'granted') {
      const requested = await record.fileHandle.requestPermission?.({ mode: 'read' });
      if (requested !== 'granted') {
        throw new Error('Permissão negada para acessar o arquivo local.');
      }
    }
    return await record.fileHandle.getFile();
  }
  return null;
}

export async function deleteBookFile(workId) {
  if (!workId) return;
  const key = String(workId);

  if (!hasIndexedDb()) {
    memoryStore.delete(key);
    return;
  }

  try {
    const db = await openReaderDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
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
    // Ignora se indisponível
  }
}

export async function removeStoredReaderBook(bookId) {
  if (!bookId) return false;
  await deleteBookFile(bookId);
  return true;
}

export async function listStoredBookIds() {
  if (!hasIndexedDb()) {
    return Array.from(memoryStore.keys());
  }

  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
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

export async function listStoredReaderBooks(works = []) {
  const records = await getAllStoredRecordsRaw();
  const workMap = new Map(
    (Array.isArray(works) ? works : [])
      .filter((w) => w?.id)
      .map((w) => [String(w.id), w])
  );

  return records
    .filter((rec) => rec && (rec.blob || rec.fileHandle || Number(rec.size) > 0))
    .map((rec) => {
      const key = String(rec.workId || '');
      const matchedWork = workMap.get(key) || null;
      const pos = rec.readerState?.position || null;
      const rawPct =
        pos && Number(pos.progressPct) > 0
          ? Number(pos.progressPct)
          : matchedWork
            ? Number(matchedWork.progress) || Number(matchedWork.progressPercent) || 0
            : 0;
      const progressPct = Math.max(
        0,
        Math.min(100, Math.round(rawPct * 10) / 10)
      );
      const format = normalizeStoredFormat(rec.format, rec.fileName);
      const sizeBytes = Number(rec.size) || rec.blob?.size || 0;
      const cleanFileTitle = String(rec.fileName || 'Arquivo sem título').replace(
        /\.(epub|pdf|cbz|txt|md|markdown)$/i,
        ''
      );

      return {
        bookId: key,
        workId: matchedWork ? matchedWork.id : null,
        isLinked: Boolean(matchedWork),
        linkedWork: matchedWork,
        title: matchedWork?.title || cleanFileTitle,
        author: matchedWork?.author || '',
        coverSources: matchedWork?.coverSources || [],
        fileName: String(rec.fileName || cleanFileTitle),
        format,
        sizeBytes,
        sizeLabel: formatStorageSizeLabel(sizeBytes),
        progressPct,
        currentPage: Number(pos?.page) || Number(matchedWork?.currentPage) || 0,
        totalPages:
          Number(pos?.totalPages) || Number(matchedWork?.totalPages) || 0,
        savedAt: rec.savedAt || null,
        lastOpenedAt: rec.lastOpenedAt || rec.readerUpdatedAt || rec.savedAt || null,
        hasBlob: Boolean(rec.blob),
        hasFileHandle: Boolean(rec.fileHandle),
      };
    })
    .sort((a, b) => {
      const da = a.lastOpenedAt || a.savedAt || '';
      const db = b.lastOpenedAt || b.savedAt || '';
      return db.localeCompare(da);
    });
}

export async function importBatchReaderFiles(files = [], options = {}) {
  const list = Array.from(files || []).filter(Boolean);
  const detector = options.detectFormat || detectBookFileFormat;
  const imported = [];
  const skipped = [];

  for (const file of list) {
    try {
      const detection = await detector(file);
      if (!detection?.supported) {
        skipped.push({
          fileName: file.name || 'arquivo',
          reason: detection?.error || 'Formato não suportado.',
        });
        continue;
      }

      const bookId = buildQuickReaderBookId(file.name, file.size);
      const record = await saveBookFile(bookId, {
        blob: file,
        fileName: file.name || 'obra',
        format: detection.format,
        size: Number(file.size) || 0,
        lastOpenedAt: new Date().toISOString(),
      });
      imported.push(record);
    } catch (err) {
      skipped.push({
        fileName: file?.name || 'arquivo',
        reason: err?.message || 'Erro ao importar arquivo.',
      });
    }
  }

  return { imported, skipped };
}

export async function linkStoredReaderBookToWork(sourceBookId, targetWorkOrId) {
  const sourceId = String(sourceBookId || '');
  const targetId = String(targetWorkOrId?.id || targetWorkOrId || '');
  if (!sourceId || !targetId) {
    throw new Error('Selecione um arquivo e uma obra válida para vincular.');
  }

  const sourceRecord = await getBookFileRecord(sourceId);
  if (!sourceRecord) {
    throw new Error('Arquivo local não encontrado para vinculação.');
  }

  const saved = await saveBookFile(targetId, {
    blob: sourceRecord.blob ?? null,
    fileHandle: sourceRecord.fileHandle ?? null,
    fileName: sourceRecord.fileName,
    format: sourceRecord.format,
    size: sourceRecord.size,
    readerState: sourceRecord.readerState || null,
    lastOpenedAt: sourceRecord.lastOpenedAt || new Date().toISOString(),
  });

  if (sourceId !== targetId) {
    await deleteBookFile(sourceId);
  }

  return {
    linkedWorkId: targetId,
    record: saved,
    extractedPosition: sourceRecord.readerState?.position || null,
  };
}

export function supportsFileSystemAccessApi() {
  return (
    typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
  );
}

export async function pickFileViaSystemAccess() {
  if (!supportsFileSystemAccessApi()) return null;
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: 'Documentos, E-books e HQs',
        accept: {
          'application/pdf': ['.pdf'],
          'application/epub+zip': ['.epub'],
          'application/vnd.comicbook+zip': ['.cbz'],
          'text/plain': ['.txt'],
          'text/markdown': ['.md'],
        },
      },
    ],
  });
  if (!handle) return null;
  const file = await handle.getFile();
  return { file, handle };
}
