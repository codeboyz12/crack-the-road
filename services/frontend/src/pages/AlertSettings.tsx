import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useAlertZones,
  useCreateAlertZone,
  useUpdateAlertZone,
  useDeleteAlertZone,
  type AlertZone,
} from '../hooks/useAlertZones'

const SEVERITY_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#7c3aed',
}

const CHANNEL_LABELS: Record<string, string> = {
  line: 'LINE Notify',
  email: 'Email',
  webhook: 'Webhook',
}

const ALL_CHANNELS = ['line', 'email', 'webhook']

const DEFAULT_FORM = {
  name: '',
  threshold: 5,
  window_hours: 24,
  severity: 'medium',
  notify_channels: ['line'] as string[],
}

export default function AlertSettings() {
  const { data: zones = [], isLoading } = useAlertZones()
  const createMutation = useCreateAlertZone()
  const updateMutation = useUpdateAlertZone()
  const deleteMutation = useDeleteAlertZone()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setForm(DEFAULT_FORM)
    setEditId(null)
    setShowForm(true)
    setError(null)
  }

  function openEdit(z: AlertZone) {
    setForm({
      name: z.name,
      threshold: z.threshold,
      window_hours: z.window_hours,
      severity: z.severity,
      notify_channels: z.notify_channels,
    })
    setEditId(z.id)
    setShowForm(true)
    setError(null)
  }

  function toggleChannel(ch: string) {
    setForm(prev => ({
      ...prev,
      notify_channels: prev.notify_channels.includes(ch)
        ? prev.notify_channels.filter(c => c !== ch)
        : [...prev.notify_channels, ch],
    }))
  }

  async function submit() {
    if (!form.name.trim()) { setError('กรุณาระบุชื่อ Alert Zone'); return }
    if (form.notify_channels.length === 0) { setError('เลือก Notify Channel อย่างน้อย 1 ช่องทาง'); return }
    setError(null)
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, ...form })
      } else {
        await createMutation.mutateAsync(form)
      }
      setShowForm(false)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  async function toggleActive(z: AlertZone) {
    await updateMutation.mutateAsync({ id: z.id, is_active: !z.is_active })
  }

  async function remove(z: AlertZone) {
    if (!confirm(`ลบ "${z.name}" ?`)) return
    await deleteMutation.mutateAsync(z.id)
  }

  const input = (style?: React.CSSProperties): React.CSSProperties => ({
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 4,
    padding: '6px 10px',
    color: '#e2e8f0',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
    ...style,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>

      {/* Header */}
      <header style={{ background: '#1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #334155' }}>
        <Link to="/" style={{ color: '#94a3b8', fontSize: 14 }}>← แผนที่</Link>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Alert Settings</span>
        <button
          onClick={openCreate}
          style={{ marginLeft: 'auto', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          + เพิ่ม Alert Zone
        </button>
      </header>

      <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>

        {/* Create / Edit form */}
        {showForm && (
          <div style={{ background: '#1e293b', borderRadius: 10, padding: 20, marginBottom: 24, border: '1px solid #334155' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {editId ? 'แก้ไข Alert Zone' : 'สร้าง Alert Zone ใหม่'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>ชื่อ Zone *</label>
                <input
                  style={input()}
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="เช่น กรุงเทพมหานคร, ทางหลวงหมายเลข 1"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>ระดับความรุนแรง</label>
                <select
                  style={input()}
                  value={form.severity}
                  onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
                >
                  {['low', 'medium', 'high', 'critical'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  จำนวน Reports ที่ trigger ({form.threshold} รายงาน)
                </label>
                <input
                  type="range" min={1} max={50} step={1}
                  value={form.threshold}
                  onChange={e => setForm(p => ({ ...p, threshold: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  ช่วงเวลา ({form.window_hours} ชั่วโมง)
                </label>
                <input
                  type="range" min={1} max={168} step={1}
                  value={form.window_hours}
                  onChange={e => setForm(p => ({ ...p, window_hours: Number(e.target.value) }))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Notify Channels *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {ALL_CHANNELS.map(ch => (
                  <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.notify_channels.includes(ch)}
                      onChange={() => toggleChannel(ch)}
                    />
                    {CHANNEL_LABELS[ch]}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={submit}
                disabled={createMutation.isPending || updateMutation.isPending}
                style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 20px', cursor: 'pointer', fontSize: 13 }}
              >
                {editId ? 'บันทึก' : 'สร้าง'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 6, padding: '7px 20px', cursor: 'pointer', fontSize: 13 }}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: '#64748b' }}>
          <b style={{ color: '#94a3b8' }}>Alert Levels: </b>
          <span style={{ color: '#ca8a04' }}>🟡 Watch (3–5)</span> &nbsp;·&nbsp;
          <span style={{ color: '#ea580c' }}>🟠 Warning (6–10)</span> &nbsp;·&nbsp;
          <span style={{ color: '#dc2626' }}>🔴 Critical (&gt;10)</span> &nbsp;·&nbsp;
          <span style={{ color: '#7c3aed' }}>🟣 Emergency (&gt;20 / 6h)</span>
        </div>

        {isLoading && <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 48 }}>กำลังโหลด...</p>}

        {!isLoading && zones.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: 48 }}>
            ยังไม่มี Alert Zone — คลิก "เพิ่ม Alert Zone" เพื่อสร้าง
          </p>
        )}

        {zones.map(z => (
          <div
            key={z.id}
            style={{
              background: '#1e293b',
              borderRadius: 10,
              padding: '16px 20px',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              opacity: z.is_active ? 1 : 0.5,
              borderLeft: `4px solid ${SEVERITY_COLOR[z.severity] ?? '#64748b'}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{z.name}</span>
                <span style={{
                  background: SEVERITY_COLOR[z.severity] ?? '#64748b',
                  color: '#fff',
                  padding: '1px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  textTransform: 'uppercase',
                }}>
                  {z.severity}
                </span>
                {!z.is_active && (
                  <span style={{ background: '#374151', color: '#9ca3af', padding: '1px 8px', borderRadius: 4, fontSize: 11 }}>
                    ปิดใช้งาน
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>Threshold: <b style={{ color: '#94a3b8' }}>{z.threshold} รายงาน</b></span>
                <span>ช่วงเวลา: <b style={{ color: '#94a3b8' }}>{z.window_hours} ชั่วโมง</b></span>
                <span>แจ้งผ่าน: <b style={{ color: '#94a3b8' }}>{z.notify_channels.map(c => CHANNEL_LABELS[c] ?? c).join(', ')}</b></span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => toggleActive(z)}
                title={z.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                style={{ background: z.is_active ? '#374151' : '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
              >
                {z.is_active ? 'ปิด' : 'เปิด'}
              </button>
              <button
                onClick={() => openEdit(z)}
                style={{ background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
              >
                แก้ไข
              </button>
              <button
                onClick={() => remove(z)}
                style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
              >
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
