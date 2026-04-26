#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>

const char* SSID     = "Bancayrin Globe 2.4";
const char* PASSWORD = "NeutronColt";
const char* BASE_URL = "http://urchin-app-idc22.ondigitalocean.app/";
const int   PLANT_ID = 1;

#define SENSOR_PIN  34
#define RELAY_PIN   23
#define DRY_VALUE   2559
#define WET_VALUE   1100

String irrigationMode    = "Hybrid";
String scheduleType      = "Daily";
int    scheduleDays      = 1;
String scheduleTime      = "08:00";
int    moistureThreshold = 35;
int    pumpDurationMs    = 3000;
int    drainTimeSec      = 15;
int    hoseLengthCm      = 0;

bool          manualWaterCommand = false;
unsigned long lastConfigFetch    = 0;
const unsigned long CONFIG_INTERVAL = 2000;

WiFiClientSecure secureClient;

// ── NTP time sync ────────────────────────────────────────────────────────────
void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Syncing time");
  struct tm timeinfo;
  int retries = 0;
  while (!getLocalTime(&timeinfo) && retries < 20) {
    Serial.print(".");
    delay(500);
    retries++;
  }
  if (retries < 20) {
    Serial.println("\nTime synced!");
  } else {
    Serial.println("\nTime sync failed — continuing anyway");
  }
}

// ── Sensor helpers ───────────────────────────────────────────────────────────
int readSmoothed(int pin, int samples = 10) {
  long sum = 0;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delay(10);
  }
  return sum / samples;
}

int getMoisturePercent() {
  int raw = readSmoothed(SENSOR_PIN);
  int pct = map(raw, DRY_VALUE, WET_VALUE, 0, 100);
  return constrain(pct, 0, 100);
}

// ── WiFi ─────────────────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.begin(SSID, PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
void clearTriggerOnServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BASE_URL) + "/api/plants/" + String(PLANT_ID) + "/clear-trigger";
  http.begin(secureClient, url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST("{}");
  Serial.print("POST /clear-trigger: ");
  Serial.println(code);
  http.end();
}

void fetchConfig() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BASE_URL) + "/api/plants/" + String(PLANT_ID);
  http.begin(secureClient, url);
  http.setTimeout(10000);
  int code = http.GET();

  if (code == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err) {
      if (!doc["manualTrigger"].isNull() && doc["manualTrigger"].as<bool>()) {
        manualWaterCommand = true;
        clearTriggerOnServer();
        Serial.println("Manual trigger received and cleared on server");
      }

      JsonObject config = doc["config"];
      if (!config.isNull()) {
        irrigationMode    = config["irrigationMode"]    | irrigationMode;
        scheduleType      = config["scheduleType"]      | scheduleType;
        scheduleDays      = config["scheduleDays"]      | scheduleDays;
        scheduleTime      = config["scheduleTime"]      | scheduleTime;
        moistureThreshold = config["moistureThreshold"] | moistureThreshold;
        pumpDurationMs    = config["pumpDurationMs"]    | pumpDurationMs;
        drainTimeSec      = config["drainTimeSec"]      | drainTimeSec;
        hoseLengthCm      = config["hoseLengthCm"]      | hoseLengthCm;
      }

      Serial.println("=== Config refreshed ===");
      Serial.print("  mode=");         Serial.println(irrigationMode);
      Serial.print("  threshold=");    Serial.print(moistureThreshold); Serial.println("%");
      Serial.print("  pumpDuration="); Serial.print(pumpDurationMs);    Serial.println("ms");
      Serial.print("  drainTime=");    Serial.print(drainTimeSec);      Serial.println("s");
      Serial.print("  hoseLengthCm="); Serial.println(hoseLengthCm);
      Serial.print("  manual=");       Serial.println(manualWaterCommand);
    } else {
      Serial.print("JSON parse error: ");
      Serial.println(err.c_str());
    }
  } else {
    Serial.print("Config fetch failed, HTTP: ");
    Serial.println(code);
    if (code < 0) {
      Serial.print("SSL/Connection error: ");
      Serial.println(secureClient.lastError(nullptr, 0));
    }
  }

  http.end();
}

void sendToBackend(int raw, int pct, bool pump) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(BASE_URL) + "/api/sensor";
  http.begin(secureClient, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  StaticJsonDocument<128> doc;
  doc["raw"]      = raw;
  doc["moisture"] = pct;
  doc["pump"]     = pump;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);

  Serial.print("POST /api/sensor: ");
  Serial.println(code);
  http.end();
}

// ── Pump control ─────────────────────────────────────────────────────────────
void pumpOn()  { digitalWrite(RELAY_PIN, LOW);  Serial.println("Pump: ON");  }
void pumpOff() { digitalWrite(RELAY_PIN, HIGH); Serial.println("Pump: OFF"); }

void doWaterSession(const char* reason) {
  Serial.print("Watering reason: ");
  Serial.println(reason);

  pumpOn();
  sendToBackend(readSmoothed(SENSOR_PIN), getMoisturePercent(), true);
  delay(pumpDurationMs);
  pumpOff();
  sendToBackend(readSmoothed(SENSOR_PIN), getMoisturePercent(), false);

  Serial.print("Draining for ");
  Serial.print(drainTimeSec);
  Serial.println("s...");
  delay((unsigned long)drainTimeSec * 1000UL);
}

// ── Watering logic ───────────────────────────────────────────────────────────
bool shouldWater(int moisture) {
  if (irrigationMode == "Manual") {
    if (manualWaterCommand) {
      manualWaterCommand = false;
      return true;
    }
    return false;
  }

  if (irrigationMode == "Automatic") {
    return moisture <= moistureThreshold;
  }

  if (irrigationMode == "Hybrid") {
    if (manualWaterCommand) {
      manualWaterCommand = false;
      return true;
    }
    return moisture <= moistureThreshold;
  }

  return false;
}

// ── Setup & loop ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  pumpOff();

  connectWiFi();
  syncTime();

  // Skip certificate verification — works with any Render/Let's Encrypt cert
  // Replace with a pinned root CA in production if you want full validation
  secureClient.setInsecure();

  fetchConfig();
}

void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting...");
    connectWiFi();
  }

  if (millis() - lastConfigFetch >= CONFIG_INTERVAL) {
    fetchConfig();
    lastConfigFetch = millis();
  }

  int raw      = readSmoothed(SENSOR_PIN);
  int moisture = getMoisturePercent();

  Serial.print("Raw: ");           Serial.print(raw);
  Serial.print(" | Moisture: ");   Serial.print(moisture);
  Serial.print("% | Threshold: "); Serial.print(moistureThreshold);
  Serial.print("% | Mode: ");      Serial.println(irrigationMode);

  if (shouldWater(moisture)) {
    doWaterSession(manualWaterCommand == false ? "auto-threshold" : "manual-trigger");
    fetchConfig();
    lastConfigFetch = millis();
  } else {
    pumpOff();
    sendToBackend(raw, moisture, false);
    delay(2000);
  }
}