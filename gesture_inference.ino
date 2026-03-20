#include <Arduino_LSM9DS1.h>
#include <ArduinoBLE.h>
#include <TensorFlowLite.h>
#include "tensorflow/lite/micro/all_ops_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"
#include "tensorflow/lite/schema/schema_generated.h"
#include "model.h"

const float channel_mean[6] = {0.14859259f, 0.02060060f, 0.94975554f, -0.20826576f, 1.93494248f, -1.02617096f};
const float channel_std[6]  = {0.30779075f, 0.24132932f, 0.16540014f, 45.4774856f, 76.0465240f, 76.1182556f};

const float in_scale  = 0.068951219f;
const int   in_zero   = 7;
const float out_scale = 0.00390625f;
const int   out_zero  = -128;

const char* CLASS_NAMES[] = {"up", "down", "right", "left"};

BLEService gestureService("19B10000-E8F2-537E-4F6C-D104768A1214");

BLEStringCharacteristic gestureChar("19B10001-E8F2-537E-4F6C-D104768A1214",
                                     BLERead | BLENotify, 20);

BLEFloatCharacteristic confidenceChar("19B10002-E8F2-537E-4F6C-D104768A1214",
                                       BLERead | BLENotify);

const tflite::Model* model = nullptr;
tflite::MicroInterpreter* interpreter = nullptr;
TfLiteTensor* input = nullptr;
TfLiteTensor* output = nullptr;
constexpr int kTensorArenaSize = 16 * 1024;
uint8_t tensor_arena[kTensorArenaSize];

// Fast-capture buffer
float raw_recordings[100][6];
int samples_recorded = 0;
bool recording = false;

void setup() {
  Serial.begin(115200);
  
  delay(2000); 

  if (!IMU.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1);
  }

  // --- BLE ---
  if (!BLE.begin()) {
    Serial.println("Failed to start BLE!");
    while (1);
  }

  BLE.setLocalName("GestureBoard");   // Name that shows up when scanning
  BLE.setAdvertisedService(gestureService);

  gestureService.addCharacteristic(gestureChar);
  gestureService.addCharacteristic(confidenceChar);
  BLE.addService(gestureService);

  gestureChar.writeValue("none");
  confidenceChar.writeValue(0.0f);

  BLE.advertise();
  Serial.println("BLE advertising as 'GestureBoard' — connect from your phone/PC!");

  model = tflite::GetModel(gesture_model);
  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(model, resolver, tensor_arena, kTensorArenaSize);
  interpreter = &static_interpreter;
  interpreter->AllocateTensors();

  input  = interpreter->input(0);
  output = interpreter->output(0);

  Serial.println("System Ready! Hold the board FLAT and STILL.");
}

void loop() {
  BLE.poll();

  BLEDevice central = BLE.central();
  if (central) {
    static bool wasConnected = false;
    if (!wasConnected) {
      Serial.print("Connected to: ");
      Serial.println(central.address());
      wasConnected = true;
    }
    if (!central.connected()) {
      Serial.println("Disconnected.");
      wasConnected = false;
    }
  }

  if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable()) {
    float ax, ay, az, gx, gy, gz;
    IMU.readAcceleration(ax, ay, az);
    IMU.readGyroscope(gx, gy, gz);

    if (!recording) {
      if (abs(gx) > 60.0 || abs(gy) > 60.0 || abs(gz) > 60.0) {
        recording = true;
        samples_recorded = 0;
        Serial.println("\n>> MOVEMENT DETECTED! Capturing 100 samples...");
      }
    }

    if (recording) {
      raw_recordings[samples_recorded][0] = ax;
      raw_recordings[samples_recorded][1] = ay;
      raw_recordings[samples_recorded][2] = az;
      raw_recordings[samples_recorded][3] = gx;
      raw_recordings[samples_recorded][4] = gy;
      raw_recordings[samples_recorded][5] = gz;
      samples_recorded++;

      if (samples_recorded == 100) {
        Serial.println(">> Done capturing! Feeding to AI...");

        for (int i = 0; i < 100; i++) {
          for (int c = 0; c < 6; c++) {
            float normalized = (raw_recordings[i][c] - channel_mean[c]) / channel_std[c];
            float scaled = (normalized / in_scale) + in_zero;

            int8_t quantized;
            if (scaled > 127.0f) quantized = 127;
            else if (scaled < -128.0f) quantized = -128;
            else quantized = (int8_t)round(scaled);

            input->data.int8[i * 6 + c] = quantized;
          }
        }

        // Run Inference
        interpreter->Invoke();

        float max_score = -1.0;
        int best_index = -1;

        for (int i = 0; i < 4; i++) {
          int8_t y_q = output->data.int8[i];
          float confidence = (y_q - out_zero) * out_scale;
          if (confidence > max_score) {
            max_score = confidence;
            best_index = i;
          }
        }

        Serial.println("=============================");
        Serial.print("  FINAL AI GUESS: ");
        Serial.println(CLASS_NAMES[best_index]);
        Serial.print("  Confidence: ");
        Serial.println(max_score);
        Serial.println("=============================");

        gestureChar.writeValue(CLASS_NAMES[best_index]);
        confidenceChar.writeValue(max_score);
        Serial.println("[BLE] Gesture sent!");

        Serial.print("[DEBUG] Gravity on Z-axis (az) during swipe: ");
        Serial.println(raw_recordings[0][2]);

        recording = false;
        delay(2000); 
      }
    }
  }
}
