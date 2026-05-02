import { useParams, Link } from 'react-router-dom'
import { useReport } from '../hooks/useReports'

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

const CRACK_LABEL: Record<string, string> = {
  alligator_crack:               'Alligator Crack (ผิวแตกลายจระเข้)',
  deep_foundation_consolidation: 'Deep Foundation Consolidation (ทรุดตัวในดินลึก)',
  pot_hole:                      'Pot Hole (หลุมบ่อ)',
  reflection_crack:              'Reflection Crack (รอยแตกสะท้อน)',
  none:                          'ไม่พบความเสียหาย',
}

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: report, isLoading } = useReport(id!)

  if (isLoading) return <div style={{ padding: 48, color: '#94a3b8' }}>กำลังโหลด...</div>
  if (!report) return <div style={{ padding: 48, color: '#ef4444' }}>ไม่พบรายงาน</div>

  const d = report.ai_detection

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link to="/" style={{ color: '#3b82f6', fontSize: 14 }}>← กลับแผนที่</Link>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 4px' }}>รายละเอียดรายงาน</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>ID: {report.id}</p>

        <img
          src={report.image_path}
          alt="crack"
          style={{ width: '100%', borderRadius: 8, marginBottom: 20, maxHeight: 400, objectFit: 'cover' }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <Info label="จังหวัด" value={report.province} />
          <Info label="อำเภอ" value={report.district} />
          <Info label="ถนน" value={report.road_name} />
          <Info label="ที่อยู่" value={report.address} />
          <Info label="พิกัด" value={`${report.lat}, ${report.lng}`} />
          <Info label="สถานะ" value={report.status} />
          <Info label="แหล่งที่มา" value={report.source} />
          <Info label="รายงานเมื่อ" value={new Date(report.reported_at).toLocaleString('th-TH')} />
        </div>

        {d && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>ผลการตรวจจับ AI</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 18 }}>{d.crack_type ? (CRACK_LABEL[d.crack_type] ?? d.crack_type) : '-'}</span>
              {d.severity && (
                <span style={{ background: SEVERITY_COLORS[d.severity], color: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 13 }}>
                  {d.severity}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Confidence:</span>
              <div style={{ flex: 1, background: '#334155', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${d.confidence * 100}%`, background: '#3b82f6', height: '100%' }} />
              </div>
              <span style={{ fontSize: 13 }}>{(d.confidence * 100).toFixed(1)}%</span>
            </div>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              Model: {d.model_name}{d.model_version ? ` v${d.model_version}` : ''}
              {d.inference_ms != null ? ` · ${d.inference_ms}ms` : ''}
              {' · '}{new Date(d.processed_at).toLocaleString('th-TH')}
            </p>
          </div>
        )}

        {report.review_note && (
          <div style={{ background: '#1e293b', borderRadius: 8, padding: 16, marginTop: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>หมายเหตุจาก Reviewer</h2>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>{report.review_note}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 6, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value ?? '-'}</div>
    </div>
  )
}
