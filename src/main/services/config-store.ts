import { app } from 'electron'
import path from 'path'
import fs from 'fs'

class ConfigStore {
  private filePath: string
  private cache: Record<string, unknown> = {}
  private loaded = false

  constructor(name: string) {
    const dir = app.getPath('userData')
    this.filePath = path.join(dir, `${name}.json`)
  }

  private load(): void {
    if (this.loaded) return
    try {
      if (fs.existsSync(this.filePath)) {
        this.cache = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
      }
    } catch {
      this.cache = {}
    }
    this.loaded = true
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8')
  }

  get<T>(key: string, defaultValue?: T): T {
    this.load()
    return (this.cache[key] as T) ?? (defaultValue as T)
  }

  set(key: string, value: unknown): void {
    this.load()
    this.cache[key] = value
    this.save()
  }

  has(key: string): boolean {
    this.load()
    return key in this.cache
  }

  delete(key: string): void {
    this.load()
    delete this.cache[key]
    this.save()
  }
}

export default ConfigStore
