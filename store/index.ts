'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ActiveModal {
  id: string
  data?: unknown
}

interface AppStore {
  // Empresa ativa (multi-CNPJ)
  activeCompanyId: string | null
  setActiveCompany: (id: string) => void

  // Sidebar
  sidebarExpanded: boolean
  toggleSidebar: () => void
  setSidebarExpanded: (v: boolean) => void

  // Mobile sidebar (não persistido)
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (v: boolean) => void

  // Modais
  activeModal: ActiveModal | null
  openModal: (id: string, data?: unknown) => void
  closeModal: () => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      activeCompanyId: null,
      setActiveCompany: (id) => set({ activeCompanyId: id }),

      sidebarExpanded: true,
      toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
      setSidebarExpanded: (v) => set({ sidebarExpanded: v }),

      mobileSidebarOpen: false,
      setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),

      activeModal: null,
      openModal: (id, data) => set({ activeModal: { id, data } }),
      closeModal: () => set({ activeModal: null }),
    }),
    {
      name: 'casa-empresarial-store',
      partialize: (state) => ({
        activeCompanyId: state.activeCompanyId,
        sidebarExpanded: state.sidebarExpanded,
      }),
    }
  )
)
