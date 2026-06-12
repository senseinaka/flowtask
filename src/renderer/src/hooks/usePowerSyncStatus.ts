import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PowerSyncStatusInfo } from '@shared/types'

/**
 * Estado de sincronización de PowerSync + auto-refresh: cuando llega
 * `powersync:dataChanged` (datos actualizados localmente por sync remoto o
 * por otra parte de la app), invalida las queries de tasks/projects/task-deps
 * para que la UI se actualice sola sin recargar.
 */
export function usePowerSyncStatus() {
  const [status, setStatus] = useState<PowerSyncStatusInfo | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    window.api.powersync.getStatus().then(setStatus)

    window.api.on('powersync:status', (data) => {
      setStatus(data as PowerSyncStatusInfo)
    })

    window.api.on('powersync:dataChanged', () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['task'] })
      qc.invalidateQueries({ queryKey: ['task-deps'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    })

    return () => {
      window.api.off('powersync:status')
      window.api.off('powersync:dataChanged')
    }
  }, [qc])

  return status
}
