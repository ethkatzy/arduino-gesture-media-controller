# Portfolio Readiness Roadmap

Goal: someone (e.g. a hiring manager) finds this repo on GitHub, has **no Arduino hardware**, and within a couple minutes understands what it does, sees it working, and comes away impressed by the engineering. Ordered by impact.

## 1. Let people see it work without owning the hardware

This is the single biggest gap right now — the app is BLE-dependent on a physical Nano 33 BLE Sense, so nobody can `git clone` and just try it.

- [ ] **Record a demo video/GIF** of the full loop: gesture near the board → phone reacts (volume/play-pause/next track). This is the highest-leverage item on this list — most visitors will watch a 15-second clip before reading a line of code. Embed it at the top of the README.
- [ ] **Add a "simulate gesture" debug mode to the app.** In `app/(tabs)/index.tsx`, `handleGestureAction` already takes a gesture string and drives `MediaPlayer` — that logic doesn't care where the string came from. Add a dev-only panel (buttons for `up`/`down`/`left`/`right`) that calls `handleGestureAction` directly, bypassing BLE entirely. Gate it behind `__DEV__` or an env flag. This lets anyone run `npx expo start --web` and actually use the app with zero hardware.
- [ ] **Screenshot the actual app UI** (not the default Expo icons currently in `assets/images/`) and put 2-3 in the README.

## 2. Rewrite the README

`README.md` is currently unedited `create-expo-app` boilerplate plus one line ("Run npx expo run:android..."). It doesn't mention BLE, gestures, TinyML, or the Arduino side at all — right now the README actively hides the most interesting part of the project.

- [x] **What it is / why it's interesting** — one paragraph: gesture-controlled media player, custom TinyML model running on-device on an Arduino, streamed over BLE to a React Native app.
- [x] **Architecture diagram** (even a simple one, e.g. via Mermaid in the README): IMU sensor → on-device TFLite Micro inference → BLE characteristic → RN app → media control. This is the kind of diagram that signals "this person can explain systems," which matters more to a reviewer than any individual code file.
- [x] **Repo map** — briefly explain the three parts and where they live: the mobile app (`app/`), the firmware that runs inference on-device (`gesture_inference/`), and the training pipeline (`getting_data.ino` + `TINYML.ipynb`).
- [x] **Hardware requirements**, stated explicitly (Arduino Nano 33 BLE Sense or compatible, exact board libraries: `Arduino_LSM9DS1`, `ArduinoBLE`, TensorFlow Lite Micro for Arduino) — and immediately follow it with "no hardware? see the demo video / simulate mode above." *(links to the demo placeholder — swap in the real video/GIF and mention simulate mode once item 1 is built)*
- [x] **Setup instructions** for the app (`npm install`, `npm run lint`, `npx expo start`) — the current README only mentions `expo run:android`. Also flagged that Expo Go won't work (`react-native-ble-plx` is a native module).
- [ ] **Model/training summary** — what gestures are classified, roughly how much data, any accuracy numbers you have. Even approximate numbers are more convincing than none. *(README documents the pipeline; still needs real numbers from you — see `TINYML.ipynb`)*
- [x] Remove the leftover generic Expo boilerplate sections once the above replaces them.

## 3. Repo hygiene

Small things, but a cluttered `git ls-files` output is a quiet red flag during a review.

- [x] **Remove the committed `bugreport-sdk_gphone64_x86_64-....zip`** (7.4MB, looks like an accidental Android emulator dump) from the repo, and add `bugreport-*.zip` to `.gitignore`.
- [x] **Stop tracking `.idea/`** (JetBrains project files) — added `.idea/` to `.gitignore` and ran `git rm -r --cached .idea` (files stay on disk, just untracked).
- [x] **Add a `LICENSE` file.** MIT, since there wasn't one.
- [x] **Fill in `package.json` metadata** — added `description`, `author`, `license`, `repository`.
- [x] **Rename the Android package** — `com.anonymous.mediacontroller` → `com.ethankatz.mediacontroller` in `app.json`. Change your GitHub username or preferred namespace if you'd rather use something else.

## 4. Code cleanup

- [ ] **Delete dead/commented-out code** in `app/(tabs)/index.tsx` (multiple large commented-out blocks) — dead code left in a portfolio repo reads as unfinished, even if the live code works fine.
- [ ] **Normalize code style** — the hand-written app code (`index.tsx`, `app/media/MediaPlayer.ts`) uses double quotes and relative imports (`../media/MediaPlayer`), while the scaffolded template code uses single quotes and the `@/` alias. Pick one convention and apply it everywhere (the `eslint --fix` hook now set up in `.claude/settings.local.json` won't catch style since `eslint-config-expo` has no formatting rules — consider adding Prettier if you want this automated).
- [ ] **Centralize the BLE protocol constants.** The service/characteristic UUIDs and device name (`"GestureBoard"`) are duplicated as magic strings in both `gesture_inference/gesture_inference.ino` and `app/(tabs)/index.tsx`. You can't share code across C++/JS, but you can put them in one clearly-commented place in each file (or a small `BLE_PROTOCOL.md`) so it's obvious they must stay in sync.

## 5. File structure

Right now `getting_data.ino` and `TINYML.ipynb` sit loose at the repo root while `gesture_inference/` (the on-device firmware) has its own folder — the three concerns (app / firmware / training) aren't visually separated, which makes the repo map harder to explain at a glance.

- [ ] Consider grouping into top-level folders, e.g.:
  ```
  /app/                 (already exists — the Expo/React Native app)
  /firmware/
    gesture_inference/  (on-device inference sketch, currently at repo root)
    getting_data/       (data-collection sketch)
  /ml/
    TINYML.ipynb
    (any saved training data / exported model artifacts)
  ```
- [ ] Update the `add-gesture` skill (`.claude/skills/add-gesture/SKILL.md`) and README paths if you do this move.

## 6. Tests

There's currently no test framework and no test files at all. You don't need hardware to test the parts that matter most for a reviewer skimming for engineering rigor:

- [x] Add **Jest** (`jest-expo` preset is the standard choice for Expo/RN projects). Run with `npm test`.
- [x] Unit test `app/media/MediaPlayer.ts` — self-contained wrapper (play/pause/next/volume/seek), mocked `expo-av`, no hardware needed. Exported the class as `MediaPlayerClass` alongside the existing singleton default export so tests can create isolated instances.
- [x] Unit test the gesture → action mapping logic — extracted `handleGestureAction`'s mapping and 350ms debounce out of `app/(tabs)/index.tsx` into `app/gesture/gestureAction.ts` (`resolveGestureAction`, `isDebounced`) so it's testable without rendering the component or mocking BLE.

## 7. CI

- [ ] Add a `.github/workflows/ci.yml` that runs `npm ci`, `npm run lint`, and (once added) `npm test` on every push/PR. There's currently no CI at all — even a minimal lint-on-push workflow signals the project is maintained, not abandoned.

## Nice-to-haves (lower priority)

- [ ] Document the training pipeline in a bit more depth: how much data per gesture class, model architecture summary, any accuracy/confusion-matrix numbers from `TINYML.ipynb`.
- [ ] A short "Known limitations" section in the README (e.g. gesture threshold tuning, BLE range/reliability) — shows self-awareness, which reads well in a portfolio context.
- [ ] If you want to go further on the "no hardware needed" front: a short write-up or notebook cell showing the TFLite Micro model's accuracy on a held-out test set.
- [ ] Merge the branches
