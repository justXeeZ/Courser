import type { MaterialFileRepository, StoredFileRecord } from '@/lib/storage/types';
import type { CourseTree } from '@/types/course';

export const FILE_DB_NAME = 'college_course_trees';
export const FILE_DB_VERSION = 1;
export const FILE_STORE_NAME = 'files';

const INLINE_TAB_MIME_TYPES = new Set([
  'application/pdf',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
]);

const TEXT_CODE_MIME_TYPES = new Set(['application/json']);

const TEXT_CODE_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.csv',
  '.py',
  '.js',
  '.ts',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.ipynb',
  '.json',
]);

const URL_REVOKE_DELAY_MS = 60_000;

let persistRequested = false;

function requestPersistentStorageOnce(): void {
  if (persistRequested) return;
  persistRequested = true;
  try {
    const storageManager = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    const persist = storageManager?.persist;
    if (typeof persist === 'function') {
      Promise.resolve(persist.call(storageManager)).catch(() => {
        // Ignore storage persistence rejections
      });
    }
  } catch {
    // Ignore missing or restricted StorageManager API
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }

  requestPersistentStorageOnce();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        db.createObjectStore(FILE_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB database.'));
    };

    request.onblocked = () => {
      reject(new Error('IndexedDB open request was blocked.'));
    };
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

interface InternalStoredFileRecord extends StoredFileRecord {
  data?: Uint8Array;
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read Blob.'));
      reader.readAsArrayBuffer(blob);
    });
  }
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

function shouldStoreFallbackBytes(file: Blob): boolean {
  if (typeof indexedDB !== 'undefined' && indexedDB.constructor?.name === 'FDBFactory') {
    return true;
  }
  try {
    const cloned = structuredClone(file);
    return !(cloned instanceof Blob);
  } catch {
    return true;
  }
}

export async function putFile(
  id: string,
  file: Blob,
  name: string,
  mimeType: string
): Promise<void> {
  const resolvedMimeType = mimeType || file.type || 'application/octet-stream';
  const fallbackBytes = shouldStoreFallbackBytes(file)
    ? await blobToUint8Array(file)
    : undefined;

  const db = await openDatabase();
  try {
    const tx = db.transaction(FILE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(FILE_STORE_NAME);
    const record: InternalStoredFileRecord = {
      id,
      name,
      mimeType: resolvedMimeType,
      sizeBytes: file.size,
      blob: file,
      ...(fallbackBytes ? { data: fallbackBytes } : {}),
      createdAt: Date.now(),
    };
    await runRequest(store.put(record));
    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}

export async function getFile(id: string): Promise<StoredFileRecord | undefined> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(FILE_STORE_NAME, 'readonly');
    const store = tx.objectStore(FILE_STORE_NAME);
    const result = await runRequest<InternalStoredFileRecord | undefined>(store.get(id));
    await waitForTransaction(tx);
    if (!result) return undefined;

    let blob = result.blob;
    if (!(blob instanceof Blob) && result.data) {
      blob = new Blob([new Uint8Array(result.data)], { type: result.mimeType });
    }

    return {
      id: result.id,
      name: result.name,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      blob,
      createdAt: result.createdAt,
    };
  } finally {
    db.close();
  }
}

export async function deleteFile(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(FILE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(FILE_STORE_NAME);
    await runRequest(store.delete(id));
    await waitForTransaction(tx);
  } finally {
    db.close();
  }
}

export async function listFileIds(): Promise<string[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(FILE_STORE_NAME, 'readonly');
    const store = tx.objectStore(FILE_STORE_NAME);
    const keys = await runRequest<IDBValidKey[]>(store.getAllKeys());
    await waitForTransaction(tx);
    return keys.map((key) => String(key));
  } finally {
    db.close();
  }
}

export async function garbageCollectFiles(referenced: Set<string>): Promise<number> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(FILE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(FILE_STORE_NAME);
    const keys = await runRequest<IDBValidKey[]>(store.getAllKeys());
    let deletedCount = 0;

    for (const key of keys) {
      const id = String(key);
      if (!referenced.has(id)) {
        await runRequest(store.delete(key));
        deletedCount += 1;
      }
    }

    await waitForTransaction(tx);
    return deletedCount;
  } finally {
    db.close();
  }
}

export function collectReferencedFileIds(courses: Iterable<CourseTree>): Set<string> {
  const referenced = new Set<string>();

  for (const course of courses) {
    for (const chapter of course.chapters) {
      if (chapter.resources) {
        for (const resource of chapter.resources) {
          if (resource.file?.id) {
            referenced.add(resource.file.id);
          }
        }
      }

      for (const lesson of chapter.lessons) {
        for (const resource of lesson.resources) {
          if (resource.file?.id) {
            referenced.add(resource.file.id);
          }
        }
      }
    }
  }

  return referenced;
}

function getLowerExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf('.');
  return lastDot >= 0 ? trimmed.slice(lastDot).toLowerCase() : '';
}

function isTextOrCodeFile(mimeType: string, extension: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    TEXT_CODE_MIME_TYPES.has(mimeType) ||
    TEXT_CODE_EXTENSIONS.has(extension)
  );
}

function isInlineTabMedia(mimeType: string): boolean {
  if (mimeType === 'image/svg+xml') return false;
  return mimeType.startsWith('image/') || INLINE_TAB_MIME_TYPES.has(mimeType);
}

export async function openStoredFile(id: string): Promise<boolean> {
  const record = await getFile(id);
  if (!record) return false;

  const mimeType = (record.mimeType || record.blob.type || '').split(';')[0].trim().toLowerCase();
  const extension = getLowerExtension(record.name);

  let blobToOpen = record.blob;
  let openMode: 'tab' | 'download' = 'download';

  if (isTextOrCodeFile(mimeType, extension)) {
    blobToOpen = new Blob([record.blob], { type: 'text/plain' });
    openMode = 'tab';
  } else if (isInlineTabMedia(mimeType)) {
    openMode = 'tab';
  }

  const url = URL.createObjectURL(blobToOpen);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, URL_REVOKE_DELAY_MS);

  if (openMode === 'tab') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = record.name;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body?.appendChild(link);
    link.click();
    link.remove();
  }

  return true;
}

export const localMaterialFileRepository: MaterialFileRepository = {
  putFile,
  getFile,
  deleteFile,
  listFileIds,
  garbageCollectFiles,
};
