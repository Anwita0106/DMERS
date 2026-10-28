import { useEffect, type ReactNode } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../contexts/AppContext';

export interface MapPoint {
  key: string; lat: number; lng: number; color: string; pulse?: boolean; shape?: 'dot' | 'square' | 'home';
  popup?: ReactNode; onClick?: () => void; radiusKm?: number;
}

const iconCache = new Map<string, L.DivIcon>();
function icon(color: string, pulse?: boolean, shape: MapPoint['shape'] = 'dot') {
  const k = `${color}|${pulse}|${shape}`;
  if (!iconCache.has(k)) {
    const radius = shape === 'square' ? '4px' : '9999px';
    const inner = shape === 'home'
      ? `<span style="background:${color};border-radius:6px;display:grid;place-items:center"><svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 3 2 12h3v9h6v-6h2v6h6v-9h3z"/></svg></span>`
      : `<span style="background:${color};border-radius:${radius}"></span>`;
    iconCache.set(k, L.divIcon({
      className: '', iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10],
      html: `<div class="pin">${pulse ? `<i style="background:${color}55"></i>` : ''}${inner}</div>`,
    }));
  }
  return iconCache.get(k)!;
}

function FitBounds({ points, fitKey }: { points: MapPoint[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 13, { animate: false }); return; }
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30], maxZoom: 13, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

function FlyTo({ target }: { target?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo(target, 14, { duration: 0.6 }); }, [target, map]);
  return null;
}

export default function MapView({ points, height = 360, center = [12.93, 79.13], zoom = 10, flyTo, className = '', fitKey, emptyText = 'Nothing with map coordinates to show' }: {
  points: MapPoint[]; height?: number | string; center?: LatLngExpression; zoom?: number;
  flyTo?: [number, number] | null; className?: string; fitKey?: string; emptyText?: string;
}) {
  // OpenStreetMap standard tiles: no API key needed (the CARTO basemaps now require one and
  // showed "API KEY REQUIRED"). Dark mode darkens the same tiles with a CSS filter (index.css).
  const { theme } = useTheme();
  return (
    <div className={`relative overflow-hidden rounded-xl border border-line ${theme === 'dark' ? 'map-dark' : ''} ${className}`} style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {points.filter((p) => p.radiusKm).map((p) => (
          <Circle key={`c-${p.key}`} center={[p.lat, p.lng]} radius={(p.radiusKm ?? 1) * 1000}
            pathOptions={{ color: p.color, weight: 1, opacity: 0.5, fillOpacity: 0.07 }} />
        ))}
        {points.map((p) => (
          <Marker key={p.key} position={[p.lat, p.lng]} icon={icon(p.color, p.pulse, p.shape)}
            eventHandlers={p.onClick ? { click: p.onClick } : undefined}>
            {p.popup && <Popup>{p.popup}</Popup>}
          </Marker>
        ))}
        <FitBounds points={points} fitKey={fitKey ?? String(points.length)} />
        <FlyTo target={flyTo} />
      </MapContainer>
      {points.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] mx-auto w-fit rounded-full bg-black/70 px-3 py-1.5 text-xs text-white">
          {emptyText}
        </div>
      )}
    </div>
  );
}
