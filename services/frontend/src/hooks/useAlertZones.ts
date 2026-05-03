import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export interface AlertZone {
  id: string
  name: string
  threshold: number
  window_hours: number
  severity: string
  notify_channels: string[]
  is_active: boolean
}

export interface AlertZoneCreate {
  name: string
  threshold: number
  window_hours: number
  severity: string
  notify_channels: string[]
}

export function useAlertZones() {
  return useQuery({
    queryKey: ['alert-zones'],
    queryFn: async () => {
      const { data } = await axios.get('/api/v1/alerts/zones')
      return data as AlertZone[]
    },
    refetchInterval: 30_000,
  })
}

export function useCreateAlertZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: AlertZoneCreate) => {
      const { data } = await axios.post('/api/v1/alerts/zones', body)
      return data as AlertZone
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-zones'] }),
  })
}

export function useUpdateAlertZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<AlertZone> & { id: string }) => {
      const { data } = await axios.patch(`/api/v1/alerts/zones/${id}`, body)
      return data as AlertZone
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-zones'] }),
  })
}

export function useDeleteAlertZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/v1/alerts/zones/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-zones'] }),
  })
}
