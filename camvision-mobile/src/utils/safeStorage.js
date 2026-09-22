import AsyncStorage from '@react-native-async-storage/async-storage';

/** Cache mémoire : survit au crash d'écriture disque dans la session. */
const memory = new Map();

export async function storageGet(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const value = await AsyncStorage.getItem(key);
    if (value != null) memory.set(key, value);
    return value;
  } catch (e) {
    console.warn('AsyncStorage getItem:', e?.message || e);
    return memory.has(key) ? memory.get(key) : null;
  }
}

export async function storageSet(key, value) {
  memory.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('AsyncStorage setItem:', e?.message || e);
    return false;
  }
}

export async function storageRemove(key) {
  memory.delete(key);
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn('AsyncStorage removeItem:', e?.message || e);
    return false;
  }
}
