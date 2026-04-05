import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client.js'
import { useFilterStore } from '../stores/filterStore.js'

// ─── Risk Score ───────────────────────────────────────────────

export function useRiskScore() {
  const namespace = useFilterStore(s => s.namespace)
  return useQuery({
    queryKey: ['risk-score', namespace],
    queryFn: () => api.getRiskScore(namespace),
    refetchInterval: 5000,
    staleTime: 4000,
  })
}

export function useRiskHistory() {
  const { namespace, dateRange } = useFilterStore(s => ({ namespace: s.namespace, dateRange: s.dateRange }))
  return useQuery({
    queryKey: ['risk-history', namespace, dateRange],
    queryFn: () => api.getRiskHistory(dateRange, namespace),
    refetchInterval: 30000,
    staleTime: 20000,
  })
}

// ─── Incidents ────────────────────────────────────────────────

export function useIncidents(extraParams = {}) {
  const getApiParams = useFilterStore(s => s.getApiParams)
  const params = { ...getApiParams(), ...extraParams }
  return useQuery({
    queryKey: ['incidents', params],
    queryFn: () => api.getIncidents(params),
    refetchInterval: 10000,
    staleTime: 8000,
  })
}

export function useIncident(id) {
  return useQuery({
    queryKey: ['incident', id],
    queryFn: () => api.getIncident(id),
    enabled: !!id,
  })
}

export function useIncidentTimeline(id) {
  return useQuery({
    queryKey: ['incident-timeline', id],
    queryFn: () => api.getIncidentTimeline(id),
    enabled: !!id,
  })
}

// ─── IR Live (polling rapide 2s) ──────────────────────────────

export function useIncidentTimer(id) {
  return useQuery({
    queryKey: ['incident-timer', id],
    queryFn: () => api.getIncidentTimer(id),
    enabled: !!id,
    refetchInterval: 2000,
    staleTime: 1500,
  })
}

// ─── Dashboard summary ────────────────────────────────────────

export function useDashboardSummary() {
  const namespace = useFilterStore(s => s.namespace)
  return useQuery({
    queryKey: ['dashboard-summary', namespace],
    queryFn: () => api.getDashboardSummary(namespace),
    refetchInterval: 30000,
    staleTime: 25000,
  })
}

// ─── Namespaces / Pods ────────────────────────────────────────

export function useNamespaces() {
  return useQuery({
    queryKey: ['namespaces'],
    queryFn: api.getNamespaces,
    staleTime: 60000,
  })
}

export function usePods() {
  const namespace = useFilterStore(s => s.namespace)
  return useQuery({
    queryKey: ['pods', namespace],
    queryFn: () => api.getPods(namespace),
    staleTime: 30000,
  })
}

// ─── Mutations IR ─────────────────────────────────────────────

export function useCancelIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.cancelIncident(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })
}

export function useResolveIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.resolveIncident(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })
}
