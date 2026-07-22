import type { WorkspaceNode, WorkspaceEdge, ComponentType, WireColor } from '@/types'

export interface WiringTemplate {
  name: string
  description: string
  code?: string
  nodes: { type: ComponentType; id: string; position: { x: number; y: number }; properties?: Record<string, any> }[]
  edges: { sourceNodeId: string; sourcePinId: string; targetNodeId: string; targetPinId: string; color: WireColor }[]
}

export const FAULT_TOLERANT_AIRCRAFT_CODE = `/* =========================================================
   FAULT-TOLERANT AIRCRAFT SUBSYSTEM - ESP32 DEVKIT V1
   Median Voting Fault Detection | Graduated Sensor Response
   BREADBOARD BUILD - Diode-ORed Dual Battery + Supercap, 4-wire PC fan
   Rev. 4 - fixed fan-stall latch/flap bug (stall now latches until
            a deliberate cooldown + retry, instead of self-clearing
            every cycle because controlMotor() ran before checkFanStall()).
   ========================================================= */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);   // Common real-world address, change to 0x3F if blank

// ---------------- I2C PINS ----------------
const int I2C_SDA = 21;
const int I2C_SCL = 22;

// ---------------- SENSOR PINS (ADC1 only - safe with WiFi) ----------------
const int SENSOR_1 = 4;
const int SENSOR_2 = 5;
const int SENSOR_3 = 26;

// ---------------- OUTPUT PINS ----------------
const int LED_GREEN  = 18;
const int LED_YELLOW = 19;
const int LED_RED    = 23;
const int BUZZER = 2;

// ---------------- 4-WIRE PC FAN ----------------
const int FAN_PWM_PIN    = 13;
const int FAN_TACH_PIN   = 27;
const int FAN_CUTOFF_PIN = 14;   // drives Q1 gate; HIGH=fan enabled, LOW=hard cutoff

const int FAN_PWM_CH   = 0;
const int FAN_PWM_FREQ = 25000;
const int FAN_PWM_RES  = 8;

const int FAN_DUTY_FULL     = 255; // 100% - normal, running off either battery
const int FAN_DUTY_SUPERCAP = 140; // ~55% - reduced speed to stretch reserve
const int FAN_DUTY_LOW      = 60;  // ~24% - reserve critically low, minimum useful speed

// ---------------- FAN STALL DETECTION ----------------
const int FAN_STALL_RPM_THRESHOLD = 300;        // below this while commanded = suspect stall
const unsigned long FAN_STALL_TIME_MS = 5000;   // must persist this long before declaring stall
const unsigned long FAN_RETRY_COOLDOWN_MS = 30000; // wait this long before trying to spin it again
const int FAN_RETRY_GOOD_READS_NEEDED = 3;      // consecutive good RPM readings to un-latch

bool fanStalled = false;
bool fanCommanded = false;          // what controlMotor() WANTS to do, ignoring stall latch
unsigned long fanStallTimerStart = 0;
unsigned long fanStallLatchedAt = 0;
int fanGoodReadStreak = 0;

volatile unsigned long tachPulseCount = 0;
int fanRPM = 0;

void IRAM_ATTR onTachPulse() {
  tachPulseCount++;
}

// ---------------- POWER SOURCE VOLTAGE SENSE PINS (all ADC1) ----------------
const int MAIN_BATT_ADC   = 34;   // VP - 100k/33k divider
const int BACKUP_BATT_ADC = 35;   // VN - 100k/33k divider
const int USB_SENSE = 32;   // digital presence only, informational

const float BATTERY_DIVIDER_RATIO = 4.03;      // (100k+33k)/33k
const float BATTERY_LOW_VOLTAGE     = 9.5;      // below this -> declare battery down
const float BATTERY_RESTORE_VOLTAGE = 10.0;     // must rise above this -> declare battery back
                                                 // (0.5V hysteresis band prevents flapping)

// ---------------- SUPERCAPACITOR VOLTAGE SENSE ----------------
const int SUPERCAP_ADC = 33;
const float DIVIDER_RATIO = 5.545;              // (100k+22k)/22k

const float SUPERCAP_MIN_VOLTAGE     = 9.0;     // below this -> declare reserve unavailable
const float SUPERCAP_RESTORE_VOLTAGE = 9.3;     // must rise above this -> declare available again

const float SUPERCAP_LOW_VOLTAGE   = 10.0;      // below this -> drop from reduced to min fan speed
const float SUPERCAP_LOW_RESTORE   = 10.3;      // must rise above this -> back to reduced speed

bool supercapAvailable   = true;   // hysteresis-gated: usable at all
bool supercapReducedTier = true;   // hysteresis-gated: reduced-speed vs minimum-speed band

// ---------------- CONSTANTS ----------------
const float FAULT_THRESHOLD = 10.0;
const float MIN_VALID_TEMP  = 0.0;
const float MAX_VALID_TEMP  = 60.0;

unsigned long lastRead = 0;
const unsigned long READ_INTERVAL = 1000;

unsigned long lastDisplay = 0;
const unsigned long DISPLAY_INTERVAL = 2200;

// ---------------- STATE VARIABLES ----------------
float temp[3];
bool faulty[3] = {false, false, false};
String reason[3] = {"", "", ""};
int faultCount = 0;

bool mainPowerOK   = true;
bool backupPowerOK = true;
bool usbPresent      = true;
bool powerLost        = false;
String activeSource   = "MAIN";
String controlSource  = "USB";

float mainBattVoltage   = 0.0;
float backupBattVoltage = 0.0;

bool motorRunning = false;
unsigned long uptimeSeconds = 0;

float supercapVoltage = 0.0;

enum ScreenMode { MODE_POWER_LOST, MODE_CRITICAL, MODE_HEALTHY };
ScreenMode currentMode = MODE_HEALTHY;
ScreenMode lastMode = MODE_HEALTHY;
int screenStep = 0;

byte warnIcon[8]  = {0b00100,0b00100,0b00100,0b00100,0b00100,0b00000,0b00100,0b00000};
byte battIcon[8]  = {0b01110,0b11111,0b10001,0b10001,0b10001,0b10001,0b11111,0b00000};
byte motorIcon[8] = {0b00000,0b01010,0b11111,0b01010,0b11111,0b01010,0b00000,0b00000};

void setup() {
  Serial.begin(115200);

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  pinMode(USB_SENSE, INPUT_PULLDOWN);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  ledcSetup(FAN_PWM_CH, FAN_PWM_FREQ, FAN_PWM_RES);
  ledcAttachPin(FAN_PWM_PIN, FAN_PWM_CH);
  ledcWrite(FAN_PWM_CH, FAN_DUTY_FULL);

  pinMode(FAN_TACH_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FAN_TACH_PIN), onTachPulse, FALLING);

  pinMode(FAN_CUTOFF_PIN, OUTPUT);
  digitalWrite(FAN_CUTOFF_PIN, HIGH);   // fan enabled by default (100k gate-to-source
                                         // resistor keeps Q1 OFF, not floating, if this
                                         // line is ever tri-stated during boot)

  Wire.begin(I2C_SDA, I2C_SCL);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.createChar(1, warnIcon);
  lcd.createChar(2, battIcon);
  lcd.createChar(3, motorIcon);

  bootAnimation();
  printBanner();
}

void loop() {
  if (millis() - lastRead >= READ_INTERVAL) {
    lastRead = millis();
    uptimeSeconds++;
    readSensors();
    detectFault();
    checkPower();
    readSupercap();
    calcFanRPM();
    checkFanStall();   // now runs BEFORE controlMotor(), and uses fanCommanded
    controlMotor();
    updateLEDsAndBuzzer();
    printStatusReport();
  }

  if (millis() - lastDisplay >= DISPLAY_INTERVAL) {
    lastDisplay = millis();
    updateDisplay();
  }
}

void bootAnimation() {
  lcd.setCursor(0, 0);
  lcd.print("SYSTEM BOOTING");
  lcd.setCursor(0, 1);
  for (int i = 0; i < 3; i++) { lcd.print("."); delay(400); }
  delay(600);
  lcd.clear();
}

void printBanner() {
  Serial.println();
  Serial.println(F("+=======================================================+"));
  Serial.println(F("|   FAULT-TOLERANT AIRCRAFT SUBSYSTEM  -  ESP32 ONLINE  |"));
  Serial.println(F("|   Median Voting | Dual Battery+Supercap | Stall Chk   |"));
  Serial.println(F("+=======================================================+"));
  Serial.println();
}

void printCentered(String text, int row) {
  int pad = (16 - text.length()) / 2;
  if (pad < 0) pad = 0;
  lcd.setCursor(pad, row);
  lcd.print(text);
}

float readTemp(int pin)
{
    long sum = 0;

    for (int i = 0; i < 10; i++)
    {
        sum += analogRead(pin);
        delay(2);
    }

    float adcValue = sum / 10.0;

    float voltage = adcValue * (3.3 / 4095.0);

    // LM35: 10mV per °C
    float temperature = voltage * 100.0;

    return temperature;
}

void readSensors() {
  temp[0] = readTemp(SENSOR_1);
  temp[1] = readTemp(SENSOR_2);
  temp[2] = readTemp(SENSOR_3);
}

void detectFault() {
  faultCount = 0;
  for (int i = 0; i < 3; i++) { faulty[i] = false; reason[i] = ""; }

  for (int i = 0; i < 3; i++) {
    if (temp[i] < MIN_VALID_TEMP || temp[i] > MAX_VALID_TEMP) {
      faulty[i] = true;
      reason[i] = "RANGE";
    }
  }

  float sorted[3] = {temp[0], temp[1], temp[2]};
  if (sorted[0] > sorted[1]) { float t = sorted[0]; sorted[0] = sorted[1]; sorted[1] = t; }
  if (sorted[1] > sorted[2]) { float t = sorted[1]; sorted[1] = sorted[2]; sorted[2] = t; }
  if (sorted[0] > sorted[1]) { float t = sorted[0]; sorted[0] = sorted[1]; sorted[1] = t; }
  float median = sorted[1];

  for (int i = 0; i < 3; i++) {
    if (!faulty[i] && abs(temp[i] - median) > FAULT_THRESHOLD) {
      faulty[i] = true;
      reason[i] = "DEVIATION";
    }
  }

  for (int i = 0; i < 3; i++) if (faulty[i]) faultCount++;
}

float readBatteryVoltage(int pin) {
  uint32_t mv = analogReadMilliVolts(pin);
  return (mv / 1000.0) * BATTERY_DIVIDER_RATIO;
}

// ---------- DUAL BATTERY CHECK - analog voltage with hysteresis ----------
void checkPower() {
  bool prevPowerLost = powerLost;
  String prevSource = activeSource;

  mainBattVoltage   = readBatteryVoltage(MAIN_BATT_ADC);
  backupBattVoltage = readBatteryVoltage(BACKUP_BATT_ADC);
  usbPresent         = (digitalRead(USB_SENSE) == HIGH);

  if (mainPowerOK) { if (mainBattVoltage < BATTERY_LOW_VOLTAGE) mainPowerOK = false; }
  else             { if (mainBattVoltage >= BATTERY_RESTORE_VOLTAGE) mainPowerOK = true; }

  if (backupPowerOK) { if (backupBattVoltage < BATTERY_LOW_VOLTAGE) backupPowerOK = false; }
  else                { if (backupBattVoltage >= BATTERY_RESTORE_VOLTAGE) backupPowerOK = true; }

  powerLost = !mainPowerOK && !backupPowerOK;

  if (mainPowerOK)            activeSource = "MAIN";
  else if (backupPowerOK)     activeSource = "BACKUP";
  else if (supercapAvailable) activeSource = "SUPERCAP (EMERGENCY)";
  else                        activeSource = "NONE";

  controlSource = usbPresent ? "USB" : "BATTERY (5V reg)";

  if (activeSource != prevSource) {
    Serial.print(F(">>> [FAN POWER] Active source: "));
    Serial.println(activeSource);
  }

  if (powerLost && !prevPowerLost)
    Serial.println(F(">>> [POWER] BOTH BATTERIES LOST - RAIL now held up by supercap only"));
  if (!powerLost && prevPowerLost)
    Serial.println(F(">>> [POWER] BATTERY RESTORED - ALARM CLEARED"));
}

// ---------- SUPERCAP BANK VOLTAGE - hysteresis on both tiers ----------
void readSupercap() {
  uint32_t mv = analogReadMilliVolts(SUPERCAP_ADC);
  supercapVoltage = (mv / 1000.0) * DIVIDER_RATIO;

  bool wasAvailable = supercapAvailable;
  if (supercapAvailable) { if (supercapVoltage < SUPERCAP_MIN_VOLTAGE) supercapAvailable = false; }
  else                   { if (supercapVoltage >= SUPERCAP_RESTORE_VOLTAGE) supercapAvailable = true; }

  if (supercapReducedTier) { if (supercapVoltage < SUPERCAP_LOW_VOLTAGE) supercapReducedTier = false; }
  else                      { if (supercapVoltage >= SUPERCAP_LOW_RESTORE) supercapReducedTier = true; }

  if (!supercapAvailable && wasAvailable) {
    Serial.println(F(">>> [SUPERCAP] Reserve below usable voltage - LM7805 near dropout"));
  }
  if (supercapAvailable && !wasAvailable) {
    Serial.println(F(">>> [SUPERCAP] Reserve recharged above usable voltage"));
  }
}

void calcFanRPM() {
  noInterrupts();
  unsigned long pulses = tachPulseCount;
  tachPulseCount = 0;
  interrupts();
  fanRPM = (pulses * 60) / 2;   // 2 pulses/rev, measured over 1s
}

// ---------- FAN STALL DETECTION ----------
// Runs BEFORE controlMotor() each cycle, and judges against fanCommanded
// (what we WANT the fan doing) rather than motorRunning (which controlMotor
// may have just zeroed out on a previous cycle). Once latched, fanStalled
// stays true through a cooldown period, then requires several consecutive
// good RPM readings before clearing - so a genuinely dead fan doesn't just
// get re-tried and re-declared every 5 seconds forever.
void checkFanStall() {
  if (fanCommanded) {
    if (fanRPM < FAN_STALL_RPM_THRESHOLD) {
      if (fanStallTimerStart == 0) fanStallTimerStart = millis();
      if (!fanStalled && millis() - fanStallTimerStart >= FAN_STALL_TIME_MS) {
        fanStalled = true;
        fanStallLatchedAt = millis();
        fanGoodReadStreak = 0;
        Serial.println(F(">>> [FAN] STALL DETECTED - commanded to run but RPM too low"));
      }
    } else {
      // fan is actually spinning fine right now
      fanStallTimerStart = 0;
      if (fanStalled) {
        fanGoodReadStreak++;
        if (fanGoodReadStreak >= FAN_RETRY_GOOD_READS_NEEDED) {
          fanStalled = false;
          fanGoodReadStreak = 0;
          Serial.println(F(">>> [FAN] Stall condition cleared - fan confirmed spinning"));
        }
      }
    }
  } else {
    // we're not asking the fan to spin right now (e.g. sensors untrusted)
    fanStallTimerStart = 0;
  }

  // If latched, periodically allow controlMotor() to retest the fan
  // instead of holding cutoff forever with no way back.
  if (fanStalled && (millis() - fanStallLatchedAt >= FAN_RETRY_COOLDOWN_MS)) {
    Serial.println(F(">>> [FAN] Cooldown elapsed - retrying fan"));
    fanStallLatchedAt = millis();  // reset cooldown window for the next retry
    fanStalled = false;            // allow controlMotor() to command it on again;
                                    // if it's still not spinning, the 5s timer above
                                    // will re-latch it and start a new cooldown
    fanStallTimerStart = 0;
    fanGoodReadStreak = 0;
  }
}

// ---------- FAN CONTROL: PWM speed + hardware MOSFET cutoff ----------
void controlMotor() {
  bool sensorsOK = (faultCount <= 1);
  fanCommanded = sensorsOK && !fanStalled;

  if (!sensorsOK || fanStalled) {
    if (motorRunning) {
      motorRunning = false;
      Serial.print(F(">>> [FAN] HARD CUTOFF (MOSFET) - "));
      if (fanStalled) Serial.println(F("fan stall detected"));
      else { Serial.print(faultCount); Serial.println(F(" sensors faulty - system untrustworthy")); }
    }
    digitalWrite(FAN_CUTOFF_PIN, LOW);
    ledcWrite(FAN_PWM_CH, 0);
    return;
  }

  digitalWrite(FAN_CUTOFF_PIN, HIGH);

  if (!powerLost) {
    motorRunning = true;
    ledcWrite(FAN_PWM_CH, FAN_DUTY_FULL);
  } else if (supercapReducedTier) {
    motorRunning = true;
    ledcWrite(FAN_PWM_CH, FAN_DUTY_SUPERCAP);
  } else if (supercapAvailable) {
    motorRunning = true;
    ledcWrite(FAN_PWM_CH, FAN_DUTY_LOW);
  } else {
    motorRunning = false;
    ledcWrite(FAN_PWM_CH, 0);
  }
}

void updateLEDsAndBuzzer() {
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_RED, LOW);
  noTone(BUZZER);

  if (fanStalled || powerLost) {
    digitalWrite(LED_RED, HIGH);
    tone(BUZZER, 1000, 300);
  } else if (faultCount >= 2) {
    digitalWrite(LED_RED, HIGH);
    tone(BUZZER, 1000, 300);
  } else if (faultCount == 1) {
    digitalWrite(LED_YELLOW, HIGH);
    tone(BUZZER, 2000, 150);
  } else {
    digitalWrite(LED_GREEN, HIGH);
  }
}

void printStatusReport() {
  Serial.println(F("---------------------------------------------------------"));
  Serial.print(F("  UPTIME : ")); Serial.print(uptimeSeconds); Serial.println(F(" s"));

  Serial.println(F("  SENSOR READINGS"));
  for (int i = 0; i < 3; i++) {
    Serial.print(F("    S")); Serial.print(i + 1); Serial.print(F(" : "));
    Serial.print(temp[i], 2); Serial.print(F(" C   "));
    if (faulty[i]) { Serial.print(F("[FAULTY - ")); Serial.print(reason[i]); Serial.println(F("]")); }
    else Serial.println(F("[OK]"));
  }

  Serial.print(F("  FAULT COUNT   : ")); Serial.print(faultCount); Serial.println(F(" / 3"));

  Serial.println(F("  POWER"));
  Serial.print(F("    MAIN BATTERY    : ")); Serial.print(mainBattVoltage, 2);
  Serial.print(F(" V  [")); Serial.print(mainPowerOK ? F("OK") : F("DOWN")); Serial.println(F("]"));
  Serial.print(F("    BACKUP BATTERY  : ")); Serial.print(backupBattVoltage, 2);
  Serial.print(F(" V  [")); Serial.print(backupPowerOK ? F("OK") : F("DOWN")); Serial.println(F("]"));
  Serial.print(F("    FAN ACTIVE SRC  : ")); Serial.println(activeSource);
  Serial.print(F("    RAIL/SUPERCAP   : ")); Serial.print(supercapVoltage, 2); Serial.println(F(" V"));
  Serial.print(F("    ESP32 CTRL SRC  : ")); Serial.println(controlSource);

  Serial.print(F("  FAN           : ")); Serial.print(motorRunning ? F("RUNNING") : F("CUTOFF"));
  Serial.print(F("   RPM: ")); Serial.print(fanRPM);
  Serial.println(fanStalled ? F("   [STALL]") : F(""));

  Serial.print(F("  STATUS        : "));
  if (fanStalled) Serial.println(F("CRITICAL - FAN STALL DETECTED"));
  else if (powerLost && !supercapAvailable) Serial.println(F("CRITICAL - BATTERIES + SUPERCAP RESERVE EXHAUSTED"));
  else if (faultCount == 3) Serial.println(F("CRITICAL - ALL SENSORS FAILED"));
  else if (faultCount == 2) Serial.println(F("CRITICAL - INSUFFICIENT VALID DATA"));
  else if (powerLost) Serial.println(F("DEGRADED - RUNNING ON SUPERCAP RESERVE"));
  else if (faultCount == 1) Serial.println(F("DEGRADED - 1 FAULT, SYSTEM STILL TRUSTED"));
  else Serial.println(F("HEALTHY - FULL REDUNDANCY ACTIVE"));
  Serial.println(F("---------------------------------------------------------"));
  Serial.println();
}

void updateDisplay() {
  if (fanStalled || powerLost) currentMode = MODE_POWER_LOST;
  else if (faultCount >= 2) currentMode = MODE_CRITICAL;
  else currentMode = MODE_HEALTHY;

  if (currentMode != lastMode) { screenStep = 0; lastMode = currentMode; }

  lcd.clear();

  switch (currentMode) {
    case MODE_POWER_LOST:
      if (fanStalled) {
        printCentered("FAN STALL!", 0);
        printCentered("CHECK MOTOR", 1);
      } else if (screenStep == 0) {
        printCentered("BATTERIES DOWN", 0);
        lcd.setCursor(1, 1);
        lcd.write(byte(1));
        lcd.print(supercapAvailable ? " ON SUPERCAP" : " RESERVE LOW");
      } else {
        printCentered("RAIL VOLTAGE", 0);
        char buf[16];
        dtostrf(supercapVoltage, 4, 2, buf);
        printCentered(String(buf) + "V", 1);
      }
      screenStep = (screenStep + 1) % 2;
      break;

    case MODE_CRITICAL:
      if (screenStep == 0) {
        printCentered(String(faultCount) + " SENSORS DOWN", 0);
        printCentered("FAN CUTOFF", 1);
      } else if (screenStep == 1) {
        String list = "";
        for (int i = 0; i < 3; i++) if (faulty[i]) list += "S" + String(i + 1) + " ";
        printCentered("FAULTY SENSORS:", 0);
        printCentered(list, 1);
      } else {
        printCentered("FAN PWR: " + activeSource, 0);
        printCentered("FAN CUTOFF", 1);
      }
      screenStep = (screenStep + 1) % 3;
      break;

    case MODE_HEALTHY:
      if (screenStep < 3) {
        showSensorScreen(screenStep);
      } else if (screenStep == 3) {
        printCentered("FAN STATUS", 0);
        lcd.setCursor(1, 1);
        lcd.write(byte(3));
        lcd.print(motorRunning ? (" " + String(fanRPM) + "RPM") : " STOPPED");
      } else {
        printCentered("CTRL: " + controlSource, 0);
        lcd.setCursor(2, 1);
        lcd.write(byte(2));
        lcd.print(" FAN:" + activeSource.substring(0, 7));
      }
      screenStep = (screenStep + 1) % 5;
      break;
  }
}

void showSensorScreen(int i) {
  char buf[16];
  dtostrf(temp[i], 6, 2, buf);
  if (faulty[i]) {
    printCentered("S" + String(i + 1) + " FAULT!", 0);
    printCentered(String(buf) + "C " + reason[i], 1);
  } else {
    printCentered("SENSOR " + String(i + 1) + " - OK", 0);
    printCentered(String(buf) + (char)223 + "C", 1);
  }
}
`

