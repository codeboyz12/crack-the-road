import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { MOCK_ADMIN_QUEUE, MOCK_ADMIN_STATS } from '../mockData'

export interface AIDetection {
  crack_type: string | null
  severity: string | null
  confidence: number
  detections: unknown[]
  model_name: string | null
  processed_at: string
}

export interface Report {
  id: string
  lat: number
  lng: number
  address: string | null
  province: string | null
  district: string | null
  road_name: string | null
  status: string
  source: string
  image_path: string
  reported_at: string
  reviewed_at: string | null
  review_note: string | null
  ai_detection: AIDetection | null
}

export function useReports(params?: { status?: string; province?: string; page?: number }) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: async () => {
      const { data } = await axios.get('/api/v1/reports', { params })
      return data as { items: Report[]; total: number; page: number; page_size: number }
    },
    refetchInterval: 30_000,
  })
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const { data } = await axios.get(`/api/v1/reports/${id}`)
      return data as Report
    },
  })
}

export function useClusterData() {
  return useQuery({
    queryKey: ['clusters'],
    queryFn: async () => {
      const { data } = await axios.get('/api/v1/map/clusters')
      return data
    },
    refetchInterval: 60_000,
  })
}

export function useAdminQueue() {
  return useQuery({
    queryKey: ['admin-queue'],
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/v1/admin/queue')
        return data as Report[]
      } catch {
        return MOCK_ADMIN_QUEUE as unknown as Report[]
      }
    },
    refetchInterval: 15_000,
  })
}

export interface AdminStats {
  total: number
  pending: number
  ai_processed: number
  under_review: number
  verified: number
  rejected: number
  resolved: number
  by_crack_type: Record<string, number>
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/v1/admin/stats')
        return data as AdminStats
      } catch {
        return MOCK_ADMIN_STATS as AdminStats
      }
    },
    refetchInterval: 30_000,
  })
}
