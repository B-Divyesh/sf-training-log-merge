import type { Workout } from './types';

const DB_NAME = 'training-log-merge';
const STORE = 'workouts';
const DEMO_KEY = 'demo:training-log-merge:workouts';
let demoMode = false;

export function useDemoStorage(enabled: boolean): void {
  demoMode = enabled;
}

function demoWorkouts(): Workout[] {
  try {
    const value = JSON.parse(sessionStorage.getItem(DEMO_KEY) ?? '[]') as unknown;
    return Array.isArray(value) ? value as Workout[] : [];
  } catch {
    return [];
  }
}

function saveDemoWorkouts(workouts: Workout[]): void {
  sessionStorage.setItem(DEMO_KEY, JSON.stringify(workouts));
}

export function resetDemoStorage(): void {
  sessionStorage.removeItem(DEMO_KEY);
  sessionStorage.removeItem('demo:training-log-merge:timezone');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('startedAt', 'startedAt');
        store.createIndex('fingerprint', 'fingerprint');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open your local ledger.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local database operation failed.'));
  });
}

export async function getWorkouts(): Promise<Workout[]> {
  if (demoMode) return demoWorkouts().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const db = await openDb();
  const result = await requestResult(db.transaction(STORE).objectStore(STORE).getAll()) as Workout[];
  db.close();
  return result.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  if (!workouts.length) return;
  if (demoMode) {
    const existing = demoWorkouts();
    const merged = new Map(existing.map((workout) => [workout.id, workout]));
    workouts.forEach((workout) => merged.set(workout.id, workout));
    saveDemoWorkouts([...merged.values()]);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    workouts.forEach((workout) => store.put(workout));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save to your ledger.'));
  });
  db.close();
}

export async function deleteWorkout(id: string): Promise<void> {
  if (demoMode) {
    saveDemoWorkouts(demoWorkouts().filter((workout) => workout.id !== id));
    return;
  }
  const db = await openDb();
  await requestResult(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  db.close();
}

export async function replaceAllWorkouts(workouts: Workout[]): Promise<void> {
  if (demoMode) {
    saveDemoWorkouts(workouts);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    store.clear();
    workouts.forEach((workout) => store.put(workout));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not restore your ledger.'));
  });
  db.close();
}
