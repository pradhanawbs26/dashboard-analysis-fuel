// Bulletproof IndexedDB + LocalStorage persistent caching engine

const DB_NAME = "wbs_fuel_db";
const DB_VERSION = 1;
const STORE_NAME = "session_data";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

/**
 * Synchronous reader from localStorage for instant 0ms React initial state
 */
export function getSyncLocalData<T = any>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(`wbs_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed !== undefined && parsed !== null) {
        if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
          return defaultValue;
        }
        return parsed as T;
      }
    }
  } catch (e) {
    // LocalStorage read error or JSON parse error
  }
  return defaultValue;
}

/**
 * Saves data into both IndexedDB (supports >100MB) and LocalStorage (instant sync)
 */
export async function saveLocalData(key: string, data: any): Promise<void> {
  // 1. Always attempt fast synchronous write to LocalStorage
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(`wbs_${key}`, JSON.stringify(data));
    }
  } catch (e) {
    // If payload exceeds 5MB localStorage quota, warn and rely on IndexedDB
    console.warn(`LocalStorage quota note for key "${key}", using IndexedDB fallback.`, e);
  }

  // 2. Write to persistent IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error("Put operation failed"));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB save note:", err);
  }
}

/**
 * Asynchronous reader checking IndexedDB first, then fallback to LocalStorage
 */
export async function getLocalData<T = any>(key: string): Promise<T | null> {
  // Try IndexedDB first
  try {
    const db = await openDB();
    const result = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
    if (result !== null && result !== undefined) {
      return result;
    }
  } catch (err) {
    // Fallback to localStorage
  }

  // Fallback to localStorage
  try {
    if (typeof window !== "undefined") {
      const item = localStorage.getItem(`wbs_${key}`);
      return item ? JSON.parse(item) : null;
    }
  } catch (e) {}

  return null;
}

export async function removeLocalData(key: string): Promise<void> {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`wbs_${key}`);
    }
  } catch (e) {}

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {}
}

export async function clearAllLocalData(): Promise<void> {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("wbs_fuel_records");
      localStorage.removeItem("wbs_fuel_plans");
      localStorage.removeItem("wbs_fuel_meta");
    }
  } catch (e) {}

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {}
}
