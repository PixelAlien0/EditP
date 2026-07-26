const DATABASE_NAME = 'editp-projects';
const DATABASE_VERSION = 3;
const DOCUMENTS_STORE = 'documents';
const CHECKPOINTS_STORE = 'checkpoints';
const LIBRARIES_STORE = 'libraries';
const REJECTED_PROJECTS_STORE = 'rejected-projects';
const ACTIVE_KEY = 'active';
const MAX_CHECKPOINTS = 10;
const MAX_REJECTED_PROJECTS = 5;
const MAX_REJECTED_SOURCE_LENGTH = 5 * 1024 * 1024;

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
        if (!database.objectStoreNames.contains(REJECTED_PROJECTS_STORE)) {
          const rejectedProjects = database.createObjectStore(REJECTED_PROJECTS_STORE, { keyPath: 'id' });
          rejectedProjects.createIndex('updatedAt', 'updatedAt');
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

async function saveRejectedProject({
  sourceName = 'Unknown project',
  rawText = '',
  error = 'Project validation failed.',
  code = 'INVALID_PROJECT',
}) {
  const database = await openDatabase();
  const transaction = database.transaction(REJECTED_PROJECTS_STORE, 'readwrite');
  const store = transaction.objectStore(REJECTED_PROJECTS_STORE);
  const existing = await requestResult(store.getAll());
  const record = {
    id: crypto.randomUUID(),
    sourceName: String(sourceName || 'Unknown project').slice(0, 260),
    rawText: String(rawText || '').slice(0, MAX_REJECTED_SOURCE_LENGTH),
    error: String(error || 'Project validation failed.').slice(0, 1000),
    code: String(code || 'INVALID_PROJECT').slice(0, 80),
    updatedAt: Date.now(),
  };
  store.put(record);
  existing
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(MAX_REJECTED_PROJECTS - 1)
    .forEach(item => store.delete(item.id));
  await transactionDone(transaction);
  return record;
}

async function listRejectedProjects() {
  const database = await openDatabase();
  const transaction = database.transaction(REJECTED_PROJECTS_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(REJECTED_PROJECTS_STORE).getAll());
  return records.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, MAX_REJECTED_PROJECTS);
}

async function deleteRejectedProject(id) {
  const database = await openDatabase();
  const transaction = database.transaction(REJECTED_PROJECTS_STORE, 'readwrite');
  transaction.objectStore(REJECTED_PROJECTS_STORE).delete(id);
  await transactionDone(transaction);
}

export const projectStorage = {
  getActive,
  saveActive,
  saveCheckpoint,
  listRecoveryCheckpoints,
  getLibrary,
  saveLibrary,
  saveRejectedProject,
  listRejectedProjects,
  deleteRejectedProject,
};
