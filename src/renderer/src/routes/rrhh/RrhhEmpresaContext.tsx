import { createContext, useContext } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { RRHH_EMPRESAS, type RrhhEmpresa } from '@shared/types'

const RrhhEmpresaContext = createContext<RrhhEmpresa>('naka')

/** Empresa RRHH activa, resuelta desde la ruta (:empresa). */
export function useRrhhEmpresa(): RrhhEmpresa {
  return useContext(RrhhEmpresaContext)
}

function isEmpresa(v: string | undefined): v is RrhhEmpresa {
  return !!v && (RRHH_EMPRESAS as string[]).includes(v)
}

/**
 * Layout de las rutas RRHH: lee :empresa del path y la provee por context a
 * todos los hijos (dashboards, detalle, modales). Fallback a 'naka' si el
 * segmento es desconocido. Un único componente por vista parametrizado por
 * empresa → NAKA y EV son réplicas que comparten código.
 */
export default function RrhhEmpresaLayout() {
  const { empresa } = useParams()
  const value: RrhhEmpresa = isEmpresa(empresa) ? empresa : 'naka'
  return (
    <RrhhEmpresaContext.Provider value={value}>
      <Outlet />
    </RrhhEmpresaContext.Provider>
  )
}
