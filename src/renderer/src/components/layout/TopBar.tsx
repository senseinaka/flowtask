import { Search, Plus, X } from 'lucide-react'
import { useUIStore } from '../../store/ui.store'

export default function TopBar() {
  const { searchQuery, setSearch, openCreateForm } = useUIStore()

  return (
    <header className="h-14 flex items-center gap-3 px-4 bg-slate-800 border-b border-slate-700 flex-shrink-0">
      <div className="relative flex-1 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar tareas..."
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <button
        onClick={openCreateForm}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={16} />
        Nueva tarea
      </button>
    </header>
  )
}
