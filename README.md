# Arduino Gesture Media Controller

## Overview

The Gesture Media Controller is a wearable human-computer interaction system designed to provide hands-free media control. It addresses the problem that users cannot easily control media when their hands are occupied, or when interacting with small touch-screen buttons is difficult — such as for accessibility needs or during physical activity.

The system works by pairing an Arduino Nano 33 BLE Sense (worn on a glove) with an Android app. The Arduino uses its built-in gyroscope and accelerometer to detect the user's hand gesture in real time using a TinyML model, then sends the result to the app over Bluetooth Low Energy. The app maps each gesture to a media action and provides immediate visual feedback through light-up buttons, confirming that the gesture was recognised and the instruction is being carried out.

This prototype demonstrates a practical, accessible alternative to touch-screen media controls — particularly useful during physical activity, or for users who find fine motor interaction with small buttons difficult.

---

## How It Works

A final-year mobile project that lets you control music playback on an Android phone using hand gestures detected by an Arduino Nano 33 BLE Sense running a TinyML model.

The Arduino sends gesture classifications over BLE to a React Native (Expo) app. The app interprets the gesture and triggers the corresponding media action.

---

## How It Works

### Arduino (Hardware)
- An Arduino Nano 33 BLE Sense runs a TinyML inference model (`model.h`) trained in the `TINYML.ipynb` notebook.
- It captures IMU sensor data, classifies the gesture in real time, and broadcasts the result over BLE as a GATT characteristic.
- Sketch: `gesture_inference.ino`

### Mobile App (Software)
- Built with **Expo SDK 54** + **React Native 0.81.5**, using the New Architecture (`newArchEnabled=true`).
- Scans for a BLE device named `GestureBoard` on launch and subscribes to gesture + confidence characteristics.
- Gesture → action mapping:
  | Gesture | Action |
  |---------|--------|
  | Left    | Play / Pause |
  | Right   | Next Track |
  | Up      | Volume Up |
  | Down    | Volume Down |
- Audio playback handled by `expo-av` via a singleton `MediaPlayer` class (`app/media/MediaPlayer.ts`).
- Supports adding multiple local audio files and cycling through a playlist.
- Main screen shows track title, progress slider, duration, play/pause + next buttons, and a volume slider.
- BLE status, latest gesture, and confidence score are displayed in a live debug card.

---

## Project Structure

```
gesture_inference.ino   # Arduino sketch
model.h                 # TinyML model weights (generated from TINYML.ipynb)
TINYML.ipynb            # Model training notebook
app/
  (tabs)/
    index.tsx           # Main media player + BLE screen
  media/
    MediaPlayer.ts      # Audio playback singleton (expo-av)
  _layout.tsx           # Root navigation layout
```

---

## Prerequisites

### For the Android app build
- **Node.js** 18+
- **Android Studio** (with Android SDK, NDK 27.1.12297006, Build Tools 36)
- **Java** from Android Studio JBR (`C:\Program Files\Android\Android Studio\jbr`)
- A physical Android device with **USB debugging enabled** and the Expo development client APK installed

> **Windows users**: The Android SDK path must not contain spaces. Map it to a drive letter before building:
> ```powershell
> subst S: "C:\Users\YourName\AppData\Local\Android\Sdk"
> ```
> Also set `GRADLE_USER_HOME=C:\gradle-home` to avoid Gradle cache path issues.

### For the Arduino
- Arduino IDE with the following libraries:
  - `Arduino_LSM9DS1` (IMU)
  - `ArduinoBLE`
  - `TensorFlowLite` (TinyML runtime)

---

## Running the App

### 1. Install dependencies
```bash
npm install
```

### 2. Generate native Android project
```bash
npx expo prebuild --clean
```

### 3. Build and install the APK on your phone (first time or after native changes)

On Windows, run this in PowerShell from the project directory:
```powershell
subst S: "C:\Users\YourName\AppData\Local\Android\Sdk"
$env:JAVA_HOME  = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path       = "$env:JAVA_HOME\bin;S:\platform-tools;$env:Path"
$env:ANDROID_HOME     = 'S:\'
$env:ANDROID_SDK_ROOT = 'S:\'
$env:GRADLE_USER_HOME = 'C:\gradle-home'
$env:_JAVA_OPTIONS    = ''
adb reverse tcp:8081 tcp:8081
npx expo run:android --variant debug
```

### 4. Start the Metro dev server (subsequent runs, APK already installed)
```powershell
adb start-server
adb devices -l
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client
```
Then open the installed app on your phone — it will connect to Metro automatically over USB.

If using Wi-Fi instead of USB, make sure phone and laptop are on the same network and scan the QR code shown in the Metro output.

---

## Uploading the Arduino Sketch

1. Open `gesture_inference.ino` in the Arduino IDE.
2. Select board: **Arduino Nano 33 BLE**.
3. Upload the sketch. The board will start broadcasting BLE as `GestureBoard`.
4. Open the app on your phone — it will scan and connect automatically.

---

## Branch

Active development branch: `feature/ble-app-integration`
