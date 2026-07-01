import { create } from 'zustand'
import type { TaskFilters, TaskStatus, Priority } from '@shared/types'

interface UIState {
  selectedTaskId: string | null
  isTaskFormOpen: boolean
  editingTaskId: string | null
  filters: TaskFilters
  searchQuery: string
  detailPanelWidth: number           // px, drag-resizable (personal tasks)
  expandedTaskId: string | null      // task open in full modal

  // Team tasks panel ("Tareas Equipo") — mirror exacto del de tareas personales
  selectedTeamTaskId: string | null
  isTeamTaskFormOpen: boolean
  editingTeamTaskId: string | null
  teamFilters: TaskFilters
  teamSearchQuery: string
  teamDetailPanelWidth: number
  expandedTeamTaskId: string | null

  setSelectedTask: (id: string | null) => void
  openCreateForm: () => void
  openEditForm: (id: string) => void
  closeForm: () => void
  setFilter: (key: keyof TaskFilters, value: unknown) => void
  toggleStatusFilter: (status: TaskStatus) => void
  togglePriorityFilter: (priority: Priority) => void
  setSearch: (q: string) => void
  clearFilters: () => void
  setDetailPanelWidth: (w: number) => void
  openExpandedTask: (id: string) => void
  closeExpandedTask: () => void

  setSelectedTeamTask: (id: string | null) => void
  openCreateTeamForm: () => void
  openEditTeamForm: (id: string) => void
  closeTeamForm: () => void
  setTeamFilter: (key: keyof TaskFilters, value: unknown) => void
  toggleTeamStatusFilter: (status: TaskStatus) => void
  toggleTeamPriorityFilter: (priority: Priority) => void
  setTeamSearch: (q: string) => void
  clearTeamFilters: () => void
  setTeamDetailPanelWidth: (w: number) => void
  openExpandedTeamTask: (id: string) => void
  closeExpandedTeamTask: () => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedTaskId: null,
  isTaskFormOpen: false,
  editingTaskId: null,
  filters: {},
  searchQuery: '',
  detailPanelWidth: 380,
  expandedTaskId: null,

  selectedTeamTaskId: null,
  isTeamTaskFormOpen: false,
  editingTeamTaskId: null,
  teamFilters: {},
  teamSearchQuery: '',
  teamDetailPanelWidth: 380,
  expandedTeamTaskId: null,

  setSelectedTask: (id) => set({ selectedTaskId: id }),
  openCreateForm: () => set({ isTaskFormOpen: true, editingTaskId: null }),
  openEditForm: (id) => set({ isTaskFormOpen: true, editingTaskId: id }),
  closeForm: () => set({ isTaskFormOpen: false, editingTaskId: null }),

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  toggleStatusFilter: (status) =>
    set((s) => {
      const current = s.filters.status ?? []
      const next = current.includes(status)
        ? current.filter((x) => x !== status)
        : [...current, status]
      return { filters: { ...s.filters, status: next.length ? next : undefined } }
    }),

  togglePriorityFilter: (priority) =>
    set((s) => {
      const current = s.filters.priority ?? []
      const next = current.includes(priority)
        ? current.filter((x) => x !== priority)
        : [...current, priority]
      return { filters: { ...s.filters, priority: next.length ? next : undefined } }
    }),

  setSearch: (q) =>
    set((s) => ({
      searchQuery: q,
      filters: { ...s.filters, search: q || undefined }
    })),

  clearFilters: () => set({ filters: {}, searchQuery: '' }),

  setDetailPanelWidth: (w) => set({ detailPanelWidth: w }),
  openExpandedTask: (id) => set({ expandedTaskId: id }),
  closeExpandedTask: () => set({ expandedTaskId: null }),

  setSelectedTeamTask: (id) => set({ selectedTeamTaskId: id }),
  openCreateTeamForm: () => set({ isTeamTaskFormOpen: true, editingTeamTaskId: null }),
  openEditTeamForm: (id) => set({ isTeamTaskFormOpen: true, editingTeamTaskId: id }),
  closeTeamForm: () => set({ isTeamTaskFormOpen: false, editingTeamTaskId: null }),

  setTeamFilter: (key, value) =>
    set((s) => ({ teamFilters: { ...s.teamFilters, [key]: value } })),

  toggleTeamStatusFilter: (status) =>
    set((s) => {
      const current = s.teamFilters.status ?? []
      const next = current.includes(status)
        ? current.filter((x) => x !== status)
        : [...current, status]
      return { teamFilters: { ...s.teamFilters, status: next.length ? next : undefined } }
    }),

  toggleTeamPriorityFilter: (priority) =>
    set((s) => {
      const current = s.teamFilters.priority ?? []
      const next = current.includes(priority)
        ? current.filter((x) => x !== priority)
        : [...current, priority]
      return { teamFilters: { ...s.teamFilters, priority: next.length ? next : undefined } }
    }),

  setTeamSearch: (q) =>
    set((s) => ({
      teamSearchQuery: q,
      teamFilters: { ...s.teamFilters, search: q || undefined }
    })),

  clearTeamFilters: () => set({ teamFilters: {}, teamSearchQuery: '' }),

  setTeamDetailPanelWidth: (w) => set({ teamDetailPanelWidth: w }),
  openExpandedTeamTask: (id) => set({ expandedTeamTaskId: id, selectedTeamTaskId: id }),
  closeExpandedTeamTask: () => set({ expandedTeamTaskId: null })
}))
