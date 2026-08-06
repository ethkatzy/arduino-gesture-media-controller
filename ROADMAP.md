# Portfolio Readiness Roadmap

Goal: someone (e.g. a hiring manager) finds this repo on GitHub, has **no Arduino hardware**, and within a couple minutes understands what it does, sees it working, and comes away impressed by the engineering. Ordered by impact.

## 1. Let people see it work without owning the hardware

This is the single biggest gap right now — the app is BLE-dependent on a physical Nano 33 BLE Sense, so nobody can `git clone` and just try it.

- [ ] **Record a demo video/GIF** of the full loop: gesture near the board → phone reacts (volume/play-pause/next track). This is the highest-leverage item on this list — most visitors will watch a 15-second clip before reading a line of code. Embed it at the top of the README.
- [x] **Add a "simulate gesture" debug mode to the app.** Added a `__DEV__`-gated "Simulate Gesture" panel below the BLE status card in `app/(tabs)/index.tsx` — four buttons (`up`/`down`/`left`/`right`) call `handleGestureAction` directly, bypassing BLE entirely, and also update the `Latest Gesture` readout so the status card reacts live. `npx expo start --web` now works with zero hardware.
- [ ] **Screenshot the actual app UI** (not the default Expo icons currently in `assets/images/`) and put 2-3 in the README.

## 2. Rewrite the README

`README.md` is currently unedited `create-expo-app` boilerplate plus one line ("Run npx expo run:android..."). It doesn't mention BLE, gestures, TinyML, or the Arduino side at all — right now the README actively hides the most interesting part of the project.

- [x] **What it is / why it's interesting** — one paragraph: gesture-controlled media player, custom TinyML model running on-device on an Arduino, streamed over BLE to a React Native app.
- [x] **Architecture diagram** (even a simple one, e.g. via Mermaid in the README): IMU sensor → on-device TFLite Micro inference → BLE characteristic → RN app → media control. This is the kind of diagram that signals "this person can explain systems," which matters more to a reviewer than any individual code file.
- [x] **Repo map** — briefly explain the three parts and where they live: the mobile app (`app/`), the firmware that runs inference on-device (`gesture_inference/`), and the training pipeline (`getting_data.ino` + `TINYML.ipynb`).
- [x] **Hardware requirements**, stated explicitly (Arduino Nano 33 BLE Sense or compatible, exact board libraries: `Arduino_LSM9DS1`, `ArduinoBLE`, TensorFlow Lite Micro for Arduino) — and immediately follow it with "no hardware? see the demo video / simulate mode above." *(links to the demo placeholder — swap in the real video/GIF and mention simulate mode once item 1 is built)*
- [x] **Setup instructions** for the app (`npm install`, `npm run lint`, `npx expo start`) — the current README only mentions `expo run:android`. Also flagged that Expo Go won't work (`react-native-ble-plx` is a native module).
- [x] **Model/training summary** — README now states the 4 gesture classes and 100 samples/class training set. No accuracy numbers exist (not tracked during training), so that's called out as a known limitation instead of a fabricated number.
- [x] Remove the leftover generic Expo boilerplate sections once the above replaces them.

## 3. Repo hygiene

Small things, but a cluttered `git ls-files` output is a quiet red flag during a review.

- [x] **Remove the committed `bugreport-sdk_gphone64_x86_64-....zip`** (7.4MB, looks like an accidental Android emulator dump) from the repo, and add `bugreport-*.zip` to `.gitignore`.
- [x] **Stop tracking `.idea/`** (JetBrains project files) — added `.idea/` to `.gitignore` and ran `git rm -r --cached .idea` (files stay on disk, just untracked).
- [x] **Add a `LICENSE` file.** MIT, since there wasn't one.
- [x] **Fill in `package.json` metadata** — added `description`, `author`, `license`, `repository`.
- [x] **Rename the Android package** — `com.anonymous.mediacontroller` → `com.ethankatz.mediacontroller` in `app.json`. Change your GitHub username or preferred namespace if you'd rather use something else.

## 4. Code cleanup

- [x] **Delete dead/commented-out code** in `app/(tabs)/index.tsx` (multiple large commented-out blocks) — dead code left in a portfolio repo reads as unfinished, even if the live code works fine.
- [x] **Normalize code style** — added Prettier (`.prettierrc.json`, `singleQuote: true`, `npm run format`) and ran it across `app/`, `components/`, `hooks/`, `constants/`. `index.tsx`'s cross-directory imports now use the `@/` alias to match the rest of the codebase.
- [x] **Centralize the BLE protocol constants.** Added `BLE_PROTOCOL.md` documenting the service/characteristic UUIDs and device name, with a comment in both `gesture_inference/gesture_inference.ino` and `app/(tabs)/index.tsx` pointing to it so it's obvious they must stay in sync.

## 5. File structure

Right now `getting_data.ino` and `TINYML.ipynb` sit loose at the repo root while `gesture_inference/` (the on-device firmware) has its own folder — the three concerns (app / firmware / training) aren't visually separated, which makes the repo map harder to explain at a glance.

- [x] **Grouped into top-level folders:**
  ```
  /app/                          (Expo/React Native app)
  /firmware/
    gesture_inference/           (on-device inference sketch)
    getting_data/getting_data.ino (data-collection sketch)
  /ml/
    TINYML.ipynb
  ```
- [x] Updated the `add-gesture` skill (`.claude/skills/add-gesture/SKILL.md`), `README.md`, `BLE_PROTOCOL.md`, and the sync comment in `app/(tabs)/index.tsx` to point at the new paths.

## 6. Tests

There's currently no test framework and no test files at all. You don't need hardware to test the parts that matter most for a reviewer skimming for engineering rigor:

- [x] Add **Jest** (`jest-expo` preset is the standard choice for Expo/RN projects). Run with `npm test`.
- [x] Unit test `app/media/MediaPlayer.ts` — self-contained wrapper (play/pause/next/volume/seek), mocked `expo-av`, no hardware needed. Exported the class as `MediaPlayerClass` alongside the existing singleton default export so tests can create isolated instances.
- [x] Unit test the gesture → action mapping logic — extracted `handleGestureAction`'s mapping and 350ms debounce out of `app/(tabs)/index.tsx` into `app/gesture/gestureAction.ts` (`resolveGestureAction`, `isDebounced`) so it's testable without rendering the component or mocking BLE.

## 7. CI

- [x] Added `.github/workflows/ci.yml` that runs `npm ci`, `npm run lint`, and `npm test` on every push to `main` and on every PR.

