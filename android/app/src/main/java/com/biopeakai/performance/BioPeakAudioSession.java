package com.biopeakai.performance;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "BioPeakAudioSession")
public class BioPeakAudioSession extends Plugin {
    private static final String TAG = "BioPeakAudioSession";
    private AudioManager audioManager;
    private MediaPlayer silentPlayer;
    private MediaPlayer feedbackPlayer;
    private AudioFocusRequest audioFocusRequest;
    private boolean isAudioSessionActive = false;

    @Override
    public void load() {
        super.load();
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        Log.d(TAG, "✅ BioPeakAudioSession plugin loaded");
    }

    @PluginMethod
    public void startAudioSession(PluginCall call) {
        try {
            Log.d(TAG, "🎵 Starting audio session...");
            
            // Request audio focus
            requestAudioFocus();
            
            // Start silent audio loop
            startSilentAudioLoop();
            
            isAudioSessionActive = true;
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Audio session started successfully");
            call.resolve(result);
            
            Log.d(TAG, "✅ Audio session started successfully");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error starting audio session: " + e.getMessage(), e);
            call.reject("Failed to start audio session", e);
        }
    }

    @PluginMethod
    public void stopAudioSession(PluginCall call) {
        try {
            Log.d(TAG, "🛑 Stopping audio session...");
            
            stopSilentAudioLoop();
            abandonAudioFocus();
            
            isAudioSessionActive = false;
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Audio session stopped");
            call.resolve(result);
            
            Log.d(TAG, "✅ Audio session stopped");
        } catch (Exception e) {
            Log.e(TAG, "❌ Error stopping audio session: " + e.getMessage(), e);
            call.reject("Failed to stop audio session", e);
        }
    }

    @PluginMethod
    public void setAudioCategory(PluginCall call) {
        String category = call.getString("category", "playback");
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("category", category);
        result.put("options", new String[]{});
        call.resolve(result);
        
        Log.d(TAG, "✅ Audio category set to: " + category);
    }

