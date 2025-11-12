package com.biopeakai.performance;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Random;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class BioPeakLocationService extends Service {
    private static final String TAG = "BP/LocationService";
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "biopeak_gps_tracking";
    
    public static final String ACTION_START = "com.biopeakai.START_TRACKING";
    public static final String ACTION_STOP = "com.biopeakai.STOP_TRACKING";
    public static final String BROADCAST_LOCATION_UPDATE = "com.biopeakai.LOCATION_UPDATE";
    
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private Location lastLocation;
    private double accumulatedDistance = 0.0;
    
    // Feedback control
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
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "🚀 Service onCreate()");
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        executorService = Executors.newCachedThreadPool();
        httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
    }
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            Log.e(TAG, "❌ Service started with null intent");
            return START_NOT_STICKY;
        }
        
        String action = intent.getAction();
        Log.d(TAG, "📥 onStartCommand: action=" + action);
        
        if (ACTION_START.equals(action)) {
            // Extract configuration from intent
            sessionId = intent.getStringExtra("sessionId");
            trainingGoal = intent.getStringExtra("trainingGoal");
            shouldGiveFeedback = intent.getBooleanExtra("shouldGiveFeedback", true);
            supabaseUrl = intent.getStringExtra("supabaseUrl");
            supabaseAnonKey = intent.getStringExtra("supabaseAnonKey");
            userToken = intent.getStringExtra("userToken");
            
            Log.d(TAG, "📋 Configuration:");
            Log.d(TAG, "   → sessionId: " + sessionId);
            Log.d(TAG, "   → trainingGoal: " + trainingGoal);
            Log.d(TAG, "   → feedback enabled: " + shouldGiveFeedback);
            
            // Start foreground service
            createNotificationChannel();
            startForeground(NOTIFICATION_ID, createNotification());
            
            // Start GPS tracking
            startLocationTracking();
            
        } else if (ACTION_STOP.equals(action)) {
            stopLocationTracking();
            stopForeground(true);
            stopSelf();
        }
        
        return START_STICKY; // Service will be recreated if killed by system
    }
    
    private void startLocationTracking() {
        Log.d(TAG, "🎯 Starting location tracking...");
        
        // Check permissions
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "❌ Location permission not granted");
            return;
        }
        
        // Reset state
        accumulatedDistance = 0.0;
        lastLocation = null;
        sessionStartTime = System.currentTimeMillis();
        lastFeedbackSegment = 0;
        
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
        
        Log.d(TAG, "✅ Location tracking started in Foreground Service");
    }
    
    private void stopLocationTracking() {
        Log.d(TAG, "⏹️ Stopping location tracking...");
        
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        
        Log.d(TAG, "✅ Location tracking stopped - Final distance: " + accumulatedDistance + "m");
    }
    
    private void handleLocationUpdate(Location newLocation) {
        // Filter by accuracy
        if (newLocation.getAccuracy() <= 0 || newLocation.getAccuracy() > 20) {
            Log.w(TAG, "⚠️ Low accuracy: " + newLocation.getAccuracy() + "m");
            return;
        }
        
        if (lastLocation != null) {
            float distance = lastLocation.distanceTo(newLocation);
            
            // Filter GPS jumps and very small movements
            if (distance >= 3.0f && distance < 100.0f && newLocation.getAccuracy() <= 15) {
                accumulatedDistance += distance;
                
                Log.d(TAG, "📍 +" + String.format("%.1f", distance) + "m → Total: " + 
                      String.format("%.1f", accumulatedDistance) + "m (accuracy: " + 
                      String.format("%.1f", newLocation.getAccuracy()) + "m)");
                
                // Update notification with current distance
                updateNotification();
                
                // Check 500m milestone
                int currentSegment = (int) (accumulatedDistance / 500.0);
                
                if (shouldGiveFeedback && currentSegment > lastFeedbackSegment) {
                    // Throttle: ensure 2s between feedbacks
                    long now = System.currentTimeMillis();
                    if (now - lastFeedbackAt >= 2000) {
                        lastFeedbackAt = now;
                        lastFeedbackSegment = currentSegment;
                        int meters = currentSegment * 500;
                        Log.d(TAG, "🎯 " + meters + "m milestone reached - TRIGGERING FEEDBACK");
                        
                        // Generate and play feedback
                        generateAndPlayFeedback(meters);
                    }
                }
                
                // Send broadcast to plugin
                sendLocationBroadcast(newLocation, distance);
                
            } else if (distance >= 100) {
                Log.w(TAG, "⚠️ GPS jump detected: " + String.format("%.1f", distance) + "m - ignored");
            }
        } else {
            Log.d(TAG, "📍 First location acquired");
        }
        
        lastLocation = newLocation;
    }
    
    private void sendLocationBroadcast(Location location, float distanceIncrement) {
        Intent intent = new Intent(BROADCAST_LOCATION_UPDATE);
        
        LocationData data = new LocationData();
        data.latitude = location.getLatitude();
        data.longitude = location.getLongitude();
        data.accuracy = location.getAccuracy();
        data.altitude = location.getAltitude();
        data.speed = location.getSpeed();
        data.heading = location.getBearing();
        data.distanceIncrement = distanceIncrement;
        data.totalDistance = accumulatedDistance;
        data.timestamp = location.getTime();
        
        intent.putExtra("locationData", data);
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent);
    }
    
    // MARK: - Notification Management
    
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "BioPeak GPS Tracking",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Rastreamento de localização durante treino");
            channel.setShowBadge(false);
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
    
    private Notification createNotification() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BioPeak Treino Ativo")
            .setContentText("Rastreando: 0.0 km")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setShowWhen(false);
        
        return builder.build();
    }
    
    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        
        double distanceKm = accumulatedDistance / 1000.0;
        String text = String.format("Rastreando: %.2f km", distanceKm);
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("BioPeak Treino Ativo")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setShowWhen(false);
        
        manager.notify(NOTIFICATION_ID, builder.build());
    }
    
    // MARK: - Feedback Generation
    
    private void generateAndPlayFeedback(int meters) {
        executorService.execute(() -> {
            Log.d(TAG, "🎯 Generating feedback for " + meters + "m");
            
            if (sessionId == null || sessionStartTime == null) {
                Log.e(TAG, "❌ Session not configured properly");
                return;
            }
            
            try {
                // Calculate metrics
                int timeFromStart = (int) ((System.currentTimeMillis() - sessionStartTime) / 1000);
                
                Double currentPace = null;
                if (meters > 0 && timeFromStart > 0) {
                    double distanceKm = meters / 1000.0;
                    double timeMinutes = timeFromStart / 60.0;
                    currentPace = timeMinutes / distanceKm;
                }
                
                // Generate coaching message
                String message = generateCoachingMessage(meters, timeFromStart, currentPace);
                Log.d(TAG, "💬 Message: " + message);
                
                // Call TTS Edge Function
                String audioUrl = callTTSEdgeFunction(message);
                
                // Play audio
                playFeedbackAudio(audioUrl);
                
                // Save snapshot to Supabase
                saveSnapshotToSupabase(meters, timeFromStart, currentPace);
                
                Log.d(TAG, "✅ Feedback completed for " + meters + "m");
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Feedback error: " + e.getMessage(), e);
            }
        });
    }
    
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
    
    private String callTTSEdgeFunction(String message) throws Exception {
        if (supabaseUrl == null || supabaseAnonKey == null) {
            throw new Exception("Supabase credentials not configured");
        }
        
        String url = supabaseUrl + "/functions/v1/text-to-speech";
        
        JSONObject body = new JSONObject();
        body.put("text", message);
        body.put("voice", "alloy");
        body.put("speed", 1.0);
        
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
        
        if (!response.isSuccessful()) {
            throw new Exception("TTS API failed with status " + response.code());
        }
        
        String responseBody = response.body().string();
        JSONObject json = new JSONObject(responseBody);
        
        if (!json.has("audioContent")) {
            throw new Exception("Failed to get audio content");
        }
        
        String audioContent = json.getString("audioContent");
        return "data:audio/mpeg;base64," + audioContent;
    }
    
    private void playFeedbackAudio(String audioUrl) {
        try {
            Log.d(TAG, "🔊 Playing feedback audio...");
            
            // Stop any existing playback
            if (feedbackMediaPlayer != null) {
                feedbackMediaPlayer.release();
                feedbackMediaPlayer = null;
            }
            
            feedbackMediaPlayer = new MediaPlayer();
            
            // Handle Data URL (base64 audio)
            if (audioUrl.startsWith("data:audio")) {
                String base64Data = audioUrl.split(",")[1];
                byte[] audioBytes = Base64.decode(base64Data, Base64.DEFAULT);
                
                File tempFile = File.createTempFile("biopeak_feedback", ".mp3", getCacheDir());
                FileOutputStream fos = new FileOutputStream(tempFile);
                fos.write(audioBytes);
                fos.close();
                
                feedbackMediaPlayer.setDataSource(this, Uri.fromFile(tempFile));
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
                Log.d(TAG, "✅ Feedback audio completed");
                if (mp != null) {
                    mp.release();
                }
                feedbackMediaPlayer = null;
            });
            
            feedbackMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "❌ Audio error: " + what + ", " + extra);
                if (mp != null) {
                    mp.release();
                }
                feedbackMediaPlayer = null;
                return false;
            });
            
            feedbackMediaPlayer.prepareAsync();
            feedbackMediaPlayer.setOnPreparedListener(mp -> {
                mp.start();
                Log.d(TAG, "▶️ Feedback audio started");
            });
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error playing feedback audio: " + e.getMessage(), e);
        }
    }
    
    private void saveSnapshotToSupabase(int meters, int timeFromStart, Double currentPace) {
        if (sessionId == null || lastLocation == null) {
            Log.w(TAG, "⚠️ Snapshot save skipped: missing data");
            return;
        }
        
        if (supabaseUrl == null || supabaseAnonKey == null || userToken == null) {
            Log.e(TAG, "❌ Snapshot save failed: Supabase credentials not configured");
            return;
        }
        
        executorService.execute(() -> {
            try {
                Double currentSpeedMs = lastLocation.hasSpeed() && lastLocation.getSpeed() >= 0 ? 
                    (double) lastLocation.getSpeed() : null;
                
                JSONObject snapshotData = new JSONObject();
                snapshotData.put("session_id", sessionId);
                snapshotData.put("snapshot_at_distance_meters", meters);
                snapshotData.put("snapshot_at_duration_seconds", timeFromStart);
                snapshotData.put("latitude", lastLocation.getLatitude());
                snapshotData.put("longitude", lastLocation.getLongitude());
                snapshotData.put("elevation_meters", lastLocation.getAltitude());
                snapshotData.put("source", "native_gps");
                
                if (currentPace != null) {
                    snapshotData.put("current_pace_min_km", currentPace);
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
                
                Response response = httpClient.newCall(request).execute();
                
                if (response.isSuccessful()) {
                    Log.d(TAG, "✅ Snapshot saved: " + meters + "m");
                } else {
                    Log.e(TAG, "❌ Snapshot save failed: " + response.code());
                }
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Snapshot save error: " + e.getMessage(), e);
            }
        });
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "🧹 Service onDestroy() - Cleaning up...");
        
        stopLocationTracking();
        
        if (feedbackMediaPlayer != null) {
            feedbackMediaPlayer.release();
            feedbackMediaPlayer = null;
        }
        
        if (executorService != null) {
            executorService.shutdown();
        }
        
        Log.d(TAG, "✅ Service destroyed");
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not a bound service
    }
}
