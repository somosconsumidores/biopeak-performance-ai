import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';

interface WorkoutMapProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  width?: number;
  height?: number;
}

export const WorkoutMap = ({ coordinates, width = 400, height = 300 }: WorkoutMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) {
          console.warn('Failed to fetch Mapbox token from secrets:', error);
          setTokenError('Mapbox token not configured');
          return;
        }
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setTokenError('Mapbox token not found in secrets');
        }
      } catch (err) {
        console.warn('Error fetching Mapbox token:', err);
        setTokenError('Failed to load map configuration');
      }
    };

    fetchMapboxToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !coordinates.length || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    // Calculate bounds
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach(coord => {
      bounds.extend([coord.longitude, coord.latitude]);
    });

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      bounds: bounds,
      fitBoundsOptions: { padding: 20 }
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add route line
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates.map(coord => [coord.longitude, coord.latitude])
          }
        }
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4
        }
      });

      // Add start marker
      if (coordinates[0]) {
        new mapboxgl.Marker({ color: '#22c55e' })
          .setLngLat([coordinates[0].longitude, coordinates[0].latitude])
          .addTo(map.current);
      }

      // Add end marker
      if (coordinates[coordinates.length - 1]) {
        new mapboxgl.Marker({ color: '#ef4444' })
          .setLngLat([coordinates[coordinates.length - 1].longitude, coordinates[coordinates.length - 1].latitude])
          .addTo(map.current);
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [coordinates]);

  if (!coordinates.length) {
    return (
      <div 
        className="bg-muted/20 flex items-center justify-center text-muted-foreground"
        style={{ width, height }}
      >
        Sem dados GPS
      </div>
    );
  }

  if (tokenError) {
    return (
      <div 
        className="bg-muted/20 flex items-center justify-center text-muted-foreground"
        style={{ width, height }}
      >
        {tokenError}
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div 
        className="bg-muted/20 flex items-center justify-center text-muted-foreground"
        style={{ width, height }}
      >
        Carregando mapa...
      </div>
    );
  }

  return (
    <div 
      ref={mapContainer} 
      style={{ width, height }}
      className="rounded-lg overflow-hidden"
    />
  );
};