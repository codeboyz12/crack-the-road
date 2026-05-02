import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminQueue, useAdminStats, type Report } from '../hooks/useReports'

const PAGE_SIZE = 20

const SEVERITY_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

const CRACK_LABEL: Record<string, string> = {
  alligator_crack:               'Alligator Crack (ผิวแตกลายจระเข้)',
  deep_foundation_consolidation: 'Deep Foundation Consolidation (ทรุดตัวในดินลึก)',
  pot_hole:                      'Pot Hole (หลุมบ่อ)',
  reflection_crack:              'Reflection Crack (รอยแตกสะท้อน)',
  none:                          'ไม่พบความเสียหาย',
}

function AIPredictionPanel({ report }: { report: Report }) {
  const ai = report.ai_detection

  if (!ai) {
    return (
      <div style={{ width: 180, flexShrink: 0, background: '#0f172a', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>AI Prediction</div>
        <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>กำลังประมวลผล...</div>
      </div>
    )
  }

  const conf = ai.confidence
  const confPct = (conf * 100).toFixed(1)
  const barColor = conf >= 0.75 ? '#22c55e' : conf >= 0.5 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ width: 180, flexShrink: 0, background: '#0f172a', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>AI Prediction</span>
        <span style={{ color: '#475569' }}>{ai.model_name ?? ''}</span>
      </div>

      {/* Crack type */}
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
        {CRACK_LABEL[ai.crack_type ?? ''] ?? ai.crack_type ?? '-'}
      </div>

      {/* Severity badge */}
      {ai.severity && (
        <span style={{
          display: 'inline-block',
          background: SEVERITY_COLOR[ai.severity] ?? '#64748b',
          color: '#fff',
          padding: '2px 10px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 10,
          textTransform: 'uppercase',
        }}>
          {ai.severity}
        </span>
      )}

      {/* Confidence bar */}
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        Confidence: {confPct}%
      </div>
      <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${conf * 100}%`, height: '100%', background: barColor }} />
      </div>

      {/* Detection count */}
      {ai.detections && ai.detections.length > 0 && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
          {ai.detections.length} detection{ai.detections.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default function AdminReview() {
  const [page, setPage] = useState(1)
  const [note, setNote] = useState<Record<string, string>>({})
  const qc              = useQueryClient()

  const { data, isLoading } = useAdminQueue(page, PAGE_SIZE)
  const { data: stats }     = useAdminStats()

  const items    = data?.items ?? []
  const total    = data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function review(id: string, action: 'approve' | 'reject') {
    await axios.patch(`/api/v1/reports/${id}/review`, { action, note: note[id] })
    qc.invalidateQueries({ queryKey: ['admin-queue'] })
    qc.invalidateQueries({ queryKey: ['admin-stats'] })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>

      {/* Header */}
      <header style={{ background: '#1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #334155' }}>
        <Link to="/" style={{ color: '#94a3b8', fontSize: 14 }}>← แผนที่</Link>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Admin Review Queue</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
          รายการทั้งหมด {total.toLocaleString()} รายการ
        </span>
      </header>

      {/* Stats bar */}
      {stats && (
        <div style={{ display: 'flex', gap: 24, padding: '10px 24px', background: '#1e293b', borderBottom: '1px solid #334155', overflowX: 'auto' }}>
          {(Object.entries(stats) as [string, number][])
            .filter(([k]) => k !== 'by_crack_type')
            .map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{k.replace('_', ' ')}</div>
              </div>
            ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '20px 24px', maxWidth: 1000, margin: '0 auto' }}>

        {isLoading && (
          <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 48 }}>กำลังโหลด...</p>
        )}

        {!isLoading && items.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: 48 }}>ไม่มีรายการรอ review</p>
        )}

        {items.map((r: Report) => (
          <div key={r.id} style={{ background: '#1e293b', borderRadius: 10, marginBottom: 12, overflow: 'hidden', display: 'flex' }}>

            {/* Image */}
            <div style={{ width: 160, flexShrink: 0 }}>
              <img
                src={r.image_path}
                alt="crack"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 130 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: '14px 16px', display: 'flex', gap: 16 }}>

              {/* Location + actions */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  {r.province ?? '-'}{r.district ? ` · ${r.district}` : ''}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                  {r.road_name ?? '-'} · {new Date(r.reported_at).toLocaleDateString('th-TH')}
                </div>

                <input
                  type="text"
                  placeholder="หมายเหตุ (ไม่บังคับ)"
                  value={note[r.id] ?? ''}
                  onChange={e => setNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => review(r.id, 'approve')}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
                  >
                    ✓ อนุมัติ
                  </button>
                  <button
                    onClick={() => review(r.id, 'reject')}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', cursor: 'pointer', fontSize: 13 }}
                  >
                    ✗ ปฏิเสธ
                  </button>
                  <Link to={`/reports/${r.id}`} style={{ fontSize: 13, color: '#3b82f6' }}>ดูรายละเอียด →</Link>
                </div>
              </div>

              {/* AI Prediction panel */}
              <AIPredictionPanel report={r} />

            </div>
          </div>
        ))}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ background: page === 1 ? '#1e293b' : '#334155', color: page === 1 ? '#475569' : '#e2e8f0', border: 'none', borderRadius: 6, padding: '7px 18px', cursor: page === 1 ? 'default' : 'pointer', fontSize: 13 }}
            >
              ← ก่อนหน้า
            </button>

            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              หน้า {page} / {lastPage}
            </span>

            <button
              onClick={() => setPage(p => Math.min(lastPage, p + 1))}
              disabled={page === lastPage}
              style={{ background: page === lastPage ? '#1e293b' : '#334155', color: page === lastPage ? '#475569' : '#e2e8f0', border: 'none', borderRadius: 6, padding: '7px 18px', cursor: page === lastPage ? 'default' : 'pointer', fontSize: 13 }}
            >
              ถัดไป →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
