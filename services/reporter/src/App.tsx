import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Step = 'locating' | 'location_error' | 'ready' | 'uploading' | 'success' | 'error'

interface Loc { lat: number; lng: number; accuracy: number }

export default function App() {
  const [step, setStep]               = useState<Step>('locating')
  const [loc, setLoc]                 = useState<Loc | null>(null)
  const [locError, setLocError]       = useState('')
  const [imageFile, setImageFile]     = useState<File | null>(null)
  const [preview, setPreview]         = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [reportId, setReportId]       = useState<string | null>(null)

  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const mapRef    = useRef<L.Map | null>(null)

  // Auto-request location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง')
      setStep('location_error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
        setStep('ready')
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาเปิดสิทธิ์ Location ในเบราว์เซอร์'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบ GPS'
            : 'เกิดข้อผิดพลาดในการระบุตำแหน่ง'
        )
        setStep('location_error')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [])

  // Init Leaflet mini-map when location is ready
  useEffect(() => {
    if (step !== 'ready' || !loc || !mapDivRef.current || mapRef.current) return

    const map = L.map(mapDivRef.current, { zoomControl: false, attributionControl: false })
      .setView([loc.lat, loc.lng], 16)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

    const icon = L.divIcon({
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#ef4444;border:3px solid #fff;
        box-shadow:0 0 0 2px #ef4444,0 2px 8px rgba(0,0,0,.5)
      "></div>`,
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })

    L.marker([loc.lat, loc.lng], { icon }).addTo(map)
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [step, loc])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!loc || !imageFile) return
    setStep('uploading')
    setSubmitError('')

    const form = new FormData()
    form.append('lat', String(loc.lat))
    form.append('lng', String(loc.lng))
    form.append('source', 'mobile')
    form.append('image', imageFile)

    try {
      const res = await fetch('/api/v1/reports', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setReportId(data.id)
      setStep('success')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่')
      setStep('error')
    }
  }

  function resetForm() {
    setImageFile(null)
    setPreview(null)
    setDescription('')
    setSubmitError('')
    setReportId(null)
    setStep('ready')
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#1e293b', padding: '14px 20px', borderBottom: '1px solid #334155', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>🛣️ แจ้งรอยร้าวถนน</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Road Crack Monitor · Reporter Portal</div>
      </header>

      <main style={{ maxWidth: 500, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* ── LOCATING ─────────────────────────────────────── */}
        {step === 'locating' && (
          <Center>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📍</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>กำลังระบุตำแหน่ง...</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>กรุณาอนุญาตให้เข้าถึง Location ของอุปกรณ์</div>
            <Spinner />
          </Center>
        )}

        {/* ── LOCATION ERROR ───────────────────────────────── */}
        {step === 'location_error' && (
          <Center>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🚫</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>ไม่สามารถระบุตำแหน่งได้</div>
            <div style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>{locError}</div>
            <button onClick={() => window.location.reload()} style={primaryBtn()}>ลองใหม่อีกครั้ง</button>
          </Center>
        )}

        {/* ── MAIN FORM ────────────────────────────────────── */}
        {(step === 'ready' || step === 'uploading') && loc && (
          <>
            {/* Location card */}
            <Card>
              <Label>
                <Dot color="#22c55e" />
                ตำแหน่งปัจจุบัน · ความแม่นยำ ±{Math.round(loc.accuracy)} เมตร
              </Label>
              <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 12 }}>
                {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
              </div>
              {/* Mini map */}
              <div ref={mapDivRef} style={{ height: 180, borderRadius: 8, overflow: 'hidden', background: '#0f172a' }} />
            </Card>

            {/* Image upload */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>รูปภาพรอยร้าว *</div>
              {preview ? (
                <div style={{ position: 'relative' }}>
                  <img src={preview} alt="preview" style={{ width: '100%', borderRadius: 8, maxHeight: 260, objectFit: 'cover', display: 'block' }} />
                  <button
                    onClick={() => { setImageFile(null); setPreview(null) }}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(15,23,42,.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: '#0f172a', border: '2px dashed #334155', borderRadius: 10, padding: '36px 16px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 44 }}>📷</span>
                  <span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>แตะเพื่อถ่ายภาพหรือเลือกรูป</span>
                  <span style={{ fontSize: 11, color: '#475569' }}>JPEG / PNG / WebP · ไม่เกิน 10 MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
            </Card>

            {/* Description */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>รายละเอียดเพิ่มเติม <span style={{ fontWeight: 400, color: '#64748b' }}>(ไม่บังคับ)</span></div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="เช่น รอยร้าวข้ามช่องจราจร, หลุมลึกประมาณ 10 ซม., อยู่หน้าปากซอย..."
                rows={3}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, resize: 'none', outline: 'none' }}
              />
            </Card>

            <button
              onClick={handleSubmit}
              disabled={!imageFile || step === 'uploading'}
              style={primaryBtn(!imageFile || step === 'uploading')}
            >
              {step === 'uploading' ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <Spinner small /> กำลังส่ง...
                </span>
              ) : 'ส่งรายงาน'}
            </button>
          </>
        )}

        {/* ── SUCCESS ──────────────────────────────────────── */}
        {step === 'success' && (
          <Center>
            <div style={{ fontSize: 72, marginBottom: 16, animation: 'fadeIn 0.4s ease' }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>ส่งรายงานสำเร็จ!</div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 6 }}>ขอบคุณที่ช่วยรายงานปัญหาถนน</div>
            {reportId && (
              <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', background: '#1e293b', borderRadius: 6, padding: '6px 12px', marginBottom: 20 }}>
                Report ID: {reportId}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7, marginBottom: 32, textAlign: 'center' }}>
              รายงานของคุณจะถูกตรวจสอบโดย AI<br />และผู้เชี่ยวชาญก่อนเผยแพร่บนแผนที่
            </div>
            <button onClick={resetForm} style={primaryBtn()}>ส่งรายงานเพิ่มเติม</button>
          </Center>
        )}

        {/* ── ERROR ────────────────────────────────────────── */}
        {step === 'error' && (
          <Center>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>ส่งไม่สำเร็จ</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, textAlign: 'center' }}>{submitError}</div>
            <button onClick={() => setStep('ready')} style={primaryBtn()}>ลองใหม่</button>
          </Center>
        )}

      </main>
    </div>
  )
}

// ── Small components ──────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 }}>
      {children}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60 }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </div>
  )
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
}

function Spinner({ small }: { small?: boolean }) {
  const size = small ? 16 : 32
  return (
    <div style={{ width: size, height: size, border: `${small ? 2 : 3}px solid #334155`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
  )
}

function primaryBtn(disabled = false): React.CSSProperties {
  return {
    width: '100%',
    background: disabled ? '#1e293b' : '#16a34a',
    color: disabled ? '#475569' : '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '15px 24px',
    fontSize: 15,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
  }
}
