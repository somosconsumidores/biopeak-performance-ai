package com.biopeakai.performance;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.Location;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Random;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

@CapacitorPlugin(name = "BioPeakLocationTracker")
public class BioPeakLocationTracker extends Plugin {
    private static final String TAG = "BP/LocationPlugin";
    
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Location lastLocation;
    private double accumulatedDistance = 0.0;
    private boolean isTracking = false;
    
    // Native feedback control (500m intervals)
    private int lastFeedbackSegment = 0;
    private long lastFeedbackAt = 0;
    private String sessionId;
    private String trainingGoal;
    private boolean shouldGiveFeedback = false;
    private Long sessionStartTime;
    
    // Supabase credentials
    private String supabaseUrl;
    private String supabaseAnonKey;
    private String userToken;
    
    private ExecutorService executorService;
    private OkHttpClient httpClient;
    
    // Audio playback
    private MediaPlayer feedbackMediaPlayer;
    private CountDownLatch audioCompletionLatch;
    
    @Override
    public void load() {
        super.load();
        Log.e(TAG, "🚨🚨🚨 LOAD() CALLED - PLUGIN IS LOADING! 🚨🚨🚨");
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(getContext());
        executorService = Executors.newCachedThreadPool();
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
            
        Log.e(TAG, "🚨🚨🚨 PLUGIN FULLY LOADED 🚨🚨🚨");
    }
    
    @PluginMethod
    public void startLocationTracking(PluginCall call) {
        if (isTracking) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Already tracking");
            call.resolve(result);
            return;
        }
        
