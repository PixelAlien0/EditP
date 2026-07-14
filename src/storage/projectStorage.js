const DATABASE_NAME = 'editp-projects';
const DATABASE_VERSION = 2;
const DOCUMENTS_STORE = 'documents';
const CHECKPOINTS_STORE = 'checkpoints';
const LIBRARIES_STORE = 'libraries';
const ACTIVE_KEY = 'active';
const MAX_CHECKPOINTS = 10;

let databasePromise = null;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted.'));
  });
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
          database.createObjectStore(DOCUMENTS_STORE, { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains(CHECKPOINTS_STORE)) {
          const checkpoints = database.createObjectStore(CHECKPOINTS_STORE, { keyPath: 'id' });
          checkpoints.createIndex('updatedAt', 'updatedAt');
        }
        if (!database.objectStoreNames.contains(LIBRARIES_STORE)) {
          database.createObjectStore(LIBRARIES_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Project storage could not be opened.'));
    });
  }
  return databasePromise;
}

async function saveActive(document) {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENTS_STORE, 'readwrite');
  transaction.objectStore(DOCUMENTS_STORE).put({ key: ACTIVE_KEY, document, updatedAt: Date.now() });
  await transactionDone(transaction);
}

async function getActive() {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENTS_STORE, 'readonly');
  return requestResult(transaction.objectStore(DOCUMENTS_STORE).get(ACTIVE_KEY));
}

async function saveCheckpoint(document, reason = 'autosave') {
  const database = await openDatabase();
  const transaction = database.transaction(CHECKPOINTS_STORE, 'readwrite');
  const store = transaction.objectStore(CHECKPOINTS_STORE);
  const existing = await requestResult(store.getAll());
  store.put({ id: crypto.randomUUID(), document, reason, updatedAt: Date.now() });
  existing
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(MAX_CHECKPOINTS - 1)
    .forEach(checkpoint => store.delete(checkpoint.id));
  await transactionDone(transaction);
}

async function listRecoveryCheckpoints() {
  const database = await openDatabase();
  const transaction = database.transaction(CHECKPOINTS_STORE, 'readonly');
  const checkpoints = await requestResult(transaction.objectStore(CHECKPOINTS_STORE).getAll());
  return checkpoints.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, MAX_CHECKPOINTS);
}

async function getLibrary(key) {
  const database = await openDatabase();
  const transaction = database.transaction(LIBRARIES_STORE, 'readonly');
  return requestResult(transaction.objectStore(LIBRARIES_STORE).get(key));
}

async function saveLibrary(key, value) {
  const database = await openDatabase();
  const transaction = database.transaction(LIBRARIES_STORE, 'readwrite');
  transaction.objectStore(LIBRARIES_STORE).put({ key, value, updatedAt: Date.now() });
  await transactionDone(transaction);
}

export const projectStorage = {
  getActive,
  saveActive,
  saveCheckpoint,
  listRecoveryCheckpoints,
  getLibrary,
  saveLibrary,
};
