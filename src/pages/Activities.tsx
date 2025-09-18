import React, { useState } from "react";
import { useUnifiedActivityHistory } from "@/hooks/useUnifiedActivityHistory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Target, TrendingUp } from "lucide-react";
import { ActivitySourceFilter } from "@/components/ActivitySourceFilter";
import { Header } from "@/components/Header";
import { ParticleBackground } from "@/components/ParticleBackground";
import { ScrollReveal } from "@/components/ScrollReveal";

export default function Activities() {
  const { activities, loading, error } = useUnifiedActivityHistory();
  const [selectedSource, setSelectedSource] = useState<'ALL' | 'GARMIN' | 'STRAVA' | 'POLAR' | 'ZEPP' | 'ZEPP_GPX' | 'HEALTHKIT' | 'BIOPEAK'>('ALL');

  const filteredActivities = selectedSource === 'ALL' 
    ? activities 
    : activities.filter(activity => activity.source === selectedSource);
  
  // Calculate activity counts by source
  const activityCounts = activities.reduce((acc, activity) => {
    acc[activity.source] = (acc[activity.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  activityCounts['ALL'] = activities.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Carregando atividades...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <ParticleBackground />
        <Header />
        <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto">
            <div className="text-center">
              <p className="text-red-500">Erro ao carregar atividades: {error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground />
      <Header />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto">
          <ScrollReveal>
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">
                Suas <span className="bg-gradient-primary bg-clip-text text-transparent">Atividades</span>
              </h1>
              <p className="text-muted-foreground">
                Histórico completo de treinos de todas as fontes conectadas
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <ActivitySourceFilter
              selectedSource={selectedSource}
              onSourceChange={setSelectedSource}
              activityCounts={activityCounts}
            />
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <Card className="glass-card border-glass-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Atividades {selectedSource !== 'ALL' && `- ${selectedSource}`}
                </CardTitle>
                <CardDescription>
                  {filteredActivities.length} atividade{filteredActivities.length !== 1 ? 's' : ''} encontrada{filteredActivities.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {selectedSource === 'ALL' 
                        ? 'Nenhuma atividade encontrada. Conecte seus dispositivos para começar!'
                        : `Nenhuma atividade encontrada para ${selectedSource}`
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredActivities.map((activity, index) => {
                      const getSourceBadgeColor = (source: string) => {
                        const colors = {
                          'GARMIN': 'bg-blue-100 text-blue-800',
                          'STRAVA': 'bg-orange-100 text-orange-800',
                          'POLAR': 'bg-cyan-100 text-cyan-800',
                          'ZEPP': 'bg-green-100 text-green-800',
                          'ZEPP_GPX': 'bg-emerald-100 text-emerald-800',
                          'HEALTHKIT': 'bg-red-100 text-red-800',
                          'BIOPEAK': 'bg-purple-100 text-purple-800'
                        };
                        return colors[source] || 'bg-gray-100 text-gray-800';
                      };

                      const getActivityTypeLabel = (type: string | null): string => {
                        if (!type) return 'Atividade';
                        const typeMap: { [key: string]: string } = {
                          'RUNNING': 'Corrida',
                          'Run': 'Corrida',
                          'running': 'Corrida',
                          'CYCLING': 'Ciclismo',
                          'Ride': 'Ciclismo', 
                          'cycling': 'Ciclismo',
                          'WALKING': 'Caminhada',
                          'Walk': 'Caminhada',
                          'walking': 'Caminhada',
                          'SWIMMING': 'Natação',
                          'Swim': 'Natação',
                          'swimming': 'Natação',
                          'FITNESS_EQUIPMENT': 'Academia',
                          'Workout': 'Academia'
                        };
                        return typeMap[type] || type;
                      };

                      return (
                        <Card key={activity.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-lg">
                                    {getActivityTypeLabel(activity.activity_type)}
                                  </h3>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSourceBadgeColor(activity.source)}`}>
                                    {activity.source === 'ZEPP_GPX' ? 'Zepp GPX' : 
                                     activity.source === 'ZEPP' ? 'Zepp Sync' : 
                                     activity.source}
                                  </span>
                                </div>
                                {activity.device_name && (
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {activity.device_name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {activity.activity_date && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>{new Date(activity.activity_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                              
                              {activity.duration_in_seconds && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span>{Math.floor(activity.duration_in_seconds / 3600) > 0 
                                    ? `${Math.floor(activity.duration_in_seconds / 3600)}h${Math.floor((activity.duration_in_seconds % 3600) / 60)}m`
                                    : `${Math.floor(activity.duration_in_seconds / 60)}m`}</span>
                                </div>
                              )}

                              {activity.distance_in_meters && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span>{(activity.distance_in_meters / 1000).toFixed(1)}km</span>
                                </div>
                              )}

                              {activity.active_kilocalories && (
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                  <span>{activity.active_kilocalories} cal</span>
                                </div>
                              )}
                            </div>

                            {(activity.average_heart_rate_in_beats_per_minute || activity.average_pace_in_minutes_per_kilometer) && (
                              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                                {activity.average_heart_rate_in_beats_per_minute && (
                                  <div>
                                    <span className="text-muted-foreground">FC Média: </span>
                                    <span className="font-medium">{activity.average_heart_rate_in_beats_per_minute} bpm</span>
                                  </div>
                                )}
                                {activity.average_pace_in_minutes_per_kilometer && (
                                  <div>
                                    <span className="text-muted-foreground">Pace: </span>
                                    <span className="font-medium">{activity.average_pace_in_minutes_per_kilometer.toFixed(2)} min/km</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}