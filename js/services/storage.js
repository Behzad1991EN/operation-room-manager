const DATABASE = 'operation-room-manager';
let connection, queue = Promise.resolve();
async function database() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('application');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other application tabs to upgrade browser storage.'));
  });
  return connection;
}
export async function loadState() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('application').objectStore('application').get('state');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
export function saveState(state) {
  const snapshot = structuredClone(state);
  queue = queue.catch(() => {}).then(async () => {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('application', 'readwrite');
      transaction.objectStore('application').put(snapshot, 'state');
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction aborted.'));
    });
  });
  return queue;
}
