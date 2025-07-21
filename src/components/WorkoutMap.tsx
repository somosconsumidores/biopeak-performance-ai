
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface WorkoutMapProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  width?: number;
  height?: number;
  onMapLoaded?: () => void;
}

export const WorkoutMap = ({ coordinates, width = 400, height = 300, onMapLoaded }: WorkoutMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current || !coordinates.length) return;

    console.log('🗺️ Initializing map with coordinates:', coordinates.length);

    // Try multiple tokens - demo token first, then fallback
    const tokens = [
      'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw',
      'pk.eyJ1IjoidGVzdCIsImEiOiJjazBvNGE4M3kwMDl6M2x0aWFwMnRnNnU3In0.UXnrAYWJ_JHp6D7O-YXTyQ'
    ];

    let tokenIndex = 0;
    
    const initializeMap = () => {
      if (tokenIndex >= tokens.length) {
        setMapError('Não foi possível carregar o mapa');
        return;
      }

      mapboxgl.accessToken = tokens[tokenIndex];
      console.log('🔑 Using Mapbox token index:', tokenIndex);
      
      // Calculate bounds
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach(coord => {
        bounds.extend([coord.longitude, coord.latitude]);
      });

      try {
        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v11', // Using more reliable style
          bounds: bounds,
          fitBoundsOptions: { padding: 20 },
          preserveDrawingBuffer: true, // Important for image capture
          antialias: true
        });

        map.current.on('error', (e) => {
          console.error('❌ Map error:', e);
          tokenIndex++;
          map.current?.remove();
          setTimeout(initializeMap, 100); // Try next token
        });

        map.current.on('load', () => {
          console.log('✅ Map loaded successfully');
          if (!map.current) return;

          try {
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
                'line-width': 4,
                'line-opacity': 0.8
              }
            });

            // Add start marker
            if (coordinates[0]) {
              new mapboxgl.Marker({ color: '#22c55e', scale: 0.8 })
                .setLngLat([coordinates[0].longitude, coordinates[0].latitude])
                .addTo(map.current);
            }

            // Add end marker
            if (coordinates[coordinates.length - 1]) {
              new mapboxgl.Marker({ color: '#ef4444', scale: 0.8 })
                .setLngLat([coordinates[coordinates.length - 1].longitude, coordinates[coordinates.length - 1].latitude])
                .addTo(map.current);
            }

            // Wait a bit more for everything to render, then call onMapLoaded
            setTimeout(() => {
              console.log('✅ Map fully rendered');
              onMapLoaded?.();
            }, 1000);

          } catch (error) {
            console.error('❌ Error adding map layers:', error);
            setMapError('Erro ao adicionar camadas do mapa');
          }
        });

        map.current.on('idle', () => {
          console.log('💤 Map is idle (finished loading/moving)');
        });

      } catch (error) {
        console.error('❌ Error initializing map:', error);
        tokenIndex++;
        setTimeout(initializeMap, 100);
      }
    };

    initializeMap();

    return () => {
      map.current?.remove();
    };
  }, [coordinates, onMapLoaded]);

  if (!coordinates.length) {
    return (
      <div 
        className="bg-muted/20 flex items-center justify-center text-muted-foreground border border-dashed border-muted"
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="text-2xl mb-2">📍</div>
          <div>Sem dados GPS</div>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div 
        className="bg-red-50 flex items-center justify-center text-red-600 border border-red-200"
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="text-sm">{mapError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        ref={mapContainer} 
        style={{ width, height }}
        className="rounded-lg overflow-hidden border border-gray-200"
      />
      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
        Mapbox
      </div>
    </div>
  );
};
