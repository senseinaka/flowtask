import { ipcMain, shell, app, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'

const GRAPHIFY = 'C:\\Users\\Diego\\.local\\bin\\graphify.exe'

function graphifyOut(): string {
  return path.join(app.getAppPath(), 'graphify-out')
}

function runGraphify(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = app.getAppPath()
    const escaped = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')
    exec(`"${GRAPHIFY}" ${escaped}`, { cwd, timeout: 30000, encoding: 'utf-8' }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

export function registerCortexIpc(): void {
  ipcMain.handle('cortex:openGraph', () => {
    const htmlPath = path.join(graphifyOut(), 'graph.html')
    return shell.openPath(htmlPath)
  })

  ipcMain.handle('cortex:openGraphWindow', () => {
    const htmlPath = path.join(graphifyOut(), 'graph.html')
    if (!fs.existsSync(htmlPath)) throw new Error('graph.html no encontrado en graphify-out/')
    const win = new BrowserWindow({
      width: 1440,
      height: 900,
      title: 'Cortex — Grafo de código Summit',
      autoHideMenuBar: true,
      backgroundColor: '#0f172a'
    })
    win.loadFile(htmlPath)
  })

  ipcMain.handle('cortex:getReport', () => {
    const reportPath = path.join(graphifyOut(), 'GRAPH_REPORT.md')
    if (!fs.existsSync(reportPath)) return null
    return fs.readFileSync(reportPath, 'utf-8')
  })

  ipcMain.handle('cortex:query', (_e, question: string) =>
    runGraphify(['query', question])
  )

  ipcMain.handle('cortex:path', (_e, from: string, to: string) =>
    runGraphify(['path', from, to])
  )

  ipcMain.handle('cortex:explain', (_e, node: string) =>
    runGraphify(['explain', node])
  )
}
