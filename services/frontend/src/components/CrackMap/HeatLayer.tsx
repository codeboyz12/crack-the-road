import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.heat'

interface HeatPoint {
  lat: number
  lng: number
  intensity?: number
}

interface Props {
  map: L.Map | null
  points: HeatPoint[]
  radius?: number
  blur?: number
  maxZoom?: number
}

export default function HeatLayer({ map, points, radius = 25, blur = 15, maxZoom = 17 }: Props) {
  const layerRef = useRef<L.HeatLayer | null>(null)

  useEffect(() => {
    if (!map) return

    if (!layerRef.current) {
      layerRef.current = (L as any).heatLayer([], { radius, blur, maxZoom })
      layerRef.current!.addTo(map)
    }

    const data = points.map(p => [p.lat, p.lng, p.intensity ?? 1.0] as [number, number, number])
    layerRef.current!.setLatLngs(data)

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, points, radius, blur, maxZoom])

  return null
}
