import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Key, Eye } from 'lucide-react';

interface GPSData {
  coordinates: Array<[number, number]>;
  intensity: number[];
  bounds: [[number, number], [number, number]];
}

interface GPSHeatmapProps {
  data?: GPSData | null;
}

export const GPSHeatmap = ({ data }: GPSHeatmapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenError, setTokenError] = useState<string>('');

  useEffect(() => {
    // Try to get Mapbox token from Supabase edge function first
    const getMapboxToken = async () => {
      console.log('🔍 MAPBOX TOKEN: Starting to fetch token from Supabase edge function');
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        console.log('🔍 MAPBOX TOKEN: Edge function response:', { data: !!data, error });
        
        if (error) {
          console.log('🔍 MAPBOX TOKEN: Error from edge function, showing token input');
          setShowTokenInput(true);
          setTokenError('Token não configurado no servidor');
          return;
        }
        
        if (data?.token) {
          console.log('🔍 MAPBOX TOKEN: Token received successfully');
          setMapboxToken(data.token);
          return;
        }
        
        console.log('🔍 MAPBOX TOKEN: No token in response');
      } catch (error) {
        console.error('🔍 MAPBOX TOKEN: Error fetching token:', error);
      }
      
      console.log('🔍 MAPBOX TOKEN: Fallback to manual input');
      setShowTokenInput(true);
      setTokenError('Configure seu token Mapbox');
    };

    getMapboxToken();
  }, []);

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current || !data?.coordinates.length) {
      console.log('🔍 MAPBOX MAP: Skipping map initialization:', {
        hasToken: !!mapboxToken,
        hasContainer: !!mapContainer.current,
        hasData: !!data?.coordinates.length,
        coordinatesCount: data?.coordinates?.length || 0
      });
      return;
    }

    console.log('🔍 MAPBOX MAP: Starting map initialization with data:', {
      coordinatesCount: data.coordinates.length,
      bounds: data.bounds
    });

    const initializeMap = async () => {
      try {
        console.log('🔍 MAPBOX MAP: Importing mapbox-gl');
        // Dynamically import mapbox-gl
        const mapboxgl = await import('mapbox-gl');
        
        console.log('🔍 MAPBOX MAP: Setting access token');
        mapboxgl.default.accessToken = mapboxToken;

        console.log('🔍 MAPBOX MAP: Creating new map');
        // Initialize map
        map.current = new mapboxgl.default.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [
            (data.bounds[0][1] + data.bounds[1][1]) / 2,
            (data.bounds[0][0] + data.bounds[1][0]) / 2
          ],
          zoom: 12,
          pitch: 0
        });

        map.current.on('load', () => {
          console.log('🔍 MAPBOX MAP: Map loaded, adding sources and layers');
          // Add heatmap layer
          map.current.addSource('activities', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: data.coordinates.map((coord, index) => ({
                type: 'Feature',
                properties: {
                  intensity: data.intensity[index] || 0.5
                },
                geometry: {
                  type: 'Point',
                  coordinates: [coord[1], coord[0]] // [lng, lat]
                }
              }))
            }
          });

          console.log('🔍 MAPBOX MAP: Added data source');

          // Add heatmap layer
          map.current.addLayer({
            id: 'activities-heatmap',
            type: 'heatmap',
            source: 'activities',
            maxzoom: 20,
            paint: {
              'heatmap-weight': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0, 0,
                1, 1
              ],
              'heatmap-intensity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 1,
                15, 3,
                20, 1
              ],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0,0,255,0)',
                0.2, 'rgb(0,255,255)',
                0.4, 'rgb(0,255,0)',
                0.6, 'rgb(255,255,0)',
                0.8, 'rgb(255,165,0)',
                1, 'rgb(255,0,0)'
              ],
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 2,
                10, 15,
                15, 25,
                20, 30
              ],
              'heatmap-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                7, 1,
                13, 0.8,
                15, 0.5,
                18, 0.3,
                20, 0.1
              ]
            }
          });

          console.log('🔍 MAPBOX MAP: Added heatmap layer');

          // Add circle layer for high zoom levels
          map.current.addLayer({
            id: 'activities-points',
            type: 'circle',
            source: 'activities',
            minzoom: 13,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                13, 3,
                16, 5,
                20, 8
              ],
              'circle-color': [
                'interpolate',
                ['linear'],
                ['get', 'intensity'],
                0, '#3b82f6',
                0.5, '#f59e0b',
                1, '#ef4444'
              ],
              'circle-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                13, 0,
                15, 0.7,
                20, 0.9
              ],
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-opacity': 0.8
            }
          });

          console.log('🔍 MAPBOX MAP: Added circle layer');

          // Fit map to bounds with padding
          const bounds = new mapboxgl.default.LngLatBounds(
            [data.bounds[0][1], data.bounds[0][0]], // sw
            [data.bounds[1][1], data.bounds[1][0]]  // ne
          );
          
          map.current.fitBounds(bounds, {
            padding: 20
          });

          console.log('🔍 MAPBOX MAP: Map fully initialized and fitted to bounds');
        });

      } catch (error) {
        console.error('🔍 MAPBOX MAP: Error initializing map:', error);
        setTokenError('Erro ao carregar o mapa. Verifique se o token do Mapbox está correto.');
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

  const handleTokenSubmit = () => {
    if (!mapboxToken.trim()) {
      setTokenError('Por favor, insira um token válido do Mapbox');
      return;
    }
    setTokenError('');
    setShowTokenInput(false);
  };

  if (!data?.coordinates.length) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum dado GPS disponível</p>
          <p className="text-sm">Sincronize atividades com GPS para ver o mapa de calor</p>
        </div>
      </div>
    );
  }

  if (showTokenInput) {
    return (
      <div className="space-y-4">
        <Alert>
          <Key className="h-4 w-4" />
          <AlertDescription>
            Para visualizar o mapa de calor GPS, você precisa de um token público do Mapbox.
            <br />
            Obtenha seu token gratuito em: <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mapbox.com</a>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Cole seu token público do Mapbox aqui"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
            className="text-sm"
          />
          {tokenError && (
            <p className="text-sm text-red-400">{tokenError}</p>
          )}
          <Button 
            onClick={handleTokenSubmit}
            className="w-full"
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            Visualizar Mapa
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        ref={mapContainer} 
        className="h-64 rounded-lg border overflow-hidden bg-muted/20"
      />
      <p className="text-xs text-muted-foreground text-center">
        Mapa de calor baseado em {data.coordinates.length} pontos GPS das suas atividades
      </p>
    </div>
  );
};