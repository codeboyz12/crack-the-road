import L from 'leaflet'

const SEVERITY_COLORS: Record<string, string> = {
  low:      '#22c55e',
  medium:   '#f59e0b',
  high:     '#ef4444',
  critical: '#7c3aed',
}

export interface MarkerFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    id: string
    status: string
    province: string | null
    crack_type: string | null
    severity: string | null
    confidence: number | null
  }
}

export function makeMarkerIcon(severity: string | null): L.Icon {
  const color = SEVERITY_COLORS[severity ?? 'low'] ?? '#64748b'
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
    </svg>`
  )
  return L.icon({
    iconUrl: `data:image/svg+xml,${svg}`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

export function buildPopupHtml(p: MarkerFeature['properties']): string {
  const color = SEVERITY_COLORS[p.severity ?? 'low'] ?? '#64748b'
  return `
    <div style="min-width:180px">
      <b>${p.crack_type ?? 'Unknown'}</b>
      <span style="background:${color};color:#fff;padding:2px 6px;border-radius:4px;font-size:12px;margin-left:6px">
        ${p.severity ?? '-'}
      </span>
      <div style="margin-top:6px;font-size:12px;color:#555">
        ${p.province ?? ''} · ${p.status}
        ${p.confidence ? `<br>Confidence: ${(p.confidence * 100).toFixed(1)}%` : ''}
      </div>
      <a href="/reports/${p.id}" style="display:block;margin-top:8px;color:#3b82f6;font-size:12px">
        ดูรายละเอียด →
      </a>
    </div>
  `
}
