interface AIDetection {
  crack_type: string | null
  severity: string | null
  confidence: number
  detections: unknown[] | null
  model_name: string | null
  model_version: string | null
  inference_ms: number | null
  processed_at: string
}

const SEVERITY_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

const CRACK_LABEL: Record<string, string> = {
  alligator_crack:               'Alligator Crack (ผิวแตกลายจระเข้)',
  deep_foundation_consolidation: 'Deep Foundation Consolidation (ทรุดตัวในดินลึก)',
  pot_hole:                      'Pot Hole (หลุมบ่อ)',
  reflection_crack:              'Reflection Crack (รอยแตกสะท้อน)',
  longitudinal:                  'Longitudinal Crack (รอยแตกตามยาว)',
  transverse:                    'Transverse Crack (รอยแตกขวาง)',
  alligator:                     'Alligator Crack (ตาข่ายจระเข้)',
  pothole:                       'Pot Hole (หลุมบ่อ)',
  edge_crack:                    'Edge Crack (รอยแตกขอบ)',
  block_crack:                   'Block Crack (รอยแตกบล็อก)',
  depression:                    'Depression (ผิวยุบตัว)',
  none:                          'ไม่พบความเสียหาย',
}

interface Props {
  detection: AIDetection | null
  compact?: boolean
}

export default function AIResultCard({ detection, compact = false }: Props) {
  if (!detection) {
    return (
      <div style={{ background: '#0f172a', borderRadius: 8, padding: compact ? 10 : 14 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>AI Prediction</div>
        <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>กำลังประมวลผล...</div>
      </div>
    )
  }

  const confPct = (detection.confidence * 100).toFixed(1)
  const barColor =
    detection.confidence >= 0.75 ? '#22c55e' :
    detection.confidence >= 0.5  ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: compact ? 10 : 14 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>AI Prediction</span>
        {detection.model_name && <span style={{ color: '#334155' }}>{detection.model_name}</span>}
      </div>

      <div style={{ fontSize: compact ? 12 : 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>
        {CRACK_LABEL[detection.crack_type ?? ''] ?? detection.crack_type ?? '-'}
      </div>

      {detection.severity && (
        <span style={{
          display: 'inline-block',
          background: SEVERITY_COLOR[detection.severity] ?? '#64748b',
          color: '#fff',
          padding: '2px 10px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 10,
          textTransform: 'uppercase',
        }}>
          {detection.severity}
        </span>
      )}

      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        Confidence: {confPct}%
      </div>
      <div style={{ background: '#1e293b', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${detection.confidence * 100}%`, height: '100%', background: barColor }} />
      </div>

      {!compact && (
        <div style={{ fontSize: 11, color: '#475569' }}>
          {detection.detections && detection.detections.length > 0 && (
            <span>{detection.detections.length} detection{detection.detections.length > 1 ? 's' : ''} · </span>
          )}
          {detection.inference_ms != null && <span>{detection.inference_ms}ms</span>}
        </div>
      )}
    </div>
  )
}
