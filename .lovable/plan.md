
# Fix: App Crash from Efficiency Fingerprint Error

## Problem
The edge function `analyze-efficiency-fingerprint` returns a 400 error ("Not enough valid data points for analysis") when an activity doesn't have enough data. This error propagates as an unhandled promise rejection, crashing the entire app and showing the RootErrorBoundary "app encountered an error" screen.

## Root Cause
When `supabase.functions.invoke` receives a non-2xx response, it can surface the error in a way that escapes the try/catch in the hook -- specifically, the response body parsing may trigger an unhandled rejection. Additionally, there is no global safety net for unhandled promise rejections.

## Plan

### 1. Harden the `useEfficiencyFingerprint` hook
- Wrap the `supabase.functions.invoke` call more defensively
- Treat "not enough data" as a valid empty result (return null) instead of an error
- Ensure the hook never throws -- all errors are captured in state

### 2. Add global `unhandledrejection` handler in `App.tsx`
- Add a `useEffect` with a `window.addEventListener('unhandledrejection', ...)` as a safety net
- This prevents any uncaught async error from crashing the entire app
- Show a toast instead of a white screen

### 3. Make `EfficiencyFingerprintSection` show a friendly message on error
- Instead of returning `null` on error, show a subtle message or simply hide the section gracefully
- Ensure component rendering never crashes even with unexpected data shapes

## Technical Details

**File: `src/hooks/useEfficiencyFingerprint.ts`**
- Add a check: if `result?.error` contains "Not enough valid data" or similar, set data to null and return without throwing
- Double-wrap the entire function invoke in try/catch to handle any unexpected rejection

**File: `src/App.tsx`**
- Add `unhandledrejection` event listener in a useEffect inside the app component
- Call `event.preventDefault()` to prevent the default browser crash behavior

**File: `src/components/EfficiencyFingerprintSection.tsx`**
- Keep returning null on error (the section just won't appear for activities without enough data)
