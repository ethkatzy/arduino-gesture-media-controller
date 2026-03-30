#include <Arduino_LSM9DS1.h>

const int sampleRateHz = 100;
const int windowSize = 100;  // 100 samples = 1 second at 100Hz
const unsigned long sampleInterval = 1000 / sampleRateHz;

String currentLabel = "swipe_left";  // CHANGE THIS BEFORE EACH RECORDING
int recordingId = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial)
    ;

  if (!IMU.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1)
      ;
  }
}

void loop() {
  if (Serial.available()) {
    char command = Serial.read();

    if (command == 'r') {
      recordGesture();
    }
  }
}

void recordGesture() {

  unsigned long startTime = millis();
  int samplesCollected = 0;

  while (samplesCollected < windowSize) {
    if (millis() - startTime >= sampleInterval) {
      startTime += sampleInterval;

      float ax, ay, az;
      float gx, gy, gz;

      if (IMU.accelerationAvailable() && IMU.gyroscopeAvailable()) {
        IMU.readAcceleration(ax, ay, az);
        IMU.readGyroscope(gx, gy, gz);

        Serial.print(recordingId);
        Serial.print(",");
        Serial.print(currentLabel);
        Serial.print(",");
        Serial.print(ax, 6);
        Serial.print(",");
        Serial.print(ay, 6);
        Serial.print(",");
        Serial.print(az, 6);
        Serial.print(",");
        Serial.print(gx, 6);
        Serial.print(",");
        Serial.print(gy, 6);
        Serial.print(",");
        Serial.println(gz, 6);

        samplesCollected++;
      }
    }
  }
  recordingId++;
}