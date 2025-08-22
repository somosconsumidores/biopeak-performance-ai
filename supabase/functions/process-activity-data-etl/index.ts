import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessRequest {
  user_id: string
  activity_id: string
  activity_source?: string
}

interface SeriesPoint {
  distance: number
  heart_rate?: number
  pace?: number
  speed?: number
  latitude?: number
  longitude?: number
  elevation?: number
  timestamp?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase com service_role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { user_id, activity_id, activity_source = 'garmin' }: ProcessRequest = await req.json()

    console.log(`Processing ETL for activity ${activity_id} (${activity_source}) for user ${user_id}`)

    // 1. Buscar dados raw da atividade
    const rawData = await fetchRawActivityData(supabase, user_id, activity_id, activity_source)
    
    if (!rawData || rawData.length === 0) {
      console.log('No raw data found for activity')
      return new Response(
        JSON.stringify({ success: false, message: 'No raw data found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Processar em paralelo todas as tabelas otimizadas
    const [chartResult, segmentsResult, zonesResult, coordsResult, variationResult] = await Promise.allSettled([
      processChartData(supabase, user_id, activity_id, activity_source, rawData),
      processSegments(supabase, user_id, activity_id, activity_source, rawData),
      processHeartRateZones(supabase, user_id, activity_id, activity_source, rawData),
      processCoordinates(supabase, user_id, activity_id, activity_source, rawData),
      processVariationAnalysis(supabase, user_id, activity_id, activity_source, rawData)
    ])

    const results = {
      chart: chartResult.status === 'fulfilled' ? chartResult.value : null,
      segments: segmentsResult.status === 'fulfilled' ? segmentsResult.value : null,
      zones: zonesResult.status === 'fulfilled' ? zonesResult.value : null,
      coordinates: coordsResult.status === 'fulfilled' ? coordsResult.value : null,
      variation: variationResult.status === 'fulfilled' ? variationResult.value : null
    }

    console.log('ETL processing completed:', results)

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in ETL processing:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function fetchRawActivityData(supabase: any, user_id: string, activity_id: string, source: string): Promise<SeriesPoint[]> {
  let data: SeriesPoint[] = []

  try {
    if (source === 'garmin') {
      // Buscar dados do Garmin
      const { data: garminData } = await supabase
        .from('garmin_activity_details')
        .select('*')
        .eq('user_id', user_id)
        .eq('activity_id', activity_id)

      if (garminData?.length > 0) {
        const details = garminData[0]
        
        // Processar dados de colunas diretas
        if (details.latitude_in_degree && details.longitude_in_degree) {
          data.push({
            distance: details.total_distance_in_meters || 0,
            heart_rate: details.heart_rate,
            speed: details.speed_meters_per_second,
            pace: details.speed_meters_per_second ? 1000 / (details.speed_meters_per_second * 60) : undefined,
            latitude: details.latitude_in_degree,
            longitude: details.longitude_in_degree,
            elevation: details.elevation_in_meters,
            timestamp: details.sample_timestamp
          })
        }

        // Processar samples JSONB
        if (details.samples) {
          const samples = Array.isArray(details.samples) ? details.samples : [details.samples]
          
          for (const sample of samples) {
            if (typeof sample === 'object' && sample !== null) {
              const point: SeriesPoint = {
                distance: sample.distance || sample.total_distance || 0,
                heart_rate: sample.heart_rate || sample.heartrate || sample.hr,
                latitude: sample.latitude || sample.lat,
                longitude: sample.longitude || sample.lng || sample.lon,
                elevation: sample.elevation || sample.alt,
                timestamp: sample.timestamp || sample.time
              }

              // Calcular pace a partir de speed
              if (sample.speed && sample.speed > 0) {
                point.speed = sample.speed
                point.pace = 1000 / (sample.speed * 60)
              } else if (sample.pace) {
                point.pace = sample.pace
              }

              data.push(point)
            }
          }
        }
      }
    }
    // Adicionar suporte para outras fontes (Strava, Polar, etc.) aqui

  } catch (error) {
    console.error('Error fetching raw data:', error)
  }

  return data.filter(point => point.distance !== undefined)
}

async function processChartData(supabase: any, user_id: string, activity_id: string, source: string, rawData: SeriesPoint[]) {
  try {
    // Samplear dados para o gráfico (máximo 1000 pontos)
    const maxPoints = 1000
    const sampleInterval = Math.max(1, Math.floor(rawData.length / maxPoints))
    const sampledData = rawData.filter((_, index) => index % sampleInterval === 0)

    // Calcular estatísticas
    const validHR = sampledData.filter(p => p.heart_rate && p.heart_rate > 0)
    const validPace = sampledData.filter(p => p.pace && p.pace > 0)
    const validSpeed = sampledData.filter(p => p.speed && p.speed > 0)

    const stats = {
      total_distance_meters: Math.max(...sampledData.map(p => p.distance)),
      avg_heart_rate: validHR.length > 0 ? Math.round(validHR.reduce((sum, p) => sum + p.heart_rate!, 0) / validHR.length) : null,
      max_heart_rate: validHR.length > 0 ? Math.max(...validHR.map(p => p.heart_rate!)) : null,
      avg_pace_min_km: validPace.length > 0 ? validPace.reduce((sum, p) => sum + p.pace!, 0) / validPace.length : null,
      avg_speed_ms: validSpeed.length > 0 ? validSpeed.reduce((sum, p) => sum + p.speed!, 0) / validSpeed.length : null
    }

    // Preparar série de dados otimizada
    const series = sampledData.map(point => ({
      distance: Math.round(point.distance),
      heart_rate: point.heart_rate,
      pace: point.pace ? Number(point.pace.toFixed(2)) : null,
      speed: point.speed ? Number(point.speed.toFixed(2)) : null
    }))

    const { error } = await supabase
      .from('activity_chart_data')
      .upsert({
        user_id,
        activity_id,
        activity_source: source,
        series_data: series,
        data_points_count: series.length,
        ...stats
      })

    if (error) throw error
    return { success: true, points: series.length }
  } catch (error) {
    console.error('Error processing chart data:', error)
    return { success: false, error: error.message }
  }
}

async function processSegments(supabase: any, user_id: string, activity_id: string, source: string, rawData: SeriesPoint[]) {
  try {
    const segments = []
    const segmentSize = 1000 // 1km em metros

    for (let segmentStart = 0; segmentStart < Math.max(...rawData.map(p => p.distance)); segmentStart += segmentSize) {
      const segmentEnd = segmentStart + segmentSize
      const segmentData = rawData.filter(p => p.distance >= segmentStart && p.distance < segmentEnd)

      if (segmentData.length === 0) continue

      const validHR = segmentData.filter(p => p.heart_rate && p.heart_rate > 0)
      const validPace = segmentData.filter(p => p.pace && p.pace > 0)
      const validSpeed = segmentData.filter(p => p.speed && p.speed > 0)

      segments.push({
        user_id,
        activity_id,
        activity_source: source,
        segment_number: Math.floor(segmentStart / segmentSize) + 1,
        start_distance_meters: segmentStart,
        end_distance_meters: segmentEnd,
        avg_pace_min_km: validPace.length > 0 ? validPace.reduce((sum, p) => sum + p.pace!, 0) / validPace.length : null,
        avg_heart_rate: validHR.length > 0 ? Math.round(validHR.reduce((sum, p) => sum + p.heart_rate!, 0) / validHR.length) : null,
        avg_speed_ms: validSpeed.length > 0 ? validSpeed.reduce((sum, p) => sum + p.speed!, 0) / validSpeed.length : null
      })
    }

    if (segments.length > 0) {
      const { error } = await supabase
        .from('activity_segments')
        .upsert(segments)

      if (error) throw error
    }

    return { success: true, segments: segments.length }
  } catch (error) {
    console.error('Error processing segments:', error)
    return { success: false, error: error.message }
  }
}

async function processHeartRateZones(supabase: any, user_id: string, activity_id: string, source: string, rawData: SeriesPoint[]) {
  try {
    const hrData = rawData.filter(p => p.heart_rate && p.heart_rate > 0)
    if (hrData.length === 0) return { success: false, error: 'No HR data' }

    const maxHR = Math.max(...hrData.map(p => p.heart_rate!))
    
    // Calcular zonas (50-60%, 60-70%, 70-80%, 80-90%, 90-100%)
    const zones = [
      { min: 0.5, max: 0.6 },
      { min: 0.6, max: 0.7 },
      { min: 0.7, max: 0.8 },
      { min: 0.8, max: 0.9 },
      { min: 0.9, max: 1.0 }
    ]

    const zoneTimes = zones.map(() => 0)
    
    hrData.forEach(point => {
      const hrPercent = point.heart_rate! / maxHR
      zones.forEach((zone, index) => {
        if (hrPercent >= zone.min && hrPercent < zone.max) {
          zoneTimes[index]++
        }
      })
    })

    const totalTime = hrData.length
    const zonePercentages = zoneTimes.map(time => totalTime > 0 ? (time / totalTime) * 100 : 0)

    const { error } = await supabase
      .from('activity_heart_rate_zones')
      .upsert({
        user_id,
        activity_id,
        activity_source: source,
        max_heart_rate: maxHR,
        zone_1_time_seconds: zoneTimes[0],
        zone_2_time_seconds: zoneTimes[1],
        zone_3_time_seconds: zoneTimes[2],
        zone_4_time_seconds: zoneTimes[3],
        zone_5_time_seconds: zoneTimes[4],
        zone_1_percentage: zonePercentages[0],
        zone_2_percentage: zonePercentages[1],
        zone_3_percentage: zonePercentages[2],
        zone_4_percentage: zonePercentages[3],
        zone_5_percentage: zonePercentages[4],
        total_time_seconds: totalTime
      })

    if (error) throw error
    return { success: true, zones: 5 }
  } catch (error) {
    console.error('Error processing HR zones:', error)
    return { success: false, error: error.message }
  }
}

async function processCoordinates(supabase: any, user_id: string, activity_id: string, source: string, rawData: SeriesPoint[]) {
  try {
    const coordData = rawData.filter(p => p.latitude && p.longitude)
    if (coordData.length === 0) return { success: false, error: 'No GPS data' }

    // Samplear coordenadas inteligentemente (máximo 500 pontos)
    const maxPoints = 500
    const sampleInterval = Math.max(1, Math.floor(coordData.length / maxPoints))
    const sampledCoords = coordData.filter((_, index) => index % sampleInterval === 0)

    const coordinates = sampledCoords.map(point => ({
      lat: point.latitude,
      lng: point.longitude,
      elevation: point.elevation
    }))

    // Calcular bounding box
    const lats = coordinates.map(c => c.lat!)
    const lngs = coordinates.map(c => c.lng!)
    
    const boundingBox = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    }

    const { error } = await supabase
      .from('activity_coordinates')
      .upsert({
        user_id,
        activity_id,
        activity_source: source,
        coordinates,
        total_points: coordData.length,
        sampled_points: coordinates.length,
        starting_latitude: coordData[0].latitude,
        starting_longitude: coordData[0].longitude,
        bounding_box: boundingBox
      })

    if (error) throw error
    return { success: true, points: coordinates.length }
  } catch (error) {
    console.error('Error processing coordinates:', error)
    return { success: false, error: error.message }
  }
}

async function processVariationAnalysis(supabase: any, user_id: string, activity_id: string, source: string, rawData: SeriesPoint[]) {
  try {
    const hrData = rawData.filter(p => p.heart_rate && p.heart_rate > 0).map(p => p.heart_rate!)
    const paceData = rawData.filter(p => p.pace && p.pace > 0).map(p => p.pace!)

    if (hrData.length < 10 && paceData.length < 10) {
      return { success: false, error: 'Insufficient data points' }
    }

    let hrCV = null, hrCategory = null
    let paceCV = null, paceCategory = null

    // Calcular CV para HR
    if (hrData.length >= 10) {
      const hrMean = hrData.reduce((sum, val) => sum + val, 0) / hrData.length
      const hrStd = Math.sqrt(hrData.reduce((sum, val) => sum + Math.pow(val - hrMean, 2), 0) / (hrData.length - 1))
      hrCV = hrStd / hrMean
      hrCategory = hrCV <= 0.15 ? 'Baixo' : 'Alto'
    }

    // Calcular CV para Pace
    if (paceData.length >= 10) {
      const paceMean = paceData.reduce((sum, val) => sum + val, 0) / paceData.length
      const paceStd = Math.sqrt(paceData.reduce((sum, val) => sum + Math.pow(val - paceMean, 2), 0) / (paceData.length - 1))
      paceCV = paceStd / paceMean
      paceCategory = paceCV <= 0.15 ? 'Baixo' : 'Alto'
    }

    const hasValidData = hrCV !== null || paceCV !== null
    const diagnosis = hasValidData ? 'Análise calculada automaticamente via ETL' : 'Dados insuficientes para análise'

    const { error } = await supabase
      .from('activity_variation_analysis')
      .upsert({
        user_id,
        activity_id,
        activity_source: source,
        data_points: hrData.length + paceData.length,
        heart_rate_cv: hrCV,
        heart_rate_cv_category: hrCategory,
        pace_cv: paceCV,
        pace_cv_category: paceCategory,
        diagnosis,
        has_valid_data: hasValidData
      })

    if (error) throw error
    return { success: true, analysis: { hrCV, paceCV } }
  } catch (error) {
    console.error('Error processing variation analysis:', error)
    return { success: false, error: error.message }
  }
}