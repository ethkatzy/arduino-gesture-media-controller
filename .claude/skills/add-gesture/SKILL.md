---
name: add-gesture
description: Guides adding a new gesture class to the TinyML model — recording training data, retraining, regenerating model.h, and keeping the firmware and app in sync. Use when the user wants to add, retrain, or change a recognized gesture (e.g. "add a new swipe gesture", "retrain the model").
---

Walk the user through this repo's undocumented gesture-training pipeline. Steps, in order:

1. **Record training data** — Open `firmware/getting_data/getting_data.ino` in the Arduino IDE and edit the hardcoded label:
   ```cpp
   currentLabel = "swipe_left"; // CHANGE THIS BEFORE EACH RECORDING
   ```
   Flash it to the Nano 33 BLE Sense, open Serial Monitor, and send `'r'` to start a recording session. Output is CSV: `recordingId,label,ax,ay,az,gx,gy,gz`. Repeat per gesture class, saving each session's CSV output.

2. **Retrain** — Feed the recorded CSVs into `ml/TINYML.ipynb`. This notebook trains the model and exports a quantized TFLite Micro model. Confirm with the user whether they want help running/editing the notebook or are doing that step themselves.

3. **Regenerate `model.h`** — The notebook's output becomes `firmware/gesture_inference/model.h` (a C byte array). When regenerating, the following must be re-extracted from the notebook and kept in sync in `firmware/gesture_inference/gesture_inference.ino`:
   - `channel_mean` / `channel_std` (input normalization)
   - quantization scale/zero-point
   - the gesture label list/order the model was trained on

4. **Update firmware output** — `gesture_inference.ino` classifies into a fixed set of labels (currently `up/down/right/left`) and broadcasts the result as a string over the `19B10001-...` BLE characteristic. If adding a new class, update wherever that label list is used to map model output indices to strings.

5. **Update the app** — `app/(tabs)/index.tsx` maps incoming gesture strings to media-control actions (`handleGestureAction`). Add a case for the new gesture string there. The BLE service/characteristic UUIDs and device name (`GestureBoard`) are duplicated as magic strings in both `gesture_inference.ino` and `index.tsx` — double-check they still match after any firmware change.

6. **Sanity check the trigger threshold** — Gesture capture only starts when `abs(gx/gy/gz) > 60.0` (deg/s) in `gesture_inference.ino`. If the new gesture is subtler or larger than existing ones, this threshold may need adjusting.

Flag to the user explicitly: flashing the Arduino and running the notebook are physical/interactive steps Claude cannot do directly — offer to edit the relevant files but confirm the user will handle the hardware flash and notebook execution themselves unless they've set up a way for you to do so.
