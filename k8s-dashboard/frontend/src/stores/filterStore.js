import { create } from 'zustand'

export const useFilterStore = create((set, get) => ({
  // Filtres actifs
  namespace: null,
  pod: null,
  severity: null,
  category: null,
  dateRange: 7, // jours

  // Setters
  setNamespace: (namespace) => set({ namespace, pod: null }),
  setPod: (pod) => set({ pod }),
  setSeverity: (severity) => set({ severity }),
  setCategory: (category) => set({ category }),
  setDateRange: (dateRange) => set({ dateRange }),
  resetFilters: () => set({ namespace: null, pod: null, severity: null, category: null, dateRange: 7 }),

  // Getter pratique pour les params API
  getApiParams: () => {
    const { namespace, pod, severity, category } = get()
    return {
      ...(namespace && { namespace }),
      ...(pod && { pod_name: pod }),
      ...(severity && { severity }),
      ...(category && { category }),
    }
  },
}))

// Store auth séparé
export const useAuthStore = create((set) => ({
  isAuthenticated: !!localStorage.getItem('access_token'),
  username: null,

  login: async (credentials) => {
    const { api } = await import('../api/client.js')
    const data = await api.login(credentials)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ isAuthenticated: true, username: credentials.username })
    return data
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ isAuthenticated: false, username: null })
  },
}))
