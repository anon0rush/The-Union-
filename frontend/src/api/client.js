const TOKEN_KEY = 'union.session';

function safeStorage(action) {
  try {
    return action(window.localStorage);
  } catch {
    return null;
  }
}

export const tokenStore = {
  get: () => safeStorage((storage) => storage.getItem(TOKEN_KEY)),
  set: (token) => safeStorage((storage) => storage.setItem(TOKEN_KEY, token)),
  clear: () => safeStorage((storage) => storage.removeItem(TOKEN_KEY)),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    const isForm = body instanceof FormData;
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && !isForm && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body === undefined || isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection.');
  }

  if (res.status === 401 && token) {
    tokenStore.clear();
    window.dispatchEvent(new Event('union:session-expired'));
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  return data;
}

export const collabUrl = () => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/collab`;
