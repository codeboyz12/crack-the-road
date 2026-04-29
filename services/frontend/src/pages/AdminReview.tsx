import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminQueue, useAdminStats, Report } from '../hooks/useReports'

const API = import.meta.env.VITE_API_URL || ''

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

export default function AdminReview() {
  const { data: queue = [], isLoading } = useAdminQueue()
  const { data: stats } = useAdminStats()
  const qc = useQueryClient()
  const [note, setNote] = useState<Record<string, string>>({})

  async function review(id: string, action: 'approve' | 'reject') {
    await axios.patch(`/api/v1/reports/${id}/review`, { action, note: note[id] })
    qc.invalidateQueries({ queryKey: ['admin-queue'] })
    qc.invalidateQueries({ queryKey: ['admin-stats'] })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      <header style={{ background: '#1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #334155' }}>
        <Link to="/" style={{ color: '#94a3b8', fontSize: 14 }}>← แผนที่</Link>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Admin Review Queue</span>
      </header>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: 16, padding: '12px 24px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
          {(Object.entries(stats) as [string, number][])
            .filter(([k]) => k !== 'by_crack_type')
            .map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{k}</div>
              </div>
            ))}
        </div>
      )}

      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        {isLoading && <p style={{ color: '#94a3b8' }}>กำลังโหลด...</p>}
        {queue.length === 0 && !isLoading && (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: 48 }}>ไม่มีรายการรอ review</p>
        )}

        {queue.map((r: any) => (
          <div key={r.id} style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginBottom: 12, display: 'flex', gap: 16 }}>
            <img
              src={`${API}${r.image_path}`}
              alt="crack"
              style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
              onError={e => { (e.target as HTMLImageElement).src = '/placeholder.png' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{r.province} · {r.district}</span>
                {r.severity && (
                  <span style={{ background: SEVERITY_COLORS[r.severity] ?? '#64748b', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                    {r.severity}
                  </span>
                )}
                <span style={{ fontSize: 12, color: '#64748b' }}>{r.crack_type ?? 'ไม่ระบุ'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                {r.road_name} · confidence: {r.confidence ? (r.confidence * 100).toFixed(1) + '%' : '-'}
              </div>
              <input
                type="text"
                placeholder="หมายเหตุ (ไม่บังคับ)"
                value={note[r.id] ?? ''}
                onChange={e => setNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '4px 8px', color: '#e2e8f0', fontSize: 13, marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => review(r.id, 'approve')} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}>
                  ✓ อนุมัติ
                </button>
                <button onClick={() => review(r.id, 'reject')} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}>
                  ✗ ปฏิเสธ
                </button>
                <Link to={`/reports/${r.id}`} style={{ fontSize: 13, color: '#3b82f6', padding: '6px 0' }}>ดูรายละเอียด →</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