export const FAULT_TOLERANT_NODES: { type: ComponentType; id: string; position: { x: number; y: number }; properties?: Record<string, any> }[] = [
  { type: 'esp32-devkit', id: 'esp32-1', position: { x: 40, y: 140 }, properties: { name: 'Flight Computer ESP32', rotation: 0 } },
  { type: 'lcd1602', id: 'lcd-1', position: { x: 340, y: 20 }, properties: { name: 'Subsystem Status LCD', rotation: 0 } },
  { type: 'breadboard', id: 'breadboard-1', position: { x: 320, y: 160 }, properties: { name: 'Sensing & Power Breadboard', rotation: 0, splitPowerRails: false } },
  { type: 'lm35', id: 'sensor-1', position: { x: 380, y: 110 }, properties: { name: 'Redundant Sensor 1 (S1)', temperature: 25, rotation: 0 } },
  { type: 'lm35', id: 'sensor-2', position: { x: 480, y: 110 }, properties: { name: 'Redundant Sensor 2 (S2)', temperature: 25, rotation: 0 } },
  { type: 'lm35', id: 'sensor-3', position: { x: 580, y: 110 }, properties: { name: 'Redundant Sensor 3 (S3)', temperature: 25, rotation: 0 } },
  { type: 'resistor', id: 'res-g', position: { x: 380, y: 380 }, properties: { name: 'Green LED Resistor', resistance: 220, rotation: 0 } },
  { type: 'led', id: 'led-g', position: { x: 440, y: 380 }, properties: { name: 'Healthy (Green)', color: '#10b981', rotation: 90 } },
  { type: 'resistor', id: 'res-y', position: { x: 480, y: 380 }, properties: { name: 'Yellow LED Resistor', resistance: 220, rotation: 0 } },
  { type: 'led', id: 'led-y', position: { x: 540, y: 380 }, properties: { name: 'Degraded (Yellow)', color: '#f59e0b', rotation: 90 } },
  { type: 'resistor', id: 'res-r', position: { x: 580, y: 380 }, properties: { name: 'Red LED Resistor', resistance: 220, rotation: 0 } },
  { type: 'led', id: 'led-r', position: { x: 640, y: 380 }, properties: { name: 'Critical (Red)', color: '#ef4444', rotation: 90 } },
  { type: 'buzzer', id: 'buzzer-1', position: { x: 680, y: 380 }, properties: { name: 'Alarm Buzzer', rotation: 0 } },
  { type: 'pc-fan', id: 'fan-1', position: { x: 380, y: 480 }, properties: { name: '4-Wire Cooling Fan', speed: 0, rpm: 0, rotation: 0 } },
  { type: 'lm7805', id: 'reg-5v', position: { x: 290, y: 480 }, properties: { name: 'LM7805 5V Regulator', voltage: 5, rotation: 0 } },
  { type: 'n-mosfet', id: 'q1', position: { x: 500, y: 480 }, properties: { name: 'Q1 Cutoff MOSFET (IRLZ44N)', rotation: 0 } },
  { type: 'resistor', id: 'res-gate', position: { x: 500, y: 440 }, properties: { name: 'Gate Pulldown Resistor (100kΩ)', resistance: 100000, rotation: 0 } },
  { type: 'battery-12v', id: 'batt-main', position: { x: 20, y: 480 }, properties: { name: 'Main Battery VP (12V)', voltage: 12.0, rotation: 0 } },
  { type: 'fuse', id: 'fuse-main', position: { x: 100, y: 480 }, properties: { name: 'Main Battery Fuse (1A)', currentLimit: 1.0, blown: false, rotation: 0 } },
  { type: 'toggle-switch-spst', id: 'switch-main', position: { x: 160, y: 480 }, properties: { name: 'Main Supply Cutoff Switch', state: true, rotation: 0 } },
  { type: 'schottky-diode', id: 'diode-main', position: { x: 220, y: 480 }, properties: { name: 'Main OR-ing Diode (1N5822)', rotation: 0 } },
  { type: 'battery-12v', id: 'batt-backup', position: { x: 20, y: 600 }, properties: { name: 'Backup Battery VN (12V)', voltage: 12.0, rotation: 0 } },
  { type: 'fuse', id: 'fuse-backup', position: { x: 100, y: 600 }, properties: { name: 'Backup Battery Fuse (1A)', currentLimit: 1.0, blown: false, rotation: 0 } },
  { type: 'toggle-switch-spst', id: 'switch-backup', position: { x: 160, y: 600 }, properties: { name: 'Backup Supply Switch', state: true, rotation: 0 } },
  { type: 'schottky-diode', id: 'diode-backup', position: { x: 220, y: 600 }, properties: { name: 'Backup OR-ing Diode (1N5822)', rotation: 0 } },
  { type: 'super-capacitor', id: 'supercap-bank', position: { x: 300, y: 600 }, properties: { name: 'Emergency Supercap Bank (11V)', capacitance: 1.0, voltage: 11.0, storedVoltage: 11.0, rotation: 0 } }
]

