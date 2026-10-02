export interface StorageAdapter {
  read<T>(key: string, fallback: T): T
  write<T>(key: string, value: T): boolean
  remove(key: string): void
}

export class BrowserStorageAdapter implements StorageAdapter {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  }

  write<T>(key: string, value: T): boolean {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Storage can be unavailable in privacy mode. The app remains usable in memory.
    }
  }
}

export const storage = new BrowserStorageAdapter()
