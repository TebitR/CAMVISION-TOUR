import { storageGet, storageRemove, storageSet } from '../utils/safeStorage';

const SESSION_KEY = '@camvision/user_session_v1';

export async function loadUserSession() {
  try {
    const raw = await storageGet(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export async function saveUserSession(session) {
  await storageSet(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function clearUserSession() {
  await storageRemove(SESSION_KEY);
}
