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
import ComexPlannings from './routes/comex/ComexPlannings'
import ComexPlanningDetail from './routes/comex/ComexPlanningDetail'
import ComexPlanningAIReports from './routes/comex/ComexPlanningAIReports'
import ComexOperators from './routes/comex/ComexOperators'
import ComexGestores from './routes/comex/ComexGestores'
import ComexDespachantes from './routes/comex/ComexDespachantes'
import ComexLogistics from './routes/comex/ComexLogistics'
import ExpiryDashboard from './routes/expiry/ExpiryDashboard'
import FinanceDashboard from './routes/finance/FinanceDashboard'
import CompanyFinanceDashboard from './routes/company-finance/CompanyFinanceDashboard'
import Calendar from './routes/Calendar'
import QuotesDashboard from './routes/quotes/QuotesDashboard'
import QuoteDetail from './routes/quotes/QuoteDetail'
import EmailDashboard from './routes/email/EmailDashboard'
import ReconDashboard from './routes/contable/ReconDashboard'
import ReconPeriodView from './routes/contable/ReconPeriodView'
import KnowledgeDashboard from './routes/knowledge/KnowledgeDashboard'
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
      { path: 'comex/plannings', element: <ComexPlannings /> },
      { path: 'comex/plannings/reports', element: <ComexPlanningAIReports /> },
      { path: 'comex/plannings/:id', element: <ComexPlanningDetail /> },
      { path: 'comex/operators',    element: <ComexOperators />    },
      { path: 'comex/gestores',    element: <ComexGestores />    },
      { path: 'comex/despachantes',element: <ComexDespachantes /> },
      { path: 'comex/logistics',   element: <ComexLogistics />   },
      { path: 'expiry', element: <ExpiryDashboard /> },
      { path: 'finance', element: <FinanceDashboard /> },
      { path: 'company-finance', element: <CompanyFinanceDashboard /> },
      { path: 'calendario', element: <Calendar /> },
      { path: 'quotes', element: <QuotesDashboard /> },
      { path: 'quotes/:id', element: <QuoteDetail /> },
      { path: 'knowledge', element: <KnowledgeDashboard /> },
      { path: 'email', element: <EmailDashboard /> },
      { path: 'contable/recon', element: <ReconDashboard /> },
      { path: 'contable/recon/:id', element: <ReconPeriodView /> }
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
