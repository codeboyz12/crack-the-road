import { useEffect, useRef } from 'react'
import L, { LatLngBoundsExpression, LatLngExpression } from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

const THAILAND_BOUNDS: LatLngBoundsExpression = [[5.5, 97.5], [20.5, 105.7]]
const THAILAND_CENTER: LatLngExpression = [13.7563, 100.5018]

const SEVERITY_COLORS: Record<string, string> = {
  low:      '#22c55e',
  medium:   '#f59e0b',
  high:     '#ef4444',
  critical: '#7c3aed',
}

function makeIcon(severity: string | null) {
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

interface Feature {
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

interface Props {
  geojson: { features: Feature[] } | null
}

export default function CrackMap({ geojson }: Props) {
  const mapRef    = useRef<L.Map | null>(null)
  const layerRef  = useRef<L.MarkerClusterGroup | null>(null)
  const divRef    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mapRef.current || !divRef.current) return
    mapRef.current = L.map(divRef.current, {
      center: THAILAND_CENTER,
      zoom: 6,
      maxBounds: THAILAND_BOUNDS,
      maxBoundsViscosity: 0.8,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current)

    layerRef.current = (L as any).markerClusterGroup()
    mapRef.current.addLayer(layerRef.current)
  }, [])

  useEffect(() => {
    if (!layerRef.current || !geojson) return
    layerRef.current.clearLayers()

    geojson.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates
      const p = f.properties
      const marker = L.marker([lat, lng], { icon: makeIcon(p.severity) })
      marker.bindPopup(`
        <div style="min-width:180px">
          <b>${p.crack_type ?? 'Unknown'}</b>
          <span style="background:${SEVERITY_COLORS[p.severity ?? 'low']};color:#fff;padding:2px 6px;border-radius:4px;font-size:12px;margin-left:6px">${p.severity ?? '-'}</span>
          <div style="margin-top:6px;font-size:12px;color:#555">
            ${p.province ?? ''} · ${p.status}
            ${p.confidence ? `<br>Confidence: ${(p.confidence * 100).toFixed(1)}%` : ''}
          </div>
          <a href="/reports/${p.id}" style="display:block;margin-top:8px;color:#3b82f6;font-size:12px">ดูรายละเอียด →</a>
        </div>
      `)
      layerRef.current!.addLayer(marker)
    })
  }, [geojson])

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />
}