export const FAULT_TOLERANT_EDGES: { sourceNodeId: string; sourcePinId: string; targetNodeId: string; targetPinId: string; color: WireColor }[] = [
  // LCD I2C
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio21', targetNodeId: 'lcd-1', targetPinId: 'sda', color: 'yellow' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio22', targetNodeId: 'lcd-1', targetPinId: 'scl', color: 'yellow' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'vin_out', targetNodeId: 'lcd-1', targetPinId: 'vcc', color: 'red' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gnd', targetNodeId: 'lcd-1', targetPinId: 'gnd', color: 'black' },
  // Breadboard Main Power Rails Feed
  { sourceNodeId: 'esp32-1', sourcePinId: '3v3', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-pos-1', color: 'red' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gnd', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-neg-1', color: 'black' },
  { sourceNodeId: 'breadboard-1', sourcePinId: 'rail-top-neg-30', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-30', color: 'black' },
  // Sensors wired through Breadboard Sensing Holes & Rails
  { sourceNodeId: 'sensor-1', sourcePinId: 'vcc', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-pos-6', color: 'red' },
  { sourceNodeId: 'sensor-1', sourcePinId: 'gnd', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-neg-6', color: 'black' },
  { sourceNodeId: 'sensor-1', sourcePinId: 'out', targetNodeId: 'breadboard-1', targetPinId: 'hole-a-8', color: 'blue' },
  { sourceNodeId: 'breadboard-1', sourcePinId: 'hole-e-8', targetNodeId: 'esp32-1', targetPinId: 'gpio4', color: 'blue' },
  { sourceNodeId: 'sensor-2', sourcePinId: 'vcc', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-pos-14', color: 'red' },
  { sourceNodeId: 'sensor-2', sourcePinId: 'gnd', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-neg-14', color: 'black' },
  { sourceNodeId: 'sensor-2', sourcePinId: 'out', targetNodeId: 'breadboard-1', targetPinId: 'hole-a-16', color: 'blue' },
  { sourceNodeId: 'breadboard-1', sourcePinId: 'hole-e-16', targetNodeId: 'esp32-1', targetPinId: 'gpio5', color: 'blue' },
  { sourceNodeId: 'sensor-3', sourcePinId: 'vcc', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-pos-22', color: 'red' },
  { sourceNodeId: 'sensor-3', sourcePinId: 'gnd', targetNodeId: 'breadboard-1', targetPinId: 'rail-top-neg-22', color: 'black' },
  { sourceNodeId: 'sensor-3', sourcePinId: 'out', targetNodeId: 'breadboard-1', targetPinId: 'hole-a-24', color: 'blue' },
  { sourceNodeId: 'breadboard-1', sourcePinId: 'hole-e-24', targetNodeId: 'esp32-1', targetPinId: 'gpio26', color: 'blue' },
  // LEDs & Buzzer wired through Breadboard Bottom Rows & GND Rail
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio18', targetNodeId: 'breadboard-1', targetPinId: 'hole-f-4', color: 'green' },
  { sourceNodeId: 'res-g', sourcePinId: 'a', targetNodeId: 'breadboard-1', targetPinId: 'hole-j-4', color: 'green' },
  { sourceNodeId: 'res-g', sourcePinId: 'b', targetNodeId: 'breadboard-1', targetPinId: 'hole-j-7', color: 'green' },
  { sourceNodeId: 'led-g', sourcePinId: 'anode', targetNodeId: 'breadboard-1', targetPinId: 'hole-f-7', color: 'green' },
  { sourceNodeId: 'led-g', sourcePinId: 'cathode', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-7', color: 'black' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio19', targetNodeId: 'breadboard-1', targetPinId: 'hole-f-12', color: 'yellow' },
  { sourceNodeId: 'res-y', sourcePinId: 'a', targetNodeId: 'breadboard-1', targetPinId: 'hole-j-12', color: 'yellow' },
  { sourceNodeId: 'res-y', sourcePinId: 'b', targetNodeId: 'breadboard-1', targetPinId: 'hole-j-15', color: 'yellow' },
  { sourceNodeId: 'led-y', sourcePinId: 'anode', targetNodeId: 'breadboard-1', targetPinId: 'hole-f-15', color: 'yellow' },
  { sourceNodeId: 'led-y', sourcePinId: 'cathode', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-15', color: 'black' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio23', targetNodeId: 'breadboard-1', targetPinId: 'hole-f-20', color: 'red' },
  { sourceNodeId: 'res-r', sourcePinId: 'a', targetNodeId: 'breadboard-1', targetPinId: 'hole-j-20', color: 'red' },
  { sourceNodeId: 'res-r', sourcePinId: 'b', targetNodeId: 'breadboard-1', targetPinId: 'hole-j-23', color: 'red' },
  { sourceNodeId: 'led-r', sourcePinId: 'anode', targetNodeId: 'breadboard-1', targetPinId: 'hole-f-23', color: 'red' },
  { sourceNodeId: 'led-r', sourcePinId: 'cathode', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-23', color: 'black' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio2', targetNodeId: 'breadboard-1', targetPinId: 'hole-f-27', color: 'purple' },
  { sourceNodeId: 'buzzer-1', sourcePinId: 'pos', targetNodeId: 'breadboard-1', targetPinId: 'hole-j-27', color: 'purple' },
  { sourceNodeId: 'buzzer-1', sourcePinId: 'neg', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-27', color: 'black' },
  // LM7805 5V Regulator & Q1 MOSFET Cutoff Circuit with Gate Pulldown (Step 5c)
  { sourceNodeId: 'reg-5v', sourcePinId: 'gnd', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-1', color: 'black' },
  { sourceNodeId: 'reg-5v', sourcePinId: 'out', targetNodeId: 'fan-1', targetPinId: 'vcc', color: 'red' },
  { sourceNodeId: 'fan-1', sourcePinId: 'gnd', targetNodeId: 'q1', targetPinId: 'drain', color: 'blue' },
  { sourceNodeId: 'q1', sourcePinId: 'source', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-2', color: 'black' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio14', targetNodeId: 'q1', targetPinId: 'gate', color: 'green' },
  { sourceNodeId: 'res-gate', sourcePinId: 'a', targetNodeId: 'q1', targetPinId: 'gate', color: 'green' },
  { sourceNodeId: 'res-gate', sourcePinId: 'b', targetNodeId: 'breadboard-1', targetPinId: 'rail-bottom-neg-2', color: 'black' },
  // PC Fan PWM & Tach Sensing (Step 5a, 5b)
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio13', targetNodeId: 'fan-1', targetPinId: 'pwm', color: 'blue' },
  { sourceNodeId: 'esp32-1', sourcePinId: 'gpio27', targetNodeId: 'fan-1', targetPinId: 'sense', color: 'yellow' },
  // Main Battery Fuse, Cutoff Switch, Schottky Diode-OR Feed, and ADC Sense (Step 6a, 6b)
  { sourceNodeId: 'batt-main', sourcePinId: 'pos', targetNodeId: 'fuse-main', targetPinId: 'a', color: 'orange' },
  { sourceNodeId: 'fuse-main', sourcePinId: 'b', targetNodeId: 'switch-main', targetPinId: 'a', color: 'orange' },
  { sourceNodeId: 'switch-main', sourcePinId: 'b', targetNodeId: 'diode-main', targetPinId: 'anode', color: 'orange' },
  { sourceNodeId: 'diode-main', sourcePinId: 'cathode', targetNodeId: 'reg-5v', targetPinId: 'in', color: 'red' },
  { sourceNodeId: 'switch-main', sourcePinId: 'b', targetNodeId: 'esp32-1', targetPinId: 'gpio34', color: 'orange' },
  { sourceNodeId: 'batt-main', sourcePinId: 'neg', targetNodeId: 'esp32-1', targetPinId: 'gnd3', color: 'black' },
  // Backup Battery Fuse, Switch, Schottky Diode-OR Feed, and ADC Sense (Step 6a, 6c)
  { sourceNodeId: 'batt-backup', sourcePinId: 'pos', targetNodeId: 'fuse-backup', targetPinId: 'a', color: 'orange' },
  { sourceNodeId: 'fuse-backup', sourcePinId: 'b', targetNodeId: 'switch-backup', targetPinId: 'a', color: 'orange' },
  { sourceNodeId: 'switch-backup', sourcePinId: 'b', targetNodeId: 'diode-backup', targetPinId: 'anode', color: 'orange' },
  { sourceNodeId: 'diode-backup', sourcePinId: 'cathode', targetNodeId: 'reg-5v', targetPinId: 'in', color: 'red' },
  { sourceNodeId: 'switch-backup', sourcePinId: 'b', targetNodeId: 'esp32-1', targetPinId: 'gpio35', color: 'orange' },
  { sourceNodeId: 'batt-backup', sourcePinId: 'neg', targetNodeId: 'esp32-1', targetPinId: 'gnd3', color: 'black' },
  // Supercapacitor Bank Charge Sensing (ADC 33) & Ground (Step 6d, 8)
  { sourceNodeId: 'supercap-bank', sourcePinId: 'pos', targetNodeId: 'esp32-1', targetPinId: 'gpio33', color: 'yellow' },
  { sourceNodeId: 'supercap-bank', sourcePinId: 'neg', targetNodeId: 'esp32-1', targetPinId: 'gnd3', color: 'black' },
  // USB Presence Sense (Step 7)
  { sourceNodeId: 'esp32-1', sourcePinId: '3v3', targetNodeId: 'esp32-1', targetPinId: 'gpio32', color: 'red' }
]

export const WIRING_TEMPLATES: Record<string, WiringTemplate> = {
  'fault-tolerant-aircraft': {
    name: 'Fault-Tolerant Aircraft Subsystem',
    description: 'ESP32 DevKit V1 with median voting sensors, dual battery + supercap reserve, and 4-wire PC fan stall check',
    code: FAULT_TOLERANT_AIRCRAFT_CODE,
    nodes: FAULT_TOLERANT_NODES,
    edges: FAULT_TOLERANT_EDGES,
  },
  'simple-dc-bulb': {
    name: 'Simple Switch & Light Bulb',
    description: 'A 9V battery, toggle switch, and incandescent light bulb to demonstrate DC nodal analysis.',
    nodes: [
      { type: 'battery-snap-9v', id: 'bat', position: { x: 80, y: 160 }, properties: { name: '9V Battery' } },
      { type: 'toggle-switch-spst', id: 'sw', position: { x: 260, y: 80 }, properties: { name: 'Light Switch', state: false } },
      { type: 'bulb', id: 'bulb', position: { x: 440, y: 160 }, properties: { name: 'Light Bulb' } },
    ],
    edges: [
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'sw', targetPinId: 'a', color: 'red' },
      { sourceNodeId: 'sw', sourcePinId: 'b', targetNodeId: 'bulb', targetPinId: 'pos', color: 'red' },
      { sourceNodeId: 'bulb', sourcePinId: 'neg', targetNodeId: 'bat', targetPinId: 'neg', color: 'black' },
    ],
  },
  'arduino-lm35': {
    name: 'Arduino + LM35 Temp',
    description: 'Precision analog temperature sensor connection',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'lm35', id: 'temp', position: { x: 320, y: 180 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'temp', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'temp', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'a0', targetNodeId: 'temp', targetPinId: 'out', color: 'orange' },
    ],
  },
  'arduino-lcd1602': {
    name: 'Arduino + LCD1602 I2C',
    description: 'Liquid crystal display character panel via I2C',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'lcd1602', id: 'lcd', position: { x: 300, y: 120 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'lcd', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'lcd', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'a4_sda', targetNodeId: 'lcd', targetPinId: 'sda', color: 'green' },
      { sourceNodeId: 'uno', sourcePinId: 'a5_scl', targetNodeId: 'lcd', targetPinId: 'scl', color: 'green' },
    ],
  },
  'arduino-dht22': {
    name: 'Arduino + DHT22',
    description: 'DHT22 Digital Temperature & Humidity Sensor wiring',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'dht22', id: 'sensor', position: { x: 300, y: 160 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'sensor', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'sensor', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'd2', targetNodeId: 'sensor', targetPinId: 'data', color: 'yellow' },
    ],
  },
  'arduino-ds18b20': {
    name: 'Arduino + DS18B20 Temp',
    description: '1-Wire temperature sensor with pull-up resistor',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'ds18b20', id: 'sensor', position: { x: 340, y: 180 } },
      { type: 'resistor', id: 'res', position: { x: 300, y: 60 }, properties: { resistance: 4700, name: '4.7K Pull-up' } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'sensor', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'sensor', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'res', targetPinId: 'a', color: 'red' },
      { sourceNodeId: 'res', sourcePinId: 'b', targetNodeId: 'sensor', targetPinId: 'data', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'd2', targetNodeId: 'sensor', targetPinId: 'data', color: 'yellow' },
    ],
  },
  'arduino-relay': {
    name: 'Arduino + Relay & Bulb',
    description: 'Safe control of 12V high-power load from 5V logic',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'relay', id: 'rl', position: { x: 260, y: 140 } },
      { type: 'bulb', id: 'lamp', position: { x: 420, y: 100 } },
      { type: 'battery-12v', id: 'bat', position: { x: 420, y: 220 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'rl', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'rl', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'rl', targetPinId: 'in', color: 'blue' },
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'rl', targetPinId: 'com', color: 'red' },
      { sourceNodeId: 'rl', sourcePinId: 'no', targetNodeId: 'lamp', targetPinId: 'pos', color: 'yellow' },
      { sourceNodeId: 'bat', sourcePinId: 'neg', targetNodeId: 'lamp', targetPinId: 'neg', color: 'black' },
    ],
  },
  'arduino-rgb': {
    name: 'Arduino + RGB LED',
    description: 'Wired three-channel PWM control with current limiters',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'rgb-led', id: 'rgb', position: { x: 360, y: 180 } },
      { type: 'resistor', id: 'res_r', position: { x: 280, y: 60 }, properties: { resistance: 220, name: '220Ω Red' } },
      { type: 'resistor', id: 'res_g', position: { x: 280, y: 110 }, properties: { resistance: 220, name: '220Ω Green' } },
      { type: 'resistor', id: 'res_b', position: { x: 280, y: 160 }, properties: { resistance: 220, name: '220Ω Blue' } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: 'd9', targetNodeId: 'res_r', targetPinId: 'a', color: 'blue' },
      { sourceNodeId: 'res_r', sourcePinId: 'b', targetNodeId: 'rgb', targetPinId: 'r', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'd10', targetNodeId: 'res_g', targetPinId: 'a', color: 'blue' },
      { sourceNodeId: 'res_g', sourcePinId: 'b', targetNodeId: 'rgb', targetPinId: 'g', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'res_b', targetPinId: 'a', color: 'blue' },
      { sourceNodeId: 'res_b', sourcePinId: 'b', targetNodeId: 'rgb', targetPinId: 'b', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'rgb', targetPinId: 'gnd', color: 'black' },
    ],
  },
  'arduino-fan-pwm': {
    name: 'Arduino + PC Fan PWM',
    description: '12V 4-wire PWM fan control and speed sensing',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'pc-fan', id: 'fan', position: { x: 300, y: 120 } },
      { type: 'battery-12v', id: 'bat', position: { x: 300, y: 260 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'fan', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'bat', targetPinId: 'neg', color: 'black' },
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'fan', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'fan', targetPinId: 'pwm', color: 'blue' },
      { sourceNodeId: 'uno', sourcePinId: 'd2', targetNodeId: 'fan', targetPinId: 'sense', color: 'yellow' },
    ],
  },
  'arduino-mosfet-motor': {
    name: 'Arduino + MOSFET Motor Driver',
    description: 'Power MOSFET driver for high-current 12V DC motor',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'n-mosfet', id: 'mosfet', position: { x: 260, y: 150 } },
      { type: 'dc-motor', id: 'motor', position: { x: 420, y: 100 } },
      { type: 'battery-12v', id: 'bat', position: { x: 420, y: 220 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'mosfet', targetPinId: 'gate', color: 'blue' },
      { sourceNodeId: 'mosfet', sourcePinId: 'source', targetNodeId: 'uno', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'mosfet', sourcePinId: 'source', targetNodeId: 'bat', targetPinId: 'neg', color: 'black' },
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'motor', targetPinId: 'pos', color: 'red' },
      { sourceNodeId: 'motor', sourcePinId: 'neg', targetNodeId: 'mosfet', targetPinId: 'drain', color: 'yellow' },
    ],
  },
  'aircraft-module-1': {
    name: 'Redundant Flight Control Block',
    description: 'Fault-tolerant dual-controller flight control module',
    nodes: [
      { type: 'arduino-uno', id: 'primary', position: { x: 50, y: 50 }, properties: { name: 'Flight Computer A (Uno)' } },
      { type: 'esp32-devkit', id: 'secondary', position: { x: 50, y: 280 }, properties: { name: 'Flight Computer B (ESP32)' } },
      { type: 'ups-module-5v', id: 'ups', position: { x: 300, y: 80 }, properties: { name: 'Main 5V UPS' } },
      { type: 'relay', id: 'bypass', position: { x: 300, y: 260 }, properties: { name: 'Actuator Bypass Relay' } },
      { type: 'led', id: 'actuator', position: { x: 480, y: 260 }, properties: { name: 'Control Surface Actuator' } },
      { type: 'resistor', id: 'limit', position: { x: 480, y: 160 }, properties: { resistance: 220, name: '220Ω Actuator Resistor' } },
    ],
    edges: [
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'primary', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'secondary', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'primary', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'secondary', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'primary', sourcePinId: 'd9', targetNodeId: 'bypass', targetPinId: 'in', color: 'blue' },
      { sourceNodeId: 'secondary', sourcePinId: 'gpio2', targetNodeId: 'bypass', targetPinId: 'in', color: 'yellow' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'bypass', targetPinId: 'com', color: 'red' },
      { sourceNodeId: 'bypass', sourcePinId: 'no', targetNodeId: 'limit', targetPinId: 'a', color: 'yellow' },
      { sourceNodeId: 'limit', sourcePinId: 'b', targetNodeId: 'actuator', targetPinId: 'anode', color: 'yellow' },
      { sourceNodeId: 'actuator', sourcePinId: 'cathode', targetNodeId: 'ups', targetPinId: 'out_neg', color: 'black' },
    ],
  },
  'complete-aircraft-demo': {
    name: 'Complete Fault-Tolerant Bus Demo',
    description: 'Fully integrated redundant power, dual microcontrollers, bypass relays, and motor controllers',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 20, y: 60 }, properties: { name: 'Primary Core (Uno)' } },
      { type: 'esp32-devkit', id: 'esp', position: { x: 20, y: 300 }, properties: { name: 'Backup Core (ESP32)' } },
      { type: 'ups-module-5v', id: 'ups', position: { x: 240, y: 20 }, properties: { name: 'Core UPS' } },
      { type: 'battery-snap-9v', id: 'v_bat', position: { x: 420, y: 20 }, properties: { name: 'Backup Battery' } },
      { type: 'relay', id: 'power_relay', position: { x: 240, y: 200 }, properties: { name: 'Power Selector Relay' } },
      { type: 'slide-switch-spdt', id: 'manual_override', position: { x: 420, y: 150 }, properties: { name: 'Bypass Switch' } },
      { type: 'dc-motor', id: 'thrust_motor', position: { x: 580, y: 280 }, properties: { name: 'Main Thrust Motor' } },
      { type: 'n-mosfet', id: 'thrust_driver', position: { x: 420, y: 280 }, properties: { name: 'Thrust MOSFET Driver' } },
      { type: 'battery-12v', id: 'main_bus_12v', position: { x: 580, y: 80 }, properties: { name: '12V Main Bus' } },
    ],
    edges: [
      { sourceNodeId: 'v_bat', sourcePinId: 'pos', targetNodeId: 'ups', targetPinId: 'vin_pos', color: 'red' },
      { sourceNodeId: 'v_bat', sourcePinId: 'neg', targetNodeId: 'ups', targetPinId: 'vin_neg', color: 'black' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'uno', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'uno', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'esp', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'esp', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'd9', targetNodeId: 'thrust_driver', targetPinId: 'gate', color: 'blue' },
      { sourceNodeId: 'esp', sourcePinId: 'gpio32', targetNodeId: 'thrust_driver', targetPinId: 'gate', color: 'yellow' },
      { sourceNodeId: 'thrust_driver', sourcePinId: 'source', targetNodeId: 'ups', targetPinId: 'out_neg', color: 'black' },
      { sourceNodeId: 'thrust_driver', sourcePinId: 'source', targetNodeId: 'main_bus_12v', targetPinId: 'neg', color: 'black' },
      { sourceNodeId: 'main_bus_12v', sourcePinId: 'pos', targetNodeId: 'thrust_motor', targetPinId: 'pos', color: 'red' },
      { sourceNodeId: 'thrust_motor', sourcePinId: 'neg', targetNodeId: 'thrust_driver', targetPinId: 'drain', color: 'yellow' },
    ],
  },
}

