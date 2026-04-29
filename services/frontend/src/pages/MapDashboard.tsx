import { Link } from 'react-router-dom'
import CrackMap from '../components/CrackMap'
import { useClusterData, useAdminStats } from '../hooks/useReports'
import { useAlertEvents } from '../hooks/useAlerts'

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

const CRACK_TYPE_LABELS: Record<string, string> = {
  longitudinal: 'รอยแตกตามยาว',
  transverse:   'รอยแตกขวาง',
  alligator:    'ผิวหนังจระเข้',
  pothole:      'หลุมบ่อ',
  edge_crack:   'รอยแตกขอบ',
  block_crack:  'รอยแตกบล็อก',
  depression:   'ผิวถนนยุบ',
}

const CRACK_TYPE_ICONS: Record<string, string> = {
  longitudinal: '⟶',
  transverse:   '⟷',
  alligator:    '⬡',
  pothole:      '◎',
  edge_crack:   '⌐',
  block_crack:  '⊞',
  depression:   '▽',
}

export default function MapDashboard() {
  const { data: geojson, isLoading } = useClusterData()
  const { data: alerts } = useAlertEvents()
  const { data: stats } = useAdminStats()

  const recentAlerts = alerts?.slice(0, 3) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={{ background: '#1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #334155' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>🛣️ Road Crack Monitor</span>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <Link to="/" style={{ color: '#94a3b8', fontSize: 14 }}>แผนที่</Link>
          <Link to="/admin" style={{ color: '#94a3b8', fontSize: 14 }}>Admin Review</Link>
        </nav>
      </header>

      {/* Summary bar */}
      {stats && (
        <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          {/* Total */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1 }}>{stats.total.toLocaleString()}</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>รายงานทั้งหมด</span>
          </div>

          <div style={{ width: 1, height: 32, background: '#1e293b' }} />

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'รอตรวจ', value: stats.pending, color: '#64748b' },
              { label: 'AI แล้ว', value: stats.ai_processed, color: '#3b82f6' },
              { label: 'ยืนยัน', value: stats.verified, color: '#22c55e' },
              { label: 'ปฏิเสธ', value: stats.rejected, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1e293b', borderRadius: 6, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{s.value}</span>
              </div>
            ))}
          </div>

          <div style={{ width: 1, height: 32, background: '#1e293b' }} />

          {/* Crack type breakdown */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>ประเภทรอย</span>
            {Object.entries(stats.by_crack_type)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} title={CRACK_TYPE_LABELS[type] ?? type} style={{ background: '#1e293b', borderRadius: 6, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 13 }}>{CRACK_TYPE_ICONS[type] ?? '·'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{CRACK_TYPE_LABELS[type] ?? type}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Alert banner */}
      {recentAlerts.length > 0 && (
        <div style={{ background: '#7c3aed', padding: '8px 24px', fontSize: 13 }}>
          🔔 แจ้งเตือน: {recentAlerts.map(a => `${a.province} (${a.report_count} รายงาน)`).join(' · ')}
        </div>
      )}

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          {isLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', zIndex: 10 }}>
              <span style={{ color: '#94a3b8' }}>กำลังโหลดแผนที่...</span>
            </div>
          )}
          <CrackMap geojson={geojson ?? null} />
        </div>

        {/* Sidebar */}
        <aside style={{ width: 280, background: '#1e293b', borderLeft: '1px solid #334155', overflowY: 'auto', padding: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>สีระดับความรุนแรง</h2>
          {Object.entries(SEVERITY_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: v, display: 'inline-block' }} />
              <span style={{ fontSize: 13, textTransform: 'capitalize' }}>{k}</span>
            </div>
          ))}

          <hr style={{ borderColor: '#334155', margin: '16px 0' }} />

          <h2 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>แจ้งเตือนล่าสุด</h2>
          {recentAlerts.length === 0 && <p style={{ fontSize: 13, color: '#64748b' }}>ไม่มีการแจ้งเตือน</p>}
          {recentAlerts.map(a => (
            <div key={a.id} style={{ background: '#0f172a', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{a.province}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.report_count} รายงาน · {new Date(a.triggered_at).toLocaleString('th-TH')}</div>
            </div>
          ))}

          <hr style={{ borderColor: '#334155', margin: '16px 0' }} />

          <div style={{ fontSize: 12, color: '#475569' }}>
            จำนวน markers: {geojson?.features?.length ?? 0}
          </div>
        </aside>
      </div>
    </div>
  )
}
