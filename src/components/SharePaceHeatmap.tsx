import { useEffect, useRef, useState } from 'react';

interface PacePoint {
  coordinates: [number, number]; // [lat, lng]
  pace_min_per_km: number;
  distance_km: number;
  heart_rate?: number;
}

interface SharePaceHeatmapProps {
  data?: PacePoint[] | null;
  onMapReady?: () => void;
}

export const SharePaceHeatmap = ({ data, onMapReady }: SharePaceHeatmapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');

  useEffect(() => {
    // Try to get Mapbox token from Supabase edge function first
    const getMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error || !data?.token) {
          console.log('Mapbox token not available from Supabase');
          return;
        }
        
        setMapboxToken(data.token);
      } catch (error) {
        console.log('Error fetching Mapbox token from Supabase:', error);
      }
    };

    getMapboxToken();
  }, []);

  const getPaceColor = (pace: number): string => {
    if (!data?.length) return '#6b7280';
    
    const paces = data.map(p => p.pace_min_per_km).filter(p => p > 0).sort((a, b) => a - b);
    
    const getPercentile = (percentile: number) => {
      const index = Math.ceil((percentile / 100) * paces.length) - 1;
      return paces[Math.max(0, Math.min(index, paces.length - 1))];
    };

    const p10 = getPercentile(10);
    const p36 = getPercentile(36);
    const p65 = getPercentile(65);
    const p89 = getPercentile(89);

    if (pace <= p10) return '#22c55e'; // green - fastest
    if (pace <= p36) return '#84cc16'; // lime
    if (pace <= p65) return '#eab308'; // yellow
    if (pace <= p89) return '#f97316'; // orange
    return '#ef4444'; // red - slowest
  };

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || !data?.length) return;

    const initializeMap = async () => {
      try {
        // Dynamically import mapbox-gl
        const mapboxgl = await import('mapbox-gl');
        
        mapboxgl.default.accessToken = mapboxToken;

        // Calculate bounds
        const lats = data.map(p => p.coordinates[0]);
        const lngs = data.map(p => p.coordinates[1]);
        const bounds = [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ];

        // Initialize map
        map.current = new mapboxgl.default.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/outdoors-v12',
          center: [
            (bounds[0][0] + bounds[1][0]) / 2,
            (bounds[0][1] + bounds[1][1]) / 2
          ],
          zoom: 13,
          pitch: 0,
          interactive: false // Disable interaction for sharing
        });

        map.current.on('load', () => {
          // Create GeoJSON data with pace information
          const geojsonData = {
            type: 'FeatureCollection',
            features: data.map((point, index) => ({
              type: 'Feature',
              properties: {
                pace: point.pace_min_per_km,
                distance: point.distance_km,
                heartRate: point.heart_rate || null,
                color: getPaceColor(point.pace_min_per_km),
                index
              },
              geometry: {
                type: 'Point',
                coordinates: [point.coordinates[1], point.coordinates[0]] // [lng, lat]
              }
            }))
          };

          // Add source
          map.current.addSource('pace-points', {
            type: 'geojson',
            data: geojsonData
          });

          // Add heatmap layer for overview
          map.current.addLayer({
            id: 'pace-heatmap',
            type: 'heatmap',
            source: 'pace-points',
            maxzoom: 15,
            paint: {
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'pace'],
                // Invert: slower pace = higher weight (more intense)
                3, 1,
                4, 0.8,
                5, 0.6,
                6, 0.4,
                10, 0.1
              ],
              'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 1,
                15, 2
              ],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.2, '#22c55e',
                0.4, '#84cc16',
                0.6, '#eab308',
                0.8, '#f97316',
                1, '#ef4444'
              ],
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 8,
                15, 20
              ],
              'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, 0.8,
                15, 0.4
              ]
            }
          });

          // Add circle layer for detailed view
          map.current.addLayer({
            id: 'pace-circles',
            type: 'circle',
            source: 'pace-points',
            minzoom: 12,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 4,
                16, 8,
                20, 12
              ],
              'circle-color': ['get', 'color'],
              'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 0.7,
                16, 0.9
              ],
              'circle-stroke-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 1,
                16, 2
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-opacity': 0.8
            }
          });

          // Add line layer to show route
          const routeData = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: data.map(p => [p.coordinates[1], p.coordinates[0]])
            }
          };

          map.current.addSource('route', {
            type: 'geojson',
            data: routeData
          });

          map.current.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': '#64748b',
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10, 2,
                16, 4
              ],
              'line-opacity': 0.6
            }
          });

          // Fit map to bounds with padding
          const mapBounds = new mapboxgl.default.LngLatBounds(
            [bounds[0][0], bounds[0][1]], // sw
            [bounds[1][0], bounds[1][1]]  // ne
          );
          map.current.fitBounds(mapBounds, {
            padding: 50
          });
        });

        // Notify when map is ready for capture
        map.current.on('idle', () => {
          if (onMapReady) {
            // Small delay to ensure everything is fully rendered
            setTimeout(() => onMapReady(), 500);
          }
        });

      } catch (error) {
        console.error('Error initializing share map:', error);
      }
    };

    initializeMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapboxToken, data]);

  if (!data?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-4xl">
        Mapa não disponível
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-4xl">
        Carregando mapa...
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div 
        ref={mapContainer} 
        className="w-full h-full"
      />
    </div>
  );
};