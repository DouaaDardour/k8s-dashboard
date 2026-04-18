import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client.js'

export function useSystemMetrics() {
  return useQuery({
    queryKey: ['systemMetrics'],
    queryFn: api.getSystemMetrics,
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 15000,
  })
}

export function useClusterHealth() {
  return useQuery({
    queryKey: ['clusterHealth'],
    queryFn: api.getClusterHealth,
    refetchInterval: 30000,
    staleTime: 15000,
  })
}

export function useClusterReliability() {
  return useQuery({
    queryKey: ['clusterReliability'],
    queryFn: api.getClusterReliability,
    refetchInterval: 60000, // Refresh every 60s
    staleTime: 30000,
  })
}

export function usePodMetrics() {
  return useQuery({
    queryKey: ['podMetrics'],
    queryFn: api.getPodMetrics,
    refetchInterval: 30000,
    staleTime: 15000,
  })
}

export function useMetricsHistory(hours = 24) {
  return useQuery({
    queryKey: ['metricsHistory', hours],
    queryFn: () => api.getMetricsHistory(hours),
    refetchInterval: 60000,
    staleTime: 30000,
  })
}
