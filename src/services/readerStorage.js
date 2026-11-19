const DB_NAME = 'codice_reader_files_v1';
const STORE_NAME = 'book_files';
const DB_VERSION = 1;

function openReaderDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'workId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erro ao abrir IndexedDB'));
  });
}

export async function saveBookFile(
  workId,
  { blob = null, fileHandle = null, fileName = '', format = 'pdf', size = 0 }
) {
  if (!workId) return null;
  const db = await openReaderDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let savedRecord = null;
    const getReq = store.get(String(workId));
    getReq.onsuccess = () => {
      const existing = getReq.result || null;
      savedRecord = {
        workId: String(workId),
        blob: blob ?? existing?.blob ?? null,
        fileHandle: fileHandle ?? existing?.fileHandle ?? null,
        fileName: String(fileName || existing?.fileName || 'obra'),
        format: String(format || existing?.format || 'pdf'),
        size: Number(size) || blob?.size || existing?.size || 0,
        readerState: existing?.readerState || null,
        savedAt: new Date().toISOString(),
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
  try {
    const db = await openReaderDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(String(workId));
      req.onsuccess = () => {
        const existing = req.result || {
          workId: String(workId),
          blob: null,
          fileHandle: null,
          fileName: 'obra',
          format: '',
          size: 0,
          savedAt: new Date().toISOString(),
        };
        store.put({
          ...existing,
          workId: String(workId),
          readerState,
          readerUpdatedAt: new Date().toISOString(),
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

export async function getBookReaderState(workId) {
  const record = await getBookFileRecord(workId);
  return record?.readerState || null;
}

export async function getBookFileRecord(workId) {
  if (!workId) return null;
  try {
    const db = await openReaderDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(String(workId));
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
  if (record.blob instanceof Blob) {
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
  try {
    const db = await openReaderDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(String(workId));
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

export async function listStoredBookIds() {
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
