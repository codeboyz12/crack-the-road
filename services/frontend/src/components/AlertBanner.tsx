interface AlertEvent {
  id: string
  province: string
  report_count: number
  triggered_at: string
  notified: boolean
}

interface Props {
  events: AlertEvent[]
  maxVisible?: number
}

const LEVEL_STYLE = (count: number) => {
  if (count > 20) return { background: '#7c3aed', label: 'Emergency' }
  if (count > 10) return { background: '#dc2626', label: 'Critical' }
  if (count > 5)  return { background: '#ea580c', label: 'Warning' }
  return { background: '#ca8a04', label: 'Watch' }
}

export default function AlertBanner({ events, maxVisible = 3 }: Props) {
  if (events.length === 0) return null

  const visible = events.slice(0, maxVisible)
  const overflow = events.length - maxVisible

  return (
    <div style={{
      background: LEVEL_STYLE(Math.max(...events.map(e => e.report_count))).background,
      padding: '8px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
        🔔 แจ้งเตือน
      </span>
      <span style={{ fontSize: 13 }}>
        {visible.map(e => `${e.province} (${e.report_count} รายงาน)`).join(' · ')}
        {overflow > 0 && ` · และอีก ${overflow} พื้นที่`}
      </span>
    </div>
  )
}
