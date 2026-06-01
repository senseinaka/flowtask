import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import TaskList from './routes/TaskList'
import Kanban from './routes/Kanban'
import Settings from './routes/Settings'
import Team from './routes/Team'
import TeamKanban from './routes/TeamKanban'
import Contacts from './routes/Contacts'
import Messages from './routes/Messages'
import ComexDashboard from './routes/comex/ComexDashboard'
import ComexImports from './routes/comex/ComexImports'
import ComexImportDetail from './routes/comex/ComexImportDetail'
import ComexSuppliers from './routes/comex/ComexSuppliers'
import ComexSupplierDetail from './routes/comex/ComexSupplierDetail'
import ComexOperators from './routes/comex/ComexOperators'
import ComexLogistics from './routes/comex/ComexLogistics'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 30, retry: 1 }
  }
})

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <TaskList /> },
      { path: 'tasks', element: <TaskList /> },
      { path: 'kanban', element: <Kanban /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'team', element: <Team /> },
      { path: 'team/kanban', element: <TeamKanban /> },
      { path: 'messages', element: <Messages /> },
      { path: 'settings', element: <Settings /> },
      { path: 'comex', element: <ComexDashboard /> },
      { path: 'comex/imports', element: <ComexImports /> },
      { path: 'comex/imports/:id', element: <ComexImportDetail /> },
      { path: 'comex/suppliers', element: <ComexSuppliers /> },
      { path: 'comex/suppliers/:id', element: <ComexSupplierDetail /> },
      { path: 'comex/operators', element: <ComexOperators /> },
      { path: 'comex/logistics', element: <ComexLogistics /> }
    ]
  }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
