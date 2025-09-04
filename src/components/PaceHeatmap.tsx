import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, Key, Eye, Zap, Navigation, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface PacePoint {
  coordinates: [number, number]; // [lat, lng]
  pace_min_per_km: number;
  distance_km: number;
  heart_rate?: number;
}

interface PaceHeatmapProps {
  data?: PacePoint[] | null;
  activityTitle?: string;
}

interface PaceLegendItem {
  range: string;
  color: string;
  minPace: number;
  maxPace: number;
  description: string;
}

export const PaceHeatmap = ({ data, activityTitle }: PaceHeatmapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenError, setTokenError] = useState<string>('');
  const [legend, setLegend] = useState<PaceLegendItem[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<PacePoint | null>(null);

  useEffect(() => {
    // Try to get Mapbox token from Supabase edge function first
    const getMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.log('Mapbox token not available from Supabase, showing input');
          setShowTokenInput(true);
          return;
        }
        
        if (data?.token) {
          setMapboxToken(data.token);
          return;
        }
      } catch (error) {
        console.log('Error fetching Mapbox token from Supabase:', error);
      }
      setShowTokenInput(true);
    };

    getMapboxToken();
  }, []);

  // Generate pace legend based on data
  useEffect(() => {
    if (!data?.length) return;

    const paces = data.map(p => p.pace_min_per_km).filter(p => p > 0).sort((a, b) => a - b);
    if (paces.length === 0) return;

    const minPace = paces[0];
    const maxPace = paces[paces.length - 1];
    const range = maxPace - minPace;

    // Create 5 pace zones
    const legendItems: PaceLegendItem[] = [
      {
        range: `${minPace.toFixed(1)} - ${(minPace + range * 0.2).toFixed(1)}`,
        color: '#22c55e', // green - fastest
        minPace: minPace,
        maxPace: minPace + range * 0.2,
        description: 'Ritmo muito rápido'
      },
      {
        range: `${(minPace + range * 0.2).toFixed(1)} - ${(minPace + range * 0.4).toFixed(1)}`,
        color: '#84cc16', // lime - fast
        minPace: minPace + range * 0.2,
        maxPace: minPace + range * 0.4,
        description: 'Ritmo rápido'
      },
      {
        range: `${(minPace + range * 0.4).toFixed(1)} - ${(minPace + range * 0.6).toFixed(1)}`,
        color: '#eab308', // yellow - moderate
        minPace: minPace + range * 0.4,
        maxPace: minPace + range * 0.6,
        description: 'Ritmo moderado'
      },
      {
        range: `${(minPace + range * 0.6).toFixed(1)} - ${(minPace + range * 0.8).toFixed(1)}`,
        color: '#f97316', // orange - slow
        minPace: minPace + range * 0.6,
        maxPace: minPace + range * 0.8,
        description: 'Ritmo lento'
      },
      {
        range: `${(minPace + range * 0.8).toFixed(1)} - ${maxPace.toFixed(1)}`,
        color: '#ef4444', // red - slowest
        minPace: minPace + range * 0.8,
        maxPace: maxPace,
        description: 'Ritmo muito lento'
      }
    ];

    setLegend(legendItems);
  }, [data]);

  const getPaceColor = (pace: number): string => {
    if (!legend.length) return '#6b7280';
    
    for (const item of legend) {
      if (pace >= item.minPace && pace <= item.maxPace) {
        return item.color;
      }
    }
    return legend[legend.length - 1].color; // Default to slowest
  };

  const formatPace = (paceMinKm: number): string => {
    const minutes = Math.floor(paceMinKm);
    const seconds = Math.round((paceMinKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
          pitch: 0
        });

        // Add navigation controls
        map.current.addControl(new mapboxgl.default.NavigationControl({
          visualizePitch: true
        }), 'top-right');

        // Add fullscreen control
        map.current.addControl(new mapboxgl.default.FullscreenControl(), 'top-right');

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

          // Click events for circles
          map.current.on('click', 'pace-circles', (e: any) => {
            const features = map.current.queryRenderedFeatures(e.point, {
              layers: ['pace-circles']
            });
            
            if (features.length > 0) {
              const feature = features[0];
              const pointIndex = feature.properties.index;
              setSelectedPoint(data[pointIndex]);

              // Create popup
              const popup = new mapboxgl.default.Popup({ closeOnClick: true })
                .setLngLat(e.lngLat)
                .setHTML(`
                  <div class="p-3 min-w-[200px]">
                    <div class="font-semibold text-sm mb-2">Detalhes do Ponto</div>
                    <div class="space-y-1 text-xs">
                      <div><strong>Pace:</strong> ${formatPace(feature.properties.pace)} min/km</div>
                      <div><strong>Distância:</strong> ${feature.properties.distance.toFixed(2)} km</div>
                      ${feature.properties.heartRate ? `<div><strong>FC:</strong> ${feature.properties.heartRate} bpm</div>` : ''}
                    </div>
                  </div>
                `)
                .addTo(map.current);
            }
          });

          // Change cursor on hover
          map.current.on('mouseenter', 'pace-circles', () => {
            map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current.on('mouseleave', 'pace-circles', () => {
            map.current.getCanvas().style.cursor = '';
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

      } catch (error) {
        console.error('Error initializing map:', error);
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
  }, [mapboxToken, data, legend]);

  const handleTokenSubmit = () => {
    if (!mapboxToken.trim()) {
      setTokenError('Por favor, insira um token válido do Mapbox');
      return;
    }
    setTokenError('');
    setShowTokenInput(false);
  };

  if (!data?.length) {
    return (
      <div className="h-96 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum dado de pace disponível</p>
          <p className="text-sm">Sincronize atividades com dados de pace para ver o mapa</p>
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
            Para visualizar o mapa de pace, você precisa de um token público do Mapbox.
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
            <p className="text-sm text-destructive">{tokenError}</p>
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
    <div className="space-y-4">
      {/* Map Container */}
      <div className="relative">
        <div 
          ref={mapContainer} 
          className="h-96 rounded-lg border overflow-hidden bg-muted/20"
        />
        
        {/* Interactive hint */}
        <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Navigation className="h-3 w-3" />
            <span>Clique nos pontos para ver detalhes</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      {legend.length > 0 && (
        <Card className="glass-card border-glass-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Legenda do Pace (min/km)</h4>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {legend.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{item.range}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator className="my-3" />
            
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                {data.length} pontos de dados
              </Badge>
              {activityTitle && (
                <Badge variant="outline" className="text-xs">
                  {activityTitle}
                </Badge>
              )}
              <span>• Use o zoom para ver mais detalhes</span>
              <span>• Verde = mais rápido, Vermelho = mais lento</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};