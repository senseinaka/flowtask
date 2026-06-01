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

  // Delegated tasks panel
  selectedDelegatedTaskId: string | null
  delegatedDetailPanelWidth: number
  expandedDelegatedTaskId: string | null

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

  setSelectedDelegatedTask: (id: string | null) => void
  setDelegatedDetailPanelWidth: (w: number) => void
  openExpandedDelegatedTask: (id: string) => void
  closeExpandedDelegatedTask: () => void
}

export const useUIStore = create<UIState>((set) => ({
  selectedTaskId: null,
  isTaskFormOpen: false,
  editingTaskId: null,
  filters: {},
  searchQuery: '',
  detailPanelWidth: 380,
  expandedTaskId: null,
  selectedDelegatedTaskId: null,
  delegatedDetailPanelWidth: 380,
  expandedDelegatedTaskId: null,

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

  setSelectedDelegatedTask: (id) => set({ selectedDelegatedTaskId: id }),
  setDelegatedDetailPanelWidth: (w) => set({ delegatedDetailPanelWidth: w }),
  openExpandedDelegatedTask: (id) => set({ expandedDelegatedTaskId: id, selectedDelegatedTaskId: id }),
  closeExpandedDelegatedTask: () => set({ expandedDelegatedTaskId: null })
}))
