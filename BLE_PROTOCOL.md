# BLE Protocol

The Arduino firmware (`gesture_inference/gesture_inference.ino`) and the mobile app
(`app/(tabs)/index.tsx`) talk over a custom BLE GATT service. C++ and JS can't share a
constants file, so these values are duplicated in both places — **if you change one, change
both**.

| Constant            | Value                                  |
| -------------------- | --------------------------------------- |
| Device name           | `GestureBoard`                          |
| Service UUID          | `19B10000-E8F2-537E-4F6C-D104768A1214`  |
| Gesture characteristic UUID    | `19B10001-E8F2-537E-4F6C-D104768A1214`  |
| Confidence characteristic UUID | `19B10002-E8F2-537E-4F6C-D104768A1214`  |

- **Gesture characteristic** — UTF-8 string (`BLEStringCharacteristic`, notify), one of
  `"up"`, `"down"`, `"left"`, `"right"`. The app lowercases it and maps it to a media action
  in `app/gesture/gestureAction.ts`.
- **Confidence characteristic** — 32-bit little-endian float (`BLEFloatCharacteristic`,
  notify), the model's confidence for the most recent gesture.
