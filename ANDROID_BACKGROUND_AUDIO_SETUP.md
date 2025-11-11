# Android Background Audio Setup - BioPeak

## Overview
Android implementation mirrors iOS background audio functionality using native MediaPlayer, AudioManager, and Foreground Service integration.

## Native Plugin Architecture

### BioPeakAudioSession.java
Located: `android/app/src/main/java/com/biopeakai/performance/BioPeakAudioSession.java`

**Key Features:**
- **AudioManager Integration**: Manages audio focus for handling phone calls and interruptions
- **Silent Audio Loop**: Plays `silence.mp3` in loop to keep audio session active
- **MediaPlayer for TTS**: Handles both Data URLs (base64) and HTTP URLs for feedback audio
- **AudioFocusRequest**: Proper handling of audio focus changes (calls, notifications)

**Main Methods:**
```java
@PluginMethod startAudioSession()    // Initialize audio session + silent loop
@PluginMethod stopAudioSession()     // Clean up all audio resources
@PluginMethod playAudioFile()        // Play TTS feedback (Data URL or HTTP)
@PluginMethod stopFeedbackAudio()    // Stop current feedback playback
```

## Implementation Differences vs iOS

| Feature | iOS | Android |
|---------|-----|---------|
| Audio Session | AVAudioSession | AudioManager + AudioFocusRequest |
| Silent Audio | AVAudioPlayer | MediaPlayer (R.raw.silence) |
| TTS Playback | AVAudioPlayer | MediaPlayer |
| Interruption Handling | AVAudioSessionInterruptionNotification | AudioFocusRequest.OnAudioFocusChangeListener |
| Background Mode | Info.plist `audio` background mode | Foreground Service |

## Required Files

### 1. Silent Audio Resource
**Location:** `android/app/src/main/res/raw/silence.mp3`
- Short silent audio file (1-2 seconds)
- Played in loop to maintain audio session
- Volume set to 0.01 to be inaudible

### 2. MainActivity Registration
**Location:** `android/app/src/main/java/com/biopeakai/performance/MainActivity.java`
```java
@Override
public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    registerPlugin(BioPeakAudioSession.class);
}
```

### 3. AndroidManifest.xml
**Permissions Required:**
```xml
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

## Audio Focus Handling

The plugin handles three audio focus states:

1. **AUDIOFOCUS_GAIN**: Resume all audio playback
2. **AUDIOFOCUS_LOSS**: Permanent loss - pause all audio
3. **AUDIOFOCUS_LOSS_TRANSIENT**: Temporary loss (call) - pause, resume when regained

## Integration with Foreground Service

The BioPeakAudioSession works alongside the existing Foreground Service:

1. **Foreground Service** keeps the app process alive
2. **BioPeakAudioSession** maintains audio session and plays feedback
3. Both are started when training session begins
4. Both are stopped when training session ends

## React Integration

### useBackgroundAudio Hook
The existing `useBackgroundAudio.ts` hook now works for both iOS and Android:

```typescript
// Detects platform automatically
const isNative = Capacitor.isNativePlatform();

// Starts audio session on both platforms
await BioPeakAudioSession.startAudioSession();
```

### Menu Visibility
**Header.tsx** now shows "BioPeak AI Coach" on both iOS and Android:
```typescript
...(isNative ? [{ name: 'BioPeak AI Coach', href: '/training' }] : [])
```

## Testing Checklist

### Basic Functionality
- [ ] Start training session
- [ ] Verify silent audio loop starts
- [ ] Receive TTS feedback every 1km
- [ ] Stop training session
- [ ] Verify all audio resources released

### Background Scenarios
- [ ] Put app in background - TTS continues
- [ ] Lock screen - TTS continues
- [ ] Switch to another app - TTS continues

### Interruption Handling
- [ ] Receive phone call during training
- [ ] Verify audio pauses during call
- [ ] Verify audio resumes after call ends
- [ ] Test with Bluetooth headphones
- [ ] Test with wired headphones

### Edge Cases
- [ ] Start/stop multiple training sessions rapidly
- [ ] Kill app during training (recovery on restart)
- [ ] Low battery scenarios
- [ ] Notification sounds don't interrupt TTS

## Troubleshooting

### TTS Not Playing in Background
1. Check Foreground Service is running (notification visible)
2. Verify `MODIFY_AUDIO_SETTINGS` permission granted
3. Check logcat for audio focus issues: `adb logcat | grep BioPeakAudioSession`

### Silent Audio Not Looping
1. Verify `silence.mp3` exists in `res/raw/`
2. Check file is actually silent (not corrupted)
3. Verify MediaPlayer.setLooping(true) is called

### Audio Not Resuming After Call
1. Check AudioFocusRequest listener is registered
2. Verify `handleAudioFocusChange()` receives AUDIOFOCUS_GAIN
3. Test with different audio output devices

## Logcat Monitoring

Filter logs for debugging:
```bash
adb logcat | grep -E "BioPeakAudioSession|MediaPlayer|AudioFocus"
```

**Key Log Messages:**
- `✅ Audio session started successfully` - Session initialized
- `🎵 Playing audio file...` - TTS feedback starting
- `⚠️ Audio focus lost` - Interruption detected
- `✅ Audio focus gained` - Resuming after interruption

## Performance Considerations

1. **Memory**: MediaPlayer instances are properly released after use
2. **Battery**: Silent audio uses minimal volume (0.01) and efficient codec
3. **CPU**: Foreground Service + AudioSession combined use ~1-2% CPU during training

## Future Improvements

- [ ] Support for multiple audio streams (TTS + music)
- [ ] Ducking instead of pausing for notifications
- [ ] Custom audio effects (EQ, reverb)
- [ ] Audio routing preferences (speaker/headphones)

## Comparison with iOS

Both platforms now have **feature parity**:
- ✅ Background TTS feedback
- ✅ Silent audio loop maintenance
- ✅ Interruption handling (calls)
- ✅ Menu item "BioPeak AI Coach"
- ✅ Proper cleanup on session end
