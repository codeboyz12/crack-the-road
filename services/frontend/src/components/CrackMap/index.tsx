import { useEffect, useRef } from 'react'
import L, { LatLngBoundsExpression, LatLngExpression } from 'leaflet'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { makeMarkerIcon, buildPopupHtml, type MarkerFeature } from './ReportMarker'

const THAILAND_BOUNDS: LatLngBoundsExpression = [[5.5, 97.5], [20.5, 105.7]]
const THAILAND_CENTER: LatLngExpression = [13.7563, 100.5018]

interface Props {
  geojson: { features: MarkerFeature[] } | null
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
      const marker = L.marker([lat, lng], { icon: makeMarkerIcon(p.severity) })
      marker.bindPopup(buildPopupHtml(p))
      layerRef.current!.addLayer(marker)
    })
  }, [geojson])

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />
}
