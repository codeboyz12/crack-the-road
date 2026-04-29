import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function useAlertEvents() {
  return useQuery({
    queryKey: ['alert-events'],
    queryFn: async () => {
      const { data } = await axios.get('/api/v1/alerts/events')
      return data as Array<{
        id: string
        province: string
        report_count: number
        triggered_at: string
        notified: boolean
      }>
    },
    refetchInterval: 30_000,
  })
}
