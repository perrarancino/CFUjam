async function installGameArchiveStorage(port) {
  const requests = new Map();
  let sequence = 0;
  port.onmessage = ({ data }) => {
    const finish = requests.get(data?.id);
    if (finish) finish(data);
  };
  function request(operation, payload) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish({ failed: true }), 5000);
      function finish({ failed, value }) {
        clearTimeout(timer);
        requests.delete(id);
        if (failed) reject(new Error('Game storage unavailable'));
        else resolve(value);
      }
      requests.set(id, finish);
      port.postMessage({ id, operation, ...payload });
    });
  }

  let snapshot;
  try {
    snapshot = await request('read');
  } catch (error) {
    console.warn(error);
  }
  const persist = (kind, changes, clear = false) => snapshot
    ? request('write', { kind, changes, clear })
    : Promise.resolve();

  const values = new Map(snapshot?.storage ?? []);
  const persistStorage = (changes, clear) => persist('storage', changes, clear).catch(console.warn);
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) {
      const name = String(key);
      const text = String(value);
      values.set(name, text);
      persistStorage([[name, text]]);
    },
    removeItem(key) {
      const name = String(key);
      values.delete(name);
      persistStorage([[name, null]]);
    },
    clear() {
      values.clear();
      persistStorage([], true);
    }
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: new Proxy(storage, {
      get(target, key) {
        return key in target ? Reflect.get(target, key) : values.get(key);
      },
      set(target, key, value) {
        target.setItem(key, value);
        return true;
      },
      deleteProperty(target, key) {
        target.removeItem(key);
        return true;
      }
    })
  });

  if (!snapshot) return;

  // Godot's Emscripten IDBFS stores user:// files in /userfs/FILE_DATA.
  const files = new Map(snapshot.files);
  function result(getValue) {
    const response = {};
    queueMicrotask(() => {
      response.result = getValue();
      response.onsuccess?.({ target: response });
    });
    return response;
  }
  function timestampCursor() {
    const entries = [...files.entries()][Symbol.iterator]();
    const response = {};
    function advance() {
      queueMicrotask(() => {
        const { value, done } = entries.next();
        response.result = done ? null : { primaryKey: value[0], key: value[1].timestamp, continue: advance };
        response.onsuccess?.({ target: response });
      });
    }
    advance();
    return response;
  }
  const godotDatabase = {
    close() {},
    transaction(storeNames, mode) {
      const changes = new Map();
      const transaction = {
        objectStore(name) {
          if (name !== 'FILE_DATA') throw new DOMException('Unknown store', 'NotFoundError');
          return {
            index() { return { openKeyCursor: timestampCursor }; },
            get(key) { return result(() => structuredClone(changes.has(key) ? changes.get(key) ?? undefined : files.get(key))); },
            put(value, key) {
              changes.set(key, structuredClone(value));
              return result(() => key);
            },
            delete(key) {
              changes.set(key, null);
              return result(() => undefined);
            }
          };
        }
      };
      if (mode === 'readwrite') {
        setTimeout(async () => {
          try {
            if (changes.size) {
              await persist('files', [...changes]);
              for (const [key, value] of changes) {
                if (value === null) files.delete(key);
                else files.set(key, value);
              }
            }
            transaction.oncomplete?.({ target: transaction });
          } catch (error) {
            transaction.error = error;
            transaction.onabort?.({ target: transaction, preventDefault() {} });
          }
        }, 0);
      }
      return transaction;
    }
  };

  let nativeIndexedDB;
  try { nativeIndexedDB = window.indexedDB; } catch { /* The iframe has an opaque origin. */ }
  Object.defineProperty(window, 'indexedDB', {
    configurable: true,
    value: new Proxy(nativeIndexedDB ?? {}, {
      get(target, key) {
        if (key === 'open') return (name, ...args) => {
          if (name === '/userfs') return result(() => godotDatabase);
          if (!nativeIndexedDB) throw new DOMException('IndexedDB is unavailable', 'SecurityError');
          return nativeIndexedDB.open(name, ...args);
        };
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    })
  });
}
