const BROWSER_ID_KEY = 'editp_presence_browser_id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createBrowserId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getBrowserIdentity() {
  let id;

  try {
    id = localStorage.getItem(BROWSER_ID_KEY);
    if (!UUID_PATTERN.test(id || '')) {
      id = createBrowserId();
      localStorage.setItem(BROWSER_ID_KEY, id);
    }
  } catch {
    id = createBrowserId();
  }

  const shortId = id.replace(/[^a-f0-9]/gi, '').slice(0, 4).padEnd(4, '0').toUpperCase();
  return { id, name: `Guest ${shortId}` };
}
