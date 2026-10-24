import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Object storage abstraction. Files are private: they are only ever served through
 * an authorized route, never from a public bucket URL.
 */
export interface StorageDriver {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}

/** Development driver: writes under STORAGE_LOCAL_DIR (default ./.data/uploads). */
export class LocalDiskStorage implements StorageDriver {
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key: string, bytes: Uint8Array) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, bytes);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.resolve(key)));
  }
}

let driver: StorageDriver | null = null;
export function getStorage(): StorageDriver {
  if (!driver) driver = new LocalDiskStorage(process.env.STORAGE_LOCAL_DIR ?? path.resolve(process.cwd(), ".data/uploads"));
  return driver;
}
export function setStorage(d: StorageDriver) {
  driver = d;
}

export function newStorageKey(workspaceId: string, projectId: string, ext: string) {
  return `${workspaceId}/${projectId}/${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin"}`;
}
