import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import { getDb } from '../database/db'
import type { PdfReadResult, PdfPageResult, PdfTextItem } from '@shared/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = any

let workerConfigured = false
let pdfjsCache: PdfjsLib | null = null

async function getPdfLib(): Promise<PdfjsLib> {
  if (pdfjsCache) return pdfjsCache

  // Dynamic import required: pdfjs-dist is ESM-only.
  // Use legacy build to avoid browser-only globals (DOMMatrix etc).
  // @ts-ignore — .mjs path not in TS types
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdfjs: PdfjsLib = mod.default ?? mod

  if (!workerConfigured) {
    const workerPath = path.join(
      app.getAppPath(),
      'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'
    )
    pdfjs.GlobalWorkerOptions.workerSrc = `file:///${workerPath.replace(/\\/g, '/')}`
    workerConfigured = true
  }

  pdfjsCache = pdfjs
  return pdfjs
}

function hashFile(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function getCached(hash: string): PdfReadResult | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM pdf_cache WHERE hash = ?').get(hash) as {
    hash: string; file_path: string; page_count: number; pages_json: string; cached_at: number
  } | undefined
  if (!row) return null
  return {
    filePath: row.file_path,
    hash: row.hash,
    pageCount: row.page_count,
    pages: JSON.parse(row.pages_json) as PdfPageResult[],
    cachedAt: row.cached_at,
  }
}

function saveCache(result: PdfReadResult): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO pdf_cache (hash, file_path, page_count, pages_json, cached_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(result.hash, result.filePath, result.pageCount, JSON.stringify(result.pages), Date.now())
}

function calcConfidence(items: PdfTextItem[]): number {
  if (items.length === 0) return 0
  const withText = items.filter(i => i.str.trim().length > 0).length
  return Math.round((withText / items.length) * 100) / 100
}

export async function readPdf(filePath: string, useCache = true): Promise<PdfReadResult> {
  if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: ${filePath}`)

  const hash = hashFile(filePath)

  if (useCache) {
    const cached = getCached(hash)
    if (cached) return cached
  }

  const pdfjs = await getPdfLib()
  const data = fs.readFileSync(filePath)

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) })
  const doc = await loadingTask.promise
  const pages: PdfPageResult[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const warnings: string[] = []

    const items: PdfTextItem[] = (content.items as Array<{
      str: string; transform: number[]; width: number; height: number
    }>).map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
    }))

    if (items.length === 0) warnings.push(`Página ${i}: sin texto extraíble`)

    pages.push({
      pageNum: i,
      width: viewport.width,
      height: viewport.height,
      items,
      confidence: calcConfidence(items),
      warnings,
    })
  }

  const result: PdfReadResult = {
    filePath,
    hash,
    pageCount: doc.numPages,
    pages,
  }

  saveCache(result)
  return result
}

export function clearPdfCache(hash?: string): void {
  const db = getDb()
  if (hash) {
    db.prepare('DELETE FROM pdf_cache WHERE hash = ?').run(hash)
  } else {
    db.prepare('DELETE FROM pdf_cache').run()
  }
}

export function getPdfCacheInfo(): {
  count: number
  entries: Array<{ hash: string; filePath: string; pageCount: number; cachedAt: number }>
} {
  const db = getDb()
  const rows = db.prepare(
    'SELECT hash, file_path, page_count, cached_at FROM pdf_cache ORDER BY cached_at DESC'
  ).all() as Array<{ hash: string; file_path: string; page_count: number; cached_at: number }>
  return {
    count: rows.length,
    entries: rows.map(r => ({
      hash: r.hash,
      filePath: r.file_path,
      pageCount: r.page_count,
      cachedAt: r.cached_at,
    })),
  }
}
