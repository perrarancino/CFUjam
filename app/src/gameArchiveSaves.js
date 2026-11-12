let database;
const maxFileBytes = 16 * 1024 * 1024;
const maxStorageBytes = 512 * 1024;

function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('cfujam-game-saves', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('games');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
  }).catch((error) => {
    database = undefined;
    throw error;
  });
  return database;
}

function readSave(db, gameId) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('games').objectStore('games').get(gameId);
    request.onsuccess = () => resolve(request.result ?? { storage: [], files: [] });
    request.onerror = () => reject(request.error);
  });
}

function validateEntry(kind, key, value) {
  if (typeof key !== 'string' || key.length > 1024) throw new Error('Invalid save key');
  if (kind === 'files') {
    if (!key.startsWith('/userfs/') || key.includes('\\') || key.slice(8).split('/').some((part) => !part || part === '.' || part === '..')) {
      throw new Error('Invalid save path');
    }
    if (value === null) return;
    if (!Number.isInteger(value?.mode) || !(value.timestamp instanceof Date) || !Number.isFinite(value.timestamp.getTime())) {
      throw new Error('Invalid save file metadata');
    }
    const contents = value.contents;
    if (contents !== undefined && !(contents instanceof Uint8Array || contents instanceof Int8Array)) {
      throw new Error('Invalid save file contents');
    }
  } else if (value !== null && typeof value !== 'string') {
    throw new Error('Invalid storage value');
  }
}

function writeSave(db, gameId, { kind, changes, clear }) {
  if (!['files', 'storage'].includes(kind) || !Array.isArray(changes) || changes.length > 1000) {
    throw new Error('Invalid save update');
  }
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('games', 'readwrite');
    const store = transaction.objectStore('games');
    const request = store.get(gameId);
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Save transaction aborted'));
    request.onsuccess = () => {
      try {
        const save = request.result ?? { storage: [], files: [] };
        const entries = new Map(clear === true ? [] : save[kind]);
        for (const [key, value] of changes) {
          validateEntry(kind, key, value);
          if (value === null) entries.delete(key);
          else entries.set(key, value);
        }
        let bytes = 0;
        for (const [key, value] of entries) {
          bytes += key.length * 2 + (kind === 'files' ? (value.contents?.byteLength ?? 0) : value.length * 2);
        }
        const limit = kind === 'files' ? maxFileBytes : maxStorageBytes;
        if (bytes > limit || entries.size > 1000) throw new Error('Game save exceeds storage limit');
        const updated = kind === 'files' ? [...entries].map(([key, { mode, timestamp, contents }]) => [
          key, { mode, timestamp, contents: contents && new Uint8Array(contents.buffer, contents.byteOffset, contents.byteLength).slice() }
        ]) : [...entries];
        store.put({ ...save, [kind]: updated }, gameId);
      } catch (error) {
        reject(error);
        transaction.abort();
      }
    };
  });
}

export function connectGameSaves(gameId, port) {
  let operations = Promise.resolve();
  port.onmessage = ({ data }) => {
    if (!Number.isSafeInteger(data?.id) || !['read', 'write'].includes(data.operation)) return;
    operations = operations.then(async () => {
      try {
        const db = await openDatabase();
        const value = data.operation === 'read' ? await readSave(db, gameId) : await writeSave(db, gameId, data);
        port.postMessage({ id: data.id, value });
      } catch (error) {
        console.warn('Game storage request failed', error);
        port.postMessage({ id: data.id, failed: true });
      }
    });
  };
  // Let already posted saves reach the host when the player switches frames.
  return () => setTimeout(() => port.close(), 0);
}