        // Check permissions
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("Location permission not granted");
            return;
        }
        
        // Reset accumulated distance
        accumulatedDistance = 0.0;
        lastLocation = null;
        isTracking = true;
        sessionStartTime = System.currentTimeMillis();
        
        // Configure location request
        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000)
            .setMinUpdateDistanceMeters(5.0f)
            .setMinUpdateIntervalMillis(3000)
            .setMaxUpdateDelayMillis(5000)
            .build();
        
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                
                for (Location location : locationResult.getLocations()) {
                    handleLocationUpdate(location);
                }
            }
        };
        
        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
        
        Log.d(TAG, "✅ [Native GPS] Started tracking");
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Location tracking started");
        call.resolve(result);
    }
    
    @PluginMethod
    public void stopLocationTracking(PluginCall call) {
        if (!isTracking || locationCallback == null) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Not tracking");
            result.put("finalDistance", accumulatedDistance);
            call.resolve(result);
            return;
        }
        
        fusedLocationClient.removeLocationUpdates(locationCallback);
        isTracking = false;
        // ⚠️ DO NOT reset sessionStartTime here - we need it for generateCompletionAudio()
        
        Log.d(TAG, "⏹️ [Native GPS] Stopped tracking - Total distance: " + accumulatedDistance + "m");
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Location tracking stopped");
        result.put("finalDistance", accumulatedDistance);
        call.resolve(result);
    }
    
    @PluginMethod
    public void cleanup(PluginCall call) {
        Log.d(TAG, "🧹 [Native GPS] Cleaning up all resources...");
        
        // Stop location tracking
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        
        // Release media player
        if (feedbackMediaPlayer != null) {
            feedbackMediaPlayer.release();
            feedbackMediaPlayer = null;
        }
        
        // Reset all state
        locationCallback = null;
        sessionStartTime = null;
        sessionId = null;
        trainingGoal = null;
        accumulatedDistance = 0.0;
        lastLocation = null;
        lastFeedbackSegment = 0;
        shouldGiveFeedback = false;
        supabaseUrl = null;
        supabaseAnonKey = null;
        userToken = null;
        
        Log.d(TAG, "✅ [Native GPS] Cleanup completed");
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
    
    @PluginMethod
    public void getAccumulatedDistance(PluginCall call) {
        JSObject result = new JSObject();
        result.put("distance", accumulatedDistance);
        call.resolve(result);
    }
    
    @PluginMethod
    public void resetDistance(PluginCall call) {
        accumulatedDistance = 0.0;
        lastLocation = null;
        lastFeedbackSegment = 0;
        sessionStartTime = null;
        Log.d(TAG, "🔄 [Native GPS] Distance reset");
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
    
    @PluginMethod
    public void configureFeedback(PluginCall call) {
        sessionId = call.getString("sessionId");
        trainingGoal = call.getString("trainingGoal");
        shouldGiveFeedback = call.getBoolean("enabled", true);
        supabaseUrl = call.getString("supabaseUrl");
        supabaseAnonKey = call.getString("supabaseAnonKey");
        userToken = call.getString("userToken");
        lastFeedbackSegment = 0;
        
        Log.d(TAG, "✅ [Native GPS] Feedback configured:");
        Log.d(TAG, "   → sessionId: " + sessionId);
        Log.d(TAG, "   → trainingGoal: " + trainingGoal);
        Log.d(TAG, "   → enabled: " + shouldGiveFeedback);
        Log.d(TAG, "   → supabaseUrl: " + (supabaseUrl != null ? "configured" : "NOT configured"));
        Log.d(TAG, "   → supabaseAnonKey: " + (supabaseAnonKey != null ? "configured" : "NOT configured"));
        Log.d(TAG, "   → userToken: " + (userToken != null ? "configured" : "NOT configured"));
        
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }
    
    @PluginMethod
    public void generateCompletionAudio(PluginCall call) {
        executorService.execute(() -> {
            try {
                // Calculate final metrics
                if (sessionStartTime == null) {
                    Log.e(TAG, "❌ [Native GPS] Session start time not available for completion audio");
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("message", "Session start time not available");
                    call.resolve(result);
                    return;
                }
                
                int totalDistance = (int) accumulatedDistance;
                int timeFromStart = (int) ((System.currentTimeMillis() - sessionStartTime) / 1000);
                
                // Calculate average pace
                Double currentPace = null;
                if (totalDistance > 0 && timeFromStart > 0) {
                    double distanceKm = totalDistance / 1000.0;
                    double timeMinutes = timeFromStart / 60.0;
                    currentPace = timeMinutes / distanceKm;
                }
                
                Log.d(TAG, "🏁 [Native GPS] Generating completion audio:");
                Log.d(TAG, "   → distance: " + totalDistance + "m");
                Log.d(TAG, "   → time: " + timeFromStart + "s");
                if (currentPace != null) {
                    Log.d(TAG, "   → pace: " + String.format("%.2f", currentPace) + " min/km");
                }
                
                // Generate completion message
                String message = generateCompletionMessage(totalDistance, timeFromStart, currentPace);
                Log.d(TAG, "💬 [Native GPS] Completion message: " + message);
                
                // Call TTS Edge Function
                Log.d(TAG, "🌐 [Native GPS] Calling TTS for completion audio...");
                String audioUrl = callTTSEdgeFunction(message);
                
                // Play completion audio and wait for it to finish
                Log.d(TAG, "🔊 [Native GPS] Playing completion audio...");
                playCompletionAudioAndWait(audioUrl);
                
                Log.d(TAG, "✅ [Native GPS] Completion audio finished playing");
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("message", "Completion audio played");
                call.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "❌ [Native GPS] Error generating completion audio: " + e.getMessage(), e);
                JSObject result = new JSObject();
                result.put("success", false);
                result.put("message", e.getMessage());
                call.resolve(result);
            }
        });
    }
    
    private void handleLocationUpdate(Location newLocation) {
        // Filter by accuracy
        if (newLocation.getAccuracy() <= 0 || newLocation.getAccuracy() > 20) {
            Log.w(TAG, "⚠️ [Native GPS] Low accuracy: " + newLocation.getAccuracy() + "m");
            return;
        }
        
        if (lastLocation != null) {
            float distance = lastLocation.distanceTo(newLocation);
            
            // Filter GPS jumps and very small movements
            if (distance >= 3.0f && distance < 20.0f && newLocation.getAccuracy() <= 15) {
                accumulatedDistance += distance;
                
                Log.d(TAG, "📍 [Native GPS] +" + String.format("%.1f", distance) + "m → Total: " + 
                      String.format("%.1f", accumulatedDistance) + "m (accuracy: " + 
                      String.format("%.1f", newLocation.getAccuracy()) + "m)");
                
                // Check 500m milestone
                int currentSegment = (int) (accumulatedDistance / 500.0);
                
                Log.d(TAG, "🔍 [Native GPS] Milestone check:");
                Log.d(TAG, "   → accumulatedDistance: " + String.format("%.1f", accumulatedDistance) + "m");
                Log.d(TAG, "   → currentSegment: " + currentSegment);
                Log.d(TAG, "   → lastFeedbackSegment: " + lastFeedbackSegment);
                Log.d(TAG, "   → shouldGiveFeedback: " + shouldGiveFeedback);
                Log.d(TAG, "   → Will trigger feedback: " + (shouldGiveFeedback && currentSegment > lastFeedbackSegment));
                
                if (shouldGiveFeedback && currentSegment > lastFeedbackSegment) {
                    // Throttle: ensure 2s between feedbacks
                    long now = System.currentTimeMillis();
                    if (now - lastFeedbackAt >= 2000) {
                        lastFeedbackAt = now;
                        lastFeedbackSegment = currentSegment;
                        int meters = currentSegment * 500;
                        Log.d(TAG, "🎯 [Native GPS] " + meters + "m completed - TRIGGERING FEEDBACK NOW");
                        
                        // Generate and play feedback
                        generateAndPlayFeedback(meters);
                    } else {
                        Log.d(TAG, "⏸️ [Native GPS] Throttle active, skipping duplicate feedback");
                    }
                }
                
                // Send event to JavaScript
                JSObject data = new JSObject();
                data.put("latitude", newLocation.getLatitude());
                data.put("longitude", newLocation.getLongitude());
                data.put("accuracy", newLocation.getAccuracy());
                data.put("altitude", newLocation.getAltitude());
                data.put("speed", newLocation.getSpeed());
                data.put("heading", newLocation.getBearing());
                data.put("distance", distance);
                data.put("totalDistance", accumulatedDistance);
                data.put("timestamp", newLocation.getTime());
                notifyListeners("locationUpdate", data);
                
            } else if (distance >= 100) {
                Log.w(TAG, "⚠️ [Native GPS] GPS jump detected: " + String.format("%.1f", distance) + "m - ignored");
            }
        } else {
            Log.d(TAG, "📍 [Native GPS] First location acquired");
        }
        
        lastLocation = newLocation;
    }
    
    // MARK: - Native Feedback Generation
    
    private void generateAndPlayFeedback(int meters) {
        executorService.execute(() -> {
            Log.d(TAG, "🎯 [Native GPS] generateAndPlayFeedback called for " + meters + "m");
            Log.d(TAG, "   → sessionId: " + sessionId);
            
            if (sessionId == null) {
                Log.e(TAG, "❌ [Native GPS] STOPPED: Session ID not configured");
                return;
            }
            
            try {
                // Calculate time from start
                if (sessionStartTime == null) {
                    Log.e(TAG, "❌ [Native GPS] Session start time not available");
                    return;
                }
                int timeFromStart = (int) ((System.currentTimeMillis() - sessionStartTime) / 1000);
                
                // Calculate current pace
                Double currentPace = null;
                if (meters > 0 && timeFromStart > 0) {
                    double distanceKm = meters / 1000.0;
                    double timeMinutes = timeFromStart / 60.0;
                    currentPace = timeMinutes / distanceKm;
                }
                
                // 1. Generate coaching message
                String message = generateCoachingMessage(meters, timeFromStart, currentPace);
                Log.d(TAG, "💬 [Native GPS] Message generated: " + message);
                if (currentPace != null) {
                    Log.d(TAG, "   → pace: " + String.format("%.2f", currentPace) + " min/km");
                }
                Log.d(TAG, "   → time: " + timeFromStart + "s");
                
                // 2. Call Edge Function for TTS
                Log.d(TAG, "🌐 [Native GPS] Calling TTS Edge Function...");
                String audioUrl = callTTSEdgeFunction(message);
                Log.d(TAG, "✅ [Native GPS] TTS returned audio URL (length: " + audioUrl.length() + " chars)");
                
                // 3. Play audio via BioPeakAudioSession
                Log.d(TAG, "🔊 [Native GPS] Attempting to play audio...");
                playFeedbackAudio(audioUrl);
                
                // 4. Save snapshot to Supabase
                saveSnapshotToSupabase(meters);
                
                Log.d(TAG, "✅ [Native GPS] Feedback " + meters + "m completed successfully");
                
            } catch (Exception e) {
                Log.e(TAG, "❌ [Native GPS] Feedback error: " + e.getMessage(), e);
            }
        });
    }
    
    // MARK: - Message Formatting Helpers
    
    private String formatDuration(int seconds) {
        if (seconds < 60) {
            return seconds + " segundos";
        }
        
        int minutes = seconds / 60;
        int remainingSeconds = seconds % 60;
        
        if (remainingSeconds == 0) {
            return minutes == 1 ? "1 minuto" : minutes + " minutos";
        } else {
            String minText = minutes == 1 ? "minuto" : "minutos";
            String secText = remainingSeconds == 1 ? "segundo" : "segundos";
            return minutes + " " + minText + " e " + remainingSeconds + " " + secText;
        }
    }
    
    private String formatPace(double minPerKm) {
        int totalSeconds = (int) (minPerKm * 60);
        int minutes = totalSeconds / 60;
        int seconds = totalSeconds % 60;
        
        if (seconds == 0) {
            return minutes + " minutos por quilômetro";
        } else {
            String minText = minutes == 1 ? "minuto" : "minutos";
            String secText = seconds == 1 ? "segundo" : "segundos";
            return minutes + " " + minText + " e " + seconds + " " + secText + " por quilômetro";
        }
    }
    
    private String generateCoachingMessage(int meters, int timeFromStart, Double pace) {
        String timeText = formatDuration(timeFromStart);
        
        if (pace != null && pace > 0 && pace < 100) {
            String paceText = formatPace(pace);
            return "Você completou " + meters + " metros em " + timeText + ". Seu pace atual é " + paceText + ".";
        } else {
            return "Você completou " + meters + " metros em " + timeText + ". Continue assim!";
        }
    }
    
    private String generateCompletionMessage(int meters, int timeFromStart, Double pace) {
        double distanceKm = meters / 1000.0;
        String distanceText;
        
        if (distanceKm < 1.0) {
            distanceText = meters + " metros";
        } else {
            distanceText = String.format("%.2f quilômetros", distanceKm);
        }
        
        String timeText = formatDuration(timeFromStart);
        
        String message;
        if (pace != null && pace > 0 && pace < 100) {
            String paceText = formatPace(pace);
            message = "Parabéns! Você completou seu treino em " + timeText + ", percorrendo uma distância de " + 
                     distanceText + " em um pace de " + paceText + ". ";
        } else {
            message = "Parabéns! Você completou seu treino em " + timeText + ", percorrendo uma distância de " + 
                     distanceText + ". ";
        }
        
        // Add random motivational phrase
        String[] motivationPhrases = {
            "Excelente desempenho hoje! Continue assim.",
            "Você está evoluindo rápido — orgulhe-se desse treino!",
            "Mais um passo na jornada. Mantenha a constância!",
            "Ótimo trabalho! A cada treino, mais forte.",
            "Treino concluído com sucesso! Descanse bem para o próximo desafio."
        };
        Random random = new Random();
        message += motivationPhrases[random.nextInt(motivationPhrases.length)];
        
        return message;
    }
    
    private String callTTSEdgeFunction(String message) throws Exception {
        if (supabaseUrl == null) {
            Log.e(TAG, "❌ [Native GPS] TTS Error: Supabase URL not configured");
            throw new Exception("Supabase URL not configured");
        }
        
        if (supabaseAnonKey == null) {
            Log.e(TAG, "❌ [Native GPS] TTS Error: Supabase API key not configured");
            throw new Exception("Supabase API key not configured");
        }
        
        String url = supabaseUrl + "/functions/v1/text-to-speech";
        
        JSONObject body = new JSONObject();
        body.put("text", message);
        body.put("voice", "alloy");
        body.put("speed", 1.0);
        
        Log.d(TAG, "📡 [Native GPS] TTS Request:");
        Log.d(TAG, "   → URL: " + url);
        Log.d(TAG, "   → Body: " + body.toString());
        
        RequestBody requestBody = RequestBody.create(
            body.toString(),
            MediaType.parse("application/json")
        );
        
        Request request = new Request.Builder()
            .url(url)
            .post(requestBody)
            .addHeader("Content-Type", "application/json")
            .addHeader("apikey", supabaseAnonKey)
            .addHeader("Authorization", "Bearer " + supabaseAnonKey)
            .build();
        
        Response response = httpClient.newCall(request).execute();
        
        Log.d(TAG, "📥 [Native GPS] TTS Response:");
        Log.d(TAG, "   → Status: " + response.code());
        
        if (!response.isSuccessful()) {
            String responseBody = response.body() != null ? response.body().string() : "Unable to decode";
            Log.e(TAG, "❌ [Native GPS] TTS Error Response Body: " + responseBody);
            throw new Exception("TTS API failed with status " + response.code());
        }
        
        String responseBody = response.body().string();
        JSONObject json = new JSONObject(responseBody);
        
        Log.d(TAG, "   → Has audioContent: " + json.has("audioContent"));
        
        if (!json.has("audioContent")) {
            Log.e(TAG, "❌ [Native GPS] TTS Error: audioContent missing in response");
            throw new Exception("Failed to get audio content");
        }
        
        String audioContent = json.getString("audioContent");
        Log.d(TAG, "✅ [Native GPS] TTS audio content received (length: " + audioContent.length() + " chars)");
        return "data:audio/mpeg;base64," + audioContent;
    }
    
    private void playFeedbackAudio(String audioUrl) {
        getBridge().execute(() -> {
            try {
                Log.d(TAG, "🔊 [Native GPS] Playing feedback audio...");
                
                // Stop any existing playback
                if (feedbackMediaPlayer != null) {
                    feedbackMediaPlayer.release();
                    feedbackMediaPlayer = null;
                }
                
                feedbackMediaPlayer = new MediaPlayer();
                
                // Handle Data URL (base64 audio)
                if (audioUrl.startsWith("data:audio")) {
                    playDataUrl(audioUrl, feedbackMediaPlayer, false);
                } else {
                    feedbackMediaPlayer.setDataSource(audioUrl);
                }
                
                feedbackMediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                );
                
                feedbackMediaPlayer.setOnCompletionListener(mp -> {
                    Log.d(TAG, "✅ [Native GPS] Feedback audio completed");
                    if (mp != null) {
                        mp.release();
                    }
                    feedbackMediaPlayer = null;
                });
                
                feedbackMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    Log.e(TAG, "❌ [Native GPS] Audio error: " + what + ", " + extra);
                    if (mp != null) {
                        mp.release();
                    }
                    feedbackMediaPlayer = null;
                    return false;
                });
                
                feedbackMediaPlayer.prepareAsync();
                feedbackMediaPlayer.setOnPreparedListener(mp -> {
                    mp.start();
                    Log.d(TAG, "▶️ [Native GPS] Feedback audio started");
                });
                
            } catch (Exception e) {
                Log.e(TAG, "❌ [Native GPS] Error playing feedback audio: " + e.getMessage(), e);
            }
        });
    }
    
    private void playCompletionAudioAndWait(String audioUrl) throws InterruptedException {
        audioCompletionLatch = new CountDownLatch(1);
        
        Log.d(TAG, "🔊 [Native GPS] Playing completion audio and waiting...");
        Log.d(TAG, "   → Audio URL length: " + audioUrl.length() + " chars");
        
        getBridge().execute(() -> {
            try {
                // Stop any existing playback
                if (feedbackMediaPlayer != null) {
                    feedbackMediaPlayer.release();
                    feedbackMediaPlayer = null;
                }
                
                feedbackMediaPlayer = new MediaPlayer();
                
                // Handle Data URL (base64 audio)
                if (audioUrl.startsWith("data:audio")) {
                    playDataUrl(audioUrl, feedbackMediaPlayer, true);
                } else {
                    feedbackMediaPlayer.setDataSource(audioUrl);
                }
                
                feedbackMediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                );
                
                feedbackMediaPlayer.setOnCompletionListener(mp -> {
                    Log.d(TAG, "✅ [Native GPS] Completion audio finished");
                    if (mp != null) {
                        mp.release();
                    }
                    feedbackMediaPlayer = null;
                    audioCompletionLatch.countDown();
                });
                
                feedbackMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    Log.e(TAG, "❌ [Native GPS] Completion audio error: " + what + ", " + extra);
                    if (mp != null) {
                        mp.release();
                    }
                    feedbackMediaPlayer = null;
                    audioCompletionLatch.countDown();
                    return false;
                });
                
                feedbackMediaPlayer.prepareAsync();
                feedbackMediaPlayer.setOnPreparedListener(mp -> {
                    mp.start();
                    Log.d(TAG, "▶️ [Native GPS] Completion audio started");
                });
                
            } catch (Exception e) {
                Log.e(TAG, "❌ [Native GPS] Error playing completion audio: " + e.getMessage(), e);
                audioCompletionLatch.countDown();
            }
        });
        
        // Wait for audio to complete (max 30 seconds timeout)
        boolean completed = audioCompletionLatch.await(30, TimeUnit.SECONDS);
        if (!completed) {
            Log.w(TAG, "⚠️ [Native GPS] Audio playback timeout after 30s");
        } else {
            Log.d(TAG, "✅ [Native GPS] Audio playback completed successfully");
        }
    }
    
    private void playDataUrl(String dataUrl, MediaPlayer player, boolean isCompletion) {
        try {
            // Extract base64 data
            String base64Data = dataUrl.split(",")[1];
            byte[] audioBytes = Base64.decode(base64Data, Base64.DEFAULT);
            
            // Save to temporary file
            File tempFile = File.createTempFile("biopeak_" + (isCompletion ? "completion" : "feedback"), ".mp3", getContext().getCacheDir());
            FileOutputStream fos = new FileOutputStream(tempFile);
            fos.write(audioBytes);
            fos.close();
            
            // Set data source
            player.setDataSource(getContext(), Uri.fromFile(tempFile));
            
            Log.d(TAG, "✅ [Native GPS] Data URL decoded and saved to: " + tempFile.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "❌ [Native GPS] Error decoding data URL: " + e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }
    
    // MARK: - Supabase Snapshot Integration
    
    private void saveSnapshotToSupabase(int meters) {
        Log.d(TAG, "📊 [Native GPS] Saving snapshot to Supabase...");
        Log.d(TAG, "   → sessionId: " + sessionId);
        Log.d(TAG, "   → distance: " + meters + "m");
        
        if (sessionId == null) {
            Log.e(TAG, "❌ [Native GPS] Snapshot save failed: Session ID not configured");
            return;
        }
        
        if (sessionStartTime == null) {
            Log.e(TAG, "❌ [Native GPS] Snapshot save failed: Session start time not tracked");
            return;
        }
        
        if (supabaseUrl == null || supabaseAnonKey == null || userToken == null) {
            Log.e(TAG, "❌ [Native GPS] Snapshot save failed: Supabase credentials or user token not configured");
            return;
        }
        
        executorService.execute(() -> {
            try {
                // Calculate time from start
                int timeFromStart = (int) ((System.currentTimeMillis() - sessionStartTime) / 1000);
                
                Log.d(TAG, "   → timeFromStart: " + timeFromStart + "s");
                
                // Validate location data availability
                if (lastLocation == null) {
                    Log.w(TAG, "⚠️ [Native GPS] Snapshot save skipped: No location data available");
                    return;
                }
                
                // Calculate current pace (min/km)
                Double currentPaceMinKm = null;
                if (meters > 0 && timeFromStart > 0) {
                    double distanceKm = meters / 1000.0;
                    double timeMinutes = timeFromStart / 60.0;
                    currentPaceMinKm = timeMinutes / distanceKm;
                }
                
                // Extract location data
                Double currentSpeedMs = lastLocation.hasSpeed() && lastLocation.getSpeed() >= 0 ? 
                    (double) lastLocation.getSpeed() : null;
                double latitude = lastLocation.getLatitude();
                double longitude = lastLocation.getLongitude();
                double elevationMeters = lastLocation.getAltitude();
                
                Log.d(TAG, "📍 [Native GPS] Snapshot GPS Data:");
                Log.d(TAG, "   → pace: " + (currentPaceMinKm != null ? String.format("%.2f", currentPaceMinKm) : "null") + " min/km");
                Log.d(TAG, "   → speed: " + (currentSpeedMs != null ? String.format("%.2f", currentSpeedMs) : "null") + " m/s");
                Log.d(TAG, "   → coords: " + String.format("%.6f", latitude) + ", " + String.format("%.6f", longitude));
                Log.d(TAG, "   → elevation: " + String.format("%.1f", elevationMeters) + "m");
                
                // Prepare enriched snapshot data
                JSONObject snapshotData = new JSONObject();
                snapshotData.put("session_id", sessionId);
                snapshotData.put("snapshot_at_distance_meters", meters);
                snapshotData.put("snapshot_at_duration_seconds", timeFromStart);
                snapshotData.put("latitude", latitude);
                snapshotData.put("longitude", longitude);
                snapshotData.put("elevation_meters", elevationMeters);
                snapshotData.put("source", "native_gps");
                
                // Add optional fields if available
                if (currentPaceMinKm != null) {
                    snapshotData.put("current_pace_min_km", currentPaceMinKm);
                }
                if (currentSpeedMs != null) {
                    snapshotData.put("current_speed_ms", currentSpeedMs);
                }
                
                String url = supabaseUrl + "/rest/v1/performance_snapshots";
                
                RequestBody requestBody = RequestBody.create(
                    snapshotData.toString(),
                    MediaType.parse("application/json")
                );
                
                Request request = new Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("apikey", supabaseAnonKey)
                    .addHeader("Authorization", "Bearer " + userToken)
                    .addHeader("Prefer", "return=representation")
                    .build();
                
                Log.d(TAG, "📡 [Native GPS] Snapshot Request:");
                Log.d(TAG, "   → URL: " + url);
                Log.d(TAG, "   → Body: " + snapshotData.toString());
                
                Response response = httpClient.newCall(request).execute();
                
                Log.d(TAG, "📥 [Native GPS] Snapshot Response:");
                Log.d(TAG, "   → Status: " + response.code());
                
                if (response.isSuccessful()) {
                    String responseBody = response.body() != null ? response.body().string() : "Unable to decode";
                    Log.d(TAG, "✅ [Native GPS] Snapshot saved successfully:");
                    Log.d(TAG, "   → distance: " + meters + "m");
                    Log.d(TAG, "   → time: " + timeFromStart + "s");
                    Log.d(TAG, "   → sessionId: " + sessionId);
                    Log.d(TAG, "   → response: " + responseBody);
                } else {
                    String responseBody = response.body() != null ? response.body().string() : "Unable to decode";
                    Log.e(TAG, "❌ [Native GPS] Snapshot save failed with status " + response.code());
                    Log.e(TAG, "   → response: " + responseBody);
                }
                
            } catch (Exception e) {
                Log.e(TAG, "❌ [Native GPS] Snapshot save error: " + e.getMessage(), e);
            }
        });
    }
    
    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        if (executorService != null) {
            executorService.shutdown();
        }
    }
}
