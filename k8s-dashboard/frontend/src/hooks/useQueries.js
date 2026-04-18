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
  const namespace = useFilterStore(s => s.namespace)
  const dateRange = useFilterStore(s => s.dateRange)
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

export function useBlockedIps() {
  return useQuery({
    queryKey: ['blocked-ips'],
    queryFn: () => api.getBlockedIps(),
    refetchInterval: 10000,
  })
}

export function useAuditTrail() {
  return useQuery({
    queryKey: ['audit-trail'],
    queryFn: () => api.getAuditTrail(),
    refetchInterval: 10000,
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
      qc.invalidateQueries({ queryKey: ['incident-timer'] })
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

export function useForceExecuteIncident() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.forceExecuteIncident(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['incident-timer'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      qc.invalidateQueries({ queryKey: ['blocked-ips'] })
      qc.invalidateQueries({ queryKey: ['audit-trail'] })
      qc.invalidateQueries({ queryKey: ['pending-incidents'] })
    },
  })
}

export function usePendingIncidents() {
  return useQuery({
    queryKey: ['pending-incidents'],
    queryFn: () => api.getPendingIncidents(),
    refetchInterval: 5000,
    staleTime: 3000,
  })
}

export function useTriggerIR() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.triggerIR(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-incidents'] })
      qc.invalidateQueries({ queryKey: ['blocked-ips'] })
      qc.invalidateQueries({ queryKey: ['audit-trail'] })
      qc.invalidateQueries({ queryKey: ['incidents'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })
}

export function useUnblockIp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ip, reason}) => api.unblockIp(ip, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-ips'] })
      qc.invalidateQueries({ queryKey: ['audit-trail'] })
    },
  })
}

export function useDiagnostic() {
  return useQuery({
    queryKey: ['diagnostic'],
    queryFn: () => api.getDiagnostic(),
    staleTime: 10_000,
  })
}
