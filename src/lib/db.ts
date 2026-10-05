import type { BossDef, LootItem, Photo, Profile, Raid } from '../game/types';

const DB_NAME = 'chore-raid';
const DB_VERSION = 1;

interface Stores {
  bosses: BossDef;
  raids: Raid;
  photos: Photo;
  loot: LootItem;
  profile: Profile;
}
export type StoreName = keyof Stores;

let dbPromise: Promise<IDBDatabase> | undefined;

function openDB(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      // One block per schema version.
      if (e.oldVersion < 1) {
        db.createObjectStore('bosses', { keyPath: 'id' });
        db.createObjectStore('raids', { keyPath: 'id' }).createIndex('status', 'status');
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('loot', { keyPath: 'id' });
        db.createObjectStore('profile');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function get<S extends StoreName>(name: S, key: IDBValidKey): Promise<Stores[S] | undefined> {
  return wrap((await store(name, 'readonly')).get(key));
}

export async function getAll<S extends StoreName>(name: S): Promise<Stores[S][]> {
  return wrap((await store(name, 'readonly')).getAll());
}

export async function getAllByIndex<S extends StoreName>(
  name: S,
  index: string,
  value: IDBValidKey,
): Promise<Stores[S][]> {
  return wrap((await store(name, 'readonly')).index(index).getAll(value));
}

/** `key` is only for stores without a keyPath (profile). */
export async function put<S extends StoreName>(name: S, value: Stores[S], key?: IDBValidKey): Promise<void> {
  await wrap((await store(name, 'readwrite')).put(value, key));
}

export async function del(name: StoreName, key: IDBValidKey): Promise<void> {
  await wrap((await store(name, 'readwrite')).delete(key));
}