    @PluginMethod
    public void startSilentAudio(PluginCall call) {
        try {
            startSilentAudioLoop();
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Silent audio started");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start silent audio", e);
        }
    }

    @PluginMethod
    public void stopSilentAudio(PluginCall call) {
        try {
            stopSilentAudioLoop();
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Silent audio stopped");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop silent audio", e);
        }
    }

    @PluginMethod
    public void playAudioFile(PluginCall call) {
        String url = call.getString("url");
        
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }
        
        try {
            Log.d(TAG, "🎵 Playing audio file...");
            
            // Stop any current feedback
            stopFeedbackPlayer();
            
            feedbackPlayer = new MediaPlayer();
            
            if (url.startsWith("data:audio")) {
                // Handle Data URL (base64)
                playDataUrl(url);
            } else if (url.startsWith("http://") || url.startsWith("https://")) {
                // Handle HTTP URL
                feedbackPlayer.setDataSource(url);
            } else {
                call.reject("Unsupported URL format");
                return;
            }
            
            feedbackPlayer.setAudioAttributes(
                new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .build()
            );
            
            feedbackPlayer.setOnCompletionListener(mp -> {
                Log.d(TAG, "✅ Audio playback completed");
                stopFeedbackPlayer();
            });
            
            feedbackPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "❌ Audio playback error: " + what + ", " + extra);
                stopFeedbackPlayer();
                return false;
            });
            
            feedbackPlayer.prepareAsync();
            feedbackPlayer.setOnPreparedListener(mp -> {
                mp.start();
                Log.d(TAG, "▶️ Audio playback started");
            });
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Audio started");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error playing audio: " + e.getMessage(), e);
            call.reject("Failed to play audio", e);
        }
    }

    @PluginMethod
    public void stopFeedbackAudio(PluginCall call) {
        stopFeedbackPlayer();
        
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    // ========== Private Helper Methods ==========

    private void requestAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(focusChange -> handleAudioFocusChange(focusChange))
                .build();
            
            int result = audioManager.requestAudioFocus(audioFocusRequest);
            Log.d(TAG, "Audio focus request result: " + result);
        } else {
            audioManager.requestAudioFocus(
                focusChange -> handleAudioFocusChange(focusChange),
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }
    }

    private void abandonAudioFocus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
        } else {
            audioManager.abandonAudioFocus(focusChange -> {});
        }
    }

    private void handleAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
                Log.d(TAG, "⚠️ Audio focus lost - pausing");
                pauseAllAudio();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                Log.d(TAG, "⚠️ Audio focus lost temporarily - pausing");
                pauseAllAudio();
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                Log.d(TAG, "✅ Audio focus gained - resuming");
                resumeAllAudio();
                break;
        }
    }

    private void startSilentAudioLoop() {
        if (silentPlayer != null) {
            Log.d(TAG, "⚠️ Silent audio already running");
            return;
        }
        
        try {
            silentPlayer = MediaPlayer.create(getContext(), R.raw.silence);
            if (silentPlayer != null) {
                silentPlayer.setLooping(true);
                silentPlayer.setVolume(0.01f, 0.01f); // Very low volume
                silentPlayer.start();
                Log.d(TAG, "✅ Silent audio loop started");
            } else {
                Log.e(TAG, "❌ Failed to create silent MediaPlayer");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error starting silent audio: " + e.getMessage(), e);
        }
    }

    private void stopSilentAudioLoop() {
        if (silentPlayer != null) {
            try {
                if (silentPlayer.isPlaying()) {
                    silentPlayer.stop();
                }
                silentPlayer.release();
                silentPlayer = null;
                Log.d(TAG, "✅ Silent audio loop stopped");
            } catch (Exception e) {
                Log.e(TAG, "❌ Error stopping silent audio: " + e.getMessage(), e);
            }
        }
    }

    private void stopFeedbackPlayer() {
        if (feedbackPlayer != null) {
            try {
                if (feedbackPlayer.isPlaying()) {
                    feedbackPlayer.stop();
                }
                feedbackPlayer.release();
                feedbackPlayer = null;
                Log.d(TAG, "✅ Feedback player stopped");
            } catch (Exception e) {
                Log.e(TAG, "❌ Error stopping feedback: " + e.getMessage(), e);
            }
        }
    }

    private void pauseAllAudio() {
        if (silentPlayer != null && silentPlayer.isPlaying()) {
            silentPlayer.pause();
        }
        if (feedbackPlayer != null && feedbackPlayer.isPlaying()) {
            feedbackPlayer.pause();
        }
    }

    private void resumeAllAudio() {
        if (silentPlayer != null && !silentPlayer.isPlaying()) {
            silentPlayer.start();
        }
        if (feedbackPlayer != null && !feedbackPlayer.isPlaying()) {
            feedbackPlayer.start();
        }
    }

    private void playDataUrl(String dataUrl) throws IOException {
        // Extract base64 data from Data URL
        String base64Data = dataUrl.substring(dataUrl.indexOf(",") + 1);
        byte[] audioData = Base64.decode(base64Data, Base64.DEFAULT);
        
        // Save to temporary file
        File tempFile = File.createTempFile("feedback_audio", ".mp3", getContext().getCacheDir());
        FileOutputStream fos = new FileOutputStream(tempFile);
        fos.write(audioData);
        fos.close();
        
        // Set data source
        feedbackPlayer.setDataSource(tempFile.getAbsolutePath());
        
        // Delete temp file when done
        feedbackPlayer.setOnCompletionListener(mp -> {
            tempFile.delete();
            stopFeedbackPlayer();
        });
    }

    @Override
    protected void handleOnDestroy() {
        stopSilentAudioLoop();
        stopFeedbackPlayer();
        abandonAudioFocus();
        super.handleOnDestroy();
    }
}
