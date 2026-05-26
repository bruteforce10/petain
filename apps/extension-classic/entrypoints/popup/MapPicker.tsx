import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default-icon path detection breaks in MV3 bundles. Set explicit URLs.
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

interface Props {
  lat: number;
  lng: number;
  radiusM: number;
  onPick: (lat: number, lng: number) => void;
}

function ClickHandler({ onPick }: { onPick: Props['onPick'] }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
  return null;
}

export default function MapPicker({ lat, lng, radiusM, onPick }: Props) {
  const [pos] = useState<[number, number]>([lat, lng]);
  return (
    <MapContainer center={pos} zoom={14} scrollWheelZoom>
      <TileLayer
        attribution='© OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} />
      <Circle center={[lat, lng]} radius={radiusM} pathOptions={{ color: '#2563eb', weight: 1 }} />
      <ClickHandler onPick={onPick} />
      <Recenter lat={lat} lng={lng} />
    </MapContainer>
  );
}