export interface WiringRecommendation {
  id: string
  title: string
  message: string
  actionLabel?: string
  actionNode?: ComponentType
}

export function getWiringRecommendations(
  nodes: WorkspaceNode[],
  _edges: WorkspaceEdge[]
): WiringRecommendation[] {
  const recommendations: WiringRecommendation[] = []

  // Check 1: LED directly to 5V/3.3V
  const hasDirectLEDWarning = nodes.some(n => n.type === 'led' || n.type === 'rgb-led')
  // We can recommend placing a 220Ω resistor
  if (hasDirectLEDWarning) {
    const hasResistors = nodes.some(n => n.type === 'resistor')
    if (!hasResistors) {
      recommendations.push({
        id: 'rec-resistor',
        title: 'Suggest Current-Limiting Resistor',
        message: 'Your circuit contains an LED. Connecting it directly to a microcontroller pin or power rail can burn it out. We suggest adding a 220Ω resistor in series.',
        actionLabel: 'Add Resistor',
        actionNode: 'resistor',
      })
    }
  }

  // Check 2: High battery voltage (9V/12V) connected to boards
  const hasHighVoltage = nodes.some(n => n.type === 'battery-9v' || n.type === 'battery-12v')
  if (hasHighVoltage) {
    const hasRegulator = nodes.some(n => n.type === 'lm7805')
    if (!hasRegulator) {
      recommendations.push({
        id: 'rec-regulator',
        title: 'Suggest Voltage Regulator (LM7805)',
        message: 'Your circuit has a high voltage battery (9V/12V). Microcontrollers and sensors operate at 5V/3.3V. We suggest adding an LM7805 5V regulator to protect your parts.',
        actionLabel: 'Add LM7805',
        actionNode: 'lm7805',
      })
    }
  }

  // Check 3: PC Fan directly powered by microcontroller
  const hasPCFan = nodes.some(n => n.type === 'pc-fan' || n.type === 'dc-motor')
  if (hasPCFan) {
    const hasMOSFET = nodes.some(n => n.type === 'n-mosfet' || n.type === 'p-mosfet' || n.type === 'relay')
    if (!hasMOSFET) {
      recommendations.push({
        id: 'rec-mosfet',
        title: 'Suggest Power Driver (MOSFET / Relay)',
        message: 'Motors and fans draw high currents that exceed the microcontroller GPIO limits (max 40mA). We suggest using a MOSFET or Relay to switch them safely.',
        actionLabel: 'Add MOSFET',
        actionNode: 'n-mosfet',
      })
    }
  }

  return recommendations
}
