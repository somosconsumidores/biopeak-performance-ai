package com.biopeakai.performance;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Random;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

@CapacitorPlugin(name = "BioPeakLocationTracker")
public class BioPeakLocationTracker extends Plugin {
    private static final String TAG = "BP/LocationPlugin";
    
    private double accumulatedDistance = 0.0;
    private boolean isTracking = false;
    
    // Configuration for Foreground Service
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
    
    // Audio playback for completion audio
    private MediaPlayer feedbackMediaPlayer;
    private CountDownLatch audioCompletionLatch;
    
    // Broadcast receiver for location updates from service
    private BroadcastReceiver locationReceiver;
    
    @Override
    public void load() {
        super.load();
        Log.d(TAG, "🚀 Plugin loaded - will use Foreground Service for GPS");
        
        executorService = Executors.newCachedThreadPool();
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
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
        
        // Register broadcast receiver to listen to service updates
        registerLocationReceiver();
        
        // Start the Foreground Service with current accumulated distance
        Intent serviceIntent = new Intent(getContext(), BioPeakLocationService.class);
        serviceIntent.setAction(BioPeakLocationService.ACTION_START);
        serviceIntent.putExtra("sessionId", sessionId);
        serviceIntent.putExtra("trainingGoal", trainingGoal);
        serviceIntent.putExtra("shouldGiveFeedback", shouldGiveFeedback);
        serviceIntent.putExtra("supabaseUrl", supabaseUrl);
        serviceIntent.putExtra("supabaseAnonKey", supabaseAnonKey);
        serviceIntent.putExtra("userToken", userToken);
        serviceIntent.putExtra("initialDistance", accumulatedDistance); // ✅ Pass current distance to Service
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        
        isTracking = true;
        sessionStartTime = System.currentTimeMillis();
        
        Log.d(TAG, "✅ Foreground Service started for GPS tracking (initialDistance: " + accumulatedDistance + "m)");
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Location tracking started via Foreground Service");
        call.resolve(result);
    }
    
    @PluginMethod
    public void stopLocationTracking(PluginCall call) {
        if (!isTracking) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Not tracking");
            result.put("finalDistance", accumulatedDistance);
            call.resolve(result);
            return;
        }
        
        // Stop the Foreground Service
        Intent serviceIntent = new Intent(getContext(), BioPeakLocationService.class);
        serviceIntent.setAction(BioPeakLocationService.ACTION_STOP);
        getContext().stopService(serviceIntent);
        
        // Give time for final broadcast to arrive before unregistering (100ms)
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            // Unregister broadcast receiver after short delay
            unregisterLocationReceiver();
            
            isTracking = false;
            // ⚠️ DO NOT reset sessionStartTime here - we need it for generateCompletionAudio()
            
            Log.d(TAG, "⏹️ [STOP] Foreground Service stopped");
            Log.d(TAG, "⏹️ [STOP] Accumulated distance at stop: " + accumulatedDistance + "m");
            Log.d(TAG, "⏹️ [STOP] Returning finalDistance: " + accumulatedDistance + "m");
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Location tracking stopped");
            result.put("finalDistance", accumulatedDistance);
            call.resolve(result);
        }, 100); // Wait 100ms for final broadcasts
    }
    
    @PluginMethod
    public void cleanup(PluginCall call) {
        Log.d(TAG, "🧹 Cleaning up all resources...");
        
        // Stop service if running
        if (isTracking) {
            Intent serviceIntent = new Intent(getContext(), BioPeakLocationService.class);
            serviceIntent.setAction(BioPeakLocationService.ACTION_STOP);
            getContext().stopService(serviceIntent);
            unregisterLocationReceiver();
        }
        
        // Release media player
        if (feedbackMediaPlayer != null) {
            feedbackMediaPlayer.release();
            feedbackMediaPlayer = null;
        }
        
        // Reset all state
        sessionStartTime = null;
        sessionId = null;
        trainingGoal = null;
        accumulatedDistance = 0.0;
        shouldGiveFeedback = false;
        supabaseUrl = null;
        supabaseAnonKey = null;
        userToken = null;
        isTracking = false;
        
        Log.d(TAG, "✅ Cleanup completed");
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
        sessionStartTime = null;
        Log.d(TAG, "🔄 Distance reset");
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
        
        Log.d(TAG, "✅ Feedback configured:");
        Log.d(TAG, "   → sessionId: " + sessionId);
        Log.d(TAG, "   → trainingGoal: " + trainingGoal);
        Log.d(TAG, "   → enabled: " + shouldGiveFeedback);
        
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
    
    // MARK: - Broadcast Receiver for Service Updates
    
    private void registerLocationReceiver() {
        locationReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                LocationData data = intent.getParcelableExtra("locationData");
                if (data == null) {
                    Log.w(TAG, "⚠️ [BROADCAST] Received null locationData");
                    return;
                }
                
                // Update local state with distance from service
                double previousDistance = accumulatedDistance;
                accumulatedDistance = data.totalDistance;
                
                Log.d(TAG, "📡 [BROADCAST] Distance sync: " + previousDistance + "m → " + accumulatedDistance + "m");
                
                // Forward to JavaScript
                JSObject jsData = new JSObject();
                jsData.put("latitude", data.latitude);
                jsData.put("longitude", data.longitude);
                jsData.put("accuracy", data.accuracy);
                jsData.put("altitude", data.altitude);
                jsData.put("speed", data.speed);
                jsData.put("heading", data.heading);
                jsData.put("distance", data.distanceIncrement);
                jsData.put("totalDistance", data.totalDistance);
                jsData.put("timestamp", data.timestamp);
                
                notifyListeners("locationUpdate", jsData);
            }
        };
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(
                locationReceiver,
                new IntentFilter(BioPeakLocationService.BROADCAST_LOCATION_UPDATE),
                Context.RECEIVER_NOT_EXPORTED
            );
        } else {
            getContext().registerReceiver(
                locationReceiver,
                new IntentFilter(BioPeakLocationService.BROADCAST_LOCATION_UPDATE)
            );
        }
        
        Log.d(TAG, "📡 Broadcast receiver registered");
    }
    
    private void unregisterLocationReceiver() {
        if (locationReceiver != null) {
            getContext().unregisterReceiver(locationReceiver);
            locationReceiver = null;
            Log.d(TAG, "📡 Broadcast receiver unregistered");
        }
    }
    
    // MARK: - Completion Audio (handled directly by plugin, not service)
    
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
    
    
    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        unregisterLocationReceiver();
        if (feedbackMediaPlayer != null) {
            feedbackMediaPlayer.release();
            feedbackMediaPlayer = null;
        }
        if (executorService != null) {
            executorService.shutdown();
        }
    }
}
