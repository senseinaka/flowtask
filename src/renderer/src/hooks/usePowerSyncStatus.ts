import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PowerSyncStatusInfo } from '@shared/types'

// Singleton — un solo listener IPC compartido entre todos los componentes.
// window.api.off() llama a removeAllListeners() (nuclear), así que registrar
// el listener una sola vez evita que un componente al desmontar mate el listener
// de otro (ej. SyncStatusBadge en Sistema mataba el del Sidebar).
let _status: PowerSyncStatusInfo | null = null
const _subs = new Set<(s: PowerSyncStatusInfo) => void>()
let _ready = false

function init(onDataChanged: () => void) {
  if (_ready) return
  _ready = true

  window.api.powersync.getStatus().then((s) => {
    if (!s) return
    _status = s
    _subs.forEach(fn => fn(s))
  })

  window.api.on('powersync:status', (data) => {
    _status = data as PowerSyncStatusInfo
    _subs.forEach(fn => fn(_status!))
  })

  window.api.on('powersync:dataChanged', onDataChanged)
}

export function usePowerSyncStatus() {
  const [status, setStatus] = useState<PowerSyncStatusInfo | null>(_status)
  const qc = useQueryClient()

  useEffect(() => {
    init(() => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
      qc.invalidateQueries({ queryKey: ['task-deps'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['cajas'] })
    })

    _subs.add(setStatus)
    if (_status) setStatus(_status)

    return () => { _subs.delete(setStatus) }
  }, [qc])

  return status
}
