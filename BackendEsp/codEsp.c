#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP280.h>

#include "AudioTools.h"
#include "BluetoothA2DPSink.h"

#define DHTPIN 18
#define DHTTYPE DHT11

#define MQ135_PIN 33
#define LDR_PIN 34

#define I2C_SDA 19
#define I2C_SCL 21

// Senzor ultrasonic 1
#define TRIG_PIN_1 16
#define ECHO_PIN_1 17

// Senzor ultrasonic 2
#define TRIG_PIN_2 4
#define ECHO_PIN_2 2

// Senzor ultrasonic 3
#define TRIG_PIN_3 14
#define ECHO_PIN_3 5

#define MOSFET1 12
#define MOSFET2 13
#define MOSFET3 22
#define MOSFET4 23

#define SEALEVELPRESSURE_HPA 1013.25

const char *ssid = "Ghile";
const char *password = "ghilezan";
const char *bt_name = "ESP32_Speaker";

// -------------------- Obiecte --------------------
DHT dht(DHTPIN, DHTTYPE);
Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp;
WebServer server(80);

AnalogAudioStream audio_out;
BluetoothA2DPSink a2dp_sink(audio_out);

// -------------------- Stari --------------------
bool aht_ok = false;
bool bmp_ok = false;
bool btServiceStarted = false;

bool mosfet1State = false;
bool mosfet2State = false;
bool mosfet3State = false;
bool mosfet4State = false;

String btConnectionState = "DISCONNECTED";
String btAudioState = "STOPPED";

// -------------------- Bluetooth callbacks --------------------
void connection_state_changed(esp_a2d_connection_state_t state, void *ptr)
{
    btConnectionState = String(a2dp_sink.to_str(state));
    Serial.print("BT connection: ");
    Serial.println(btConnectionState);
}

void audio_state_changed(esp_a2d_audio_state_t state, void *ptr)
{
    btAudioState = String(a2dp_sink.to_str(state));
    Serial.print("BT audio: ");
    Serial.println(btAudioState);
}

// -------------------- Functii utile --------------------
String getAirStatus(int airQuality)
{
    if (airQuality < 1000)
        return "Aer bun";
    else if (airQuality < 2000)
        return "Aer moderat";
    else
        return "Aer poluat";
}

String getLightStatus(int percent)
{
    if (percent < 20)
        return "Intuneric";
    else if (percent < 50)
        return "Lumina slaba";
    else if (percent < 80)
        return "Lumina normala";
    else
        return "Lumina puternica";
}

String getOnOff(bool state)
{
    return state ? "ON" : "OFF";
}

void applyMosfetStates()
{
    digitalWrite(MOSFET1, mosfet1State ? HIGH : LOW);
    digitalWrite(MOSFET2, mosfet2State ? HIGH : LOW);
    digitalWrite(MOSFET3, mosfet3State ? HIGH : LOW);
    digitalWrite(MOSFET4, mosfet4State ? HIGH : LOW);
}

void setAllMosfets(bool state)
{
    mosfet1State = state;
    mosfet2State = state;
    mosfet3State = state;
    mosfet4State = state;
    applyMosfetStates();
}

void toggleAllMosfets()
{
    mosfet1State = !mosfet1State;
    mosfet2State = !mosfet2State;
    mosfet3State = !mosfet3State;
    mosfet4State = !mosfet4State;
    applyMosfetStates();
}

float readDistanceCM(int trigPin, int echoPin)
{
    float sum = 0;
    int validReadings = 0;

    for (int i = 0; i < 5; i++)
    {
        digitalWrite(trigPin, LOW);
        delayMicroseconds(5);

        digitalWrite(trigPin, HIGH);
        delayMicroseconds(10);
        digitalWrite(trigPin, LOW);

        long duration = pulseIn(echoPin, HIGH, 50000);

        if (duration > 0)
        {
            float distanceCm = duration * 0.0343f / 2.0f;
            if (distanceCm >= 2 && distanceCm <= 800)
            {
                sum += distanceCm;
                validReadings++;
            }
        }

        delay(20);
    }

    if (validReadings == 0)
        return NAN;
    return sum / validReadings;
}

String htmlButton(String label, String onUrl, String offUrl, String toggleUrl, bool state)
{
    String s;
    s += "<div class='card'>";
    s += "<h2>" + label + "</h2>";
    s += "<div class='value'>" + getOnOff(state) + "</div>";
    s += "<a class='btn on' href='" + onUrl + "'>ON</a>";
    s += "<a class='btn off' href='" + offUrl + "'>OFF</a>";
    s += "<a class='btn mid' href='" + toggleUrl + "'>TOGGLE</a>";
    s += "</div>";
    return s;
}

void redirectHome()
{
    server.sendHeader("Location", "/");
    server.send(303);
}

void sendText(String text)
{
    server.send(200, "text/plain; charset=utf-8", text);
}

void sendJson(String json)
{
    server.send(200, "application/json; charset=utf-8", json);
}

String floatOrNull(float value, int decimals = 1)
{
    if (isnan(value))
        return "null";
    return String(value, decimals);
}

String buildSensorsJson()
{
    float dht_h = dht.readHumidity();
    float dht_t = dht.readTemperature();

    int airQuality = analogRead(MQ135_PIN);

    int lightValue = analogRead(LDR_PIN);
    int lightPercent = map(lightValue, 0, 4095, 0, 100);
    lightPercent = constrain(lightPercent, 0, 100);

    float distanceCm1 = readDistanceCM(TRIG_PIN_1, ECHO_PIN_1);
    float distanceCm2 = readDistanceCM(TRIG_PIN_2, ECHO_PIN_2);
    float distanceCm3 = readDistanceCM(TRIG_PIN_3, ECHO_PIN_3);

    sensors_event_t humidity, temp;
    float aht_t = NAN;
    float aht_h = NAN;

    float bmp_t = NAN;
    float pressure = NAN;
    float altitude = NAN;

    if (aht_ok)
    {
        aht.getEvent(&humidity, &temp);
        aht_t = temp.temperature;
        aht_h = humidity.relative_humidity;
    }

    if (bmp_ok)
    {
        bmp_t = bmp.readTemperature();
        pressure = bmp.readPressure() / 100.0F;
        altitude = bmp.readAltitude(SEALEVELPRESSURE_HPA);
    }

    String json = "{";
    json += "\"dht11\":{";
    json += "\"temperature\":" + floatOrNull(dht_t) + ",";
    json += "\"humidity\":" + floatOrNull(dht_h);
    json += "},";

    json += "\"mq135\":{";
    json += "\"raw\":" + String(airQuality) + ",";
    json += "\"status\":\"" + getAirStatus(airQuality) + "\"";
    json += "},";

    json += "\"aht20\":{";
    json += "\"ok\":" + String(aht_ok ? "true" : "false") + ",";
    json += "\"temperature\":" + floatOrNull(aht_t) + ",";
    json += "\"humidity\":" + floatOrNull(aht_h);
    json += "},";

    json += "\"bmp280\":{";
    json += "\"ok\":" + String(bmp_ok ? "true" : "false") + ",";
    json += "\"temperature\":" + floatOrNull(bmp_t) + ",";
    json += "\"pressure\":" + floatOrNull(pressure) + ",";
    json += "\"altitude\":" + floatOrNull(altitude);
    json += "},";

    json += "\"distance\":{";
    json += "\"sensor1_cm\":" + floatOrNull(distanceCm1) + ",";
    json += "\"sensor2_cm\":" + floatOrNull(distanceCm2) + ",";
    json += "\"sensor3_cm\":" + floatOrNull(distanceCm3);
    json += "},";

    json += "\"light\":{";
    json += "\"raw\":" + String(lightValue) + ",";
    json += "\"percent\":" + String(lightPercent) + ",";
    json += "\"status\":\"" + getLightStatus(lightPercent) + "\"";
    json += "}";

    json += "}";
    return json;
}

String buildStatusJson()
{
    String json = "{";
    json += "\"wifi\":{";
    json += "\"connected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
    json += "\"ip\":\"" + WiFi.localIP().toString() + "\"";
    json += "},";

    json += "\"bluetooth\":{";
    json += "\"started\":" + String(btServiceStarted ? "true" : "false") + ",";
    json += "\"device_name\":\"" + String(bt_name) + "\",";
    json += "\"connection_state\":\"" + btConnectionState + "\",";
    json += "\"audio_state\":\"" + btAudioState + "\"";
    json += "},";

    json += "\"mosfets\":{";
    json += "\"m1\":\"" + getOnOff(mosfet1State) + "\",";
    json += "\"m2\":\"" + getOnOff(mosfet2State) + "\",";
    json += "\"m3\":\"" + getOnOff(mosfet3State) + "\",";
    json += "\"m4\":\"" + getOnOff(mosfet4State) + "\"";
    json += "},";

    json += "\"sensors\":" + buildSensorsJson();

    json += "}";
    return json;
}

// -------------------- Pagina principala --------------------
void handleRoot()
{
    float dht_h = dht.readHumidity();
    float dht_t = dht.readTemperature();

    int airQuality = analogRead(MQ135_PIN);

    int lightValue = analogRead(LDR_PIN);
    int lightPercent = map(lightValue, 0, 4095, 0, 100);
    lightPercent = constrain(lightPercent, 0, 100);

    float distanceCm1 = readDistanceCM(TRIG_PIN_1, ECHO_PIN_1);
    float distanceCm2 = readDistanceCM(TRIG_PIN_2, ECHO_PIN_2);
    float distanceCm3 = readDistanceCM(TRIG_PIN_3, ECHO_PIN_3);

    sensors_event_t humidity, temp;
    float aht_t = NAN;
    float aht_h = NAN;

    float bmp_t = NAN;
    float pressure = NAN;
    float altitude = NAN;

    if (aht_ok)
    {
        aht.getEvent(&humidity, &temp);
        aht_t = temp.temperature;
        aht_h = humidity.relative_humidity;
    }

    if (bmp_ok)
    {
        bmp_t = bmp.readTemperature();
        pressure = bmp.readPressure() / 100.0F;
        altitude = bmp.readAltitude(SEALEVELPRESSURE_HPA);
    }

    String html = "<!DOCTYPE html><html><head>";
    html += "<meta charset='UTF-8'>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
    html += "<meta http-equiv='refresh' content='2'>";
    html += "<title>Statie Meteo ESP32</title>";
    html += "<style>";
    html += "body{font-family:Arial;background:#f0f4f8;text-align:center;padding:20px;margin:0;}";
    html += "h1{color:#222;margin-bottom:20px;}";
    html += ".card{background:white;width:340px;max-width:90%;margin:15px auto;padding:20px;border-radius:15px;box-shadow:0 4px 10px rgba(0,0,0,0.1);}";
    html += ".value{font-size:30px;font-weight:bold;margin:10px 0;}";
    html += ".small{font-size:18px;color:#444;margin:6px 0;}";
    html += ".warn{color:red;font-weight:bold;}";
    html += ".ok{color:green;font-weight:bold;}";
    html += ".btn{display:inline-block;margin:8px;padding:12px 20px;border-radius:10px;text-decoration:none;color:white;font-weight:bold;}";
    html += ".on{background:#16a34a;}";
    html += ".off{background:#dc2626;}";
    html += ".mid{background:#2563eb;}";
    html += "</style>";
    html += "</head><body>";

    html += "<h1>Statie Meteo ESP32 + Bluetooth</h1>";

    html += "<div class='card'><h2>Bluetooth Audio</h2>";
    html += "<div class='small'>Nume dispozitiv: " + String(bt_name) + "</div>";
    html += "<div class='small'>Pornit: " + String(btServiceStarted ? "DA" : "NU") + "</div>";
    html += "<div class='small'>Conexiune: " + btConnectionState + "</div>";
    html += "<div class='small'>Audio: " + btAudioState + "</div>";
    html += "<div class='small'>PAM8403 L_IN = GPIO25</div>";
    html += "<div class='small'>PAM8403 R_IN = GPIO26</div>";
    html += "<a class='btn on' href='/bt/start'>BT START</a>";
    html += "<a class='btn off' href='/bt/stop'>BT STOP</a>";
    html += "<a class='btn mid' href='/bt/status'>BT STATUS</a>";
    html += "</div>";

    html += "<div class='card'><h2>DHT11</h2>";
    if (isnan(dht_t) || isnan(dht_h))
    {
        html += "<div class='warn'>Eroare la citirea DHT11</div>";
    }
    else
    {
        html += "<div class='value'>" + String(dht_t, 1) + " &deg;C</div>";
        html += "<div class='small'>Umiditate: " + String(dht_h, 1) + " %</div>";
    }
    html += "</div>";

    html += "<div class='card'><h2>MQ135</h2>";
    html += "<div class='value'>" + String(airQuality) + "</div>";
    html += "<div class='small'>" + getAirStatus(airQuality) + "</div>";
    html += "</div>";

    html += "<div class='card'><h2>AHT20</h2>";
    if (!aht_ok || isnan(aht_t) || isnan(aht_h))
    {
        html += "<div class='warn'>AHT20 nu raspunde</div>";
    }
    else
    {
        html += "<div class='value'>" + String(aht_t, 1) + " &deg;C</div>";
        html += "<div class='small'>Umiditate: " + String(aht_h, 1) + " %</div>";
    }
    html += "</div>";

    html += "<div class='card'><h2>BMP280</h2>";
    if (!bmp_ok || isnan(bmp_t) || isnan(pressure) || isnan(altitude))
    {
        html += "<div class='warn'>BMP280 nu raspunde</div>";
    }
    else
    {
        html += "<div class='value'>" + String(bmp_t, 1) + " &deg;C</div>";
        html += "<div class='small'>Presiune: " + String(pressure, 1) + " hPa</div>";
        html += "<div class='small'>Altitudine: " + String(altitude, 1) + " m</div>";
    }
    html += "</div>";

    html += "<div class='card'><h2>HC-SR04 #1</h2>";
    html += "<div class='small'>TRIG: GPIO16 | ECHO: GPIO17</div>";
    if (isnan(distanceCm1))
    {
        html += "<div class='warn'>Nu s-a putut masura distanta</div>";
    }
    else
    {
        html += "<div class='value'>" + String(distanceCm1, 1) + " cm</div>";
        html += "<div class='small'>Distanta: " + String(distanceCm1 / 100.0, 2) + " m</div>";
    }
    html += "</div>";

    html += "<div class='card'><h2>HC-SR04 #2</h2>";
    html += "<div class='small'>TRIG: GPIO4 | ECHO: GPIO2</div>";
    if (isnan(distanceCm2))
    {
        html += "<div class='warn'>Nu s-a putut masura distanta</div>";
    }
    else
    {
        html += "<div class='value'>" + String(distanceCm2, 1) + " cm</div>";
        html += "<div class='small'>Distanta: " + String(distanceCm2 / 100.0, 2) + " m</div>";
    }
    html += "</div>";

    html += "<div class='card'><h2>HC-SR04 #3</h2>";
    html += "<div class='small'>TRIG: GPIO14 | ECHO: GPIO5</div>";
    if (isnan(distanceCm3))
    {
        html += "<div class='warn'>Nu s-a putut masura distanta</div>";
    }
    else
    {
        html += "<div class='value'>" + String(distanceCm3, 1) + " cm</div>";
        html += "<div class='small'>Distanta: " + String(distanceCm3 / 100.0, 2) + " m</div>";
    }
    html += "</div>";

    html += "<div class='card'><h2>Senzor Lumina</h2>";
    html += "<div class='value'>" + String(lightPercent) + " %</div>";
    html += "<div class='small'>Valoare: " + String(lightValue) + "</div>";
    html += "<div class='small'>" + getLightStatus(lightPercent) + "</div>";
    html += "</div>";

    html += "<div class='card'><h2>Control General</h2>";
    html += "<a class='btn on' href='/all/on'>ALL ON</a>";
    html += "<a class='btn off' href='/all/off'>ALL OFF</a>";
    html += "<a class='btn mid' href='/all/toggle'>ALL TOGGLE</a>";
    html += "<a class='btn mid' href='/json'>JSON</a>";
    html += "<a class='btn mid' href='/sensors'>SENSORS</a>";
    html += "<a class='btn mid' href='/status'>STATUS</a>";
    html += "<a class='btn mid' href='/help'>HELP</a>";
    html += "<a class='btn off' href='/restart'>RESTART</a>";
    html += "</div>";

    html += htmlButton("Canal 1 - D12", "/m1/on", "/m1/off", "/m1/toggle", mosfet1State);
    html += htmlButton("Canal 2 - D13", "/m2/on", "/m2/off", "/m2/toggle", mosfet2State);
    html += htmlButton("Canal 3 - D22", "/m3/on", "/m3/off", "/m3/toggle", mosfet3State);
    html += htmlButton("Canal 4 - D23", "/m4/on", "/m4/off", "/m4/toggle", mosfet4State);

    html += "</body></html>";

    server.send(200, "text/html", html);
}

// -------------------- Handlers --------------------
void handleStatus()
{
    String s;
    s += "ESP32 STATUS\n";
    s += "WiFi: ";
    s += (WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
    s += "\nIP: " + WiFi.localIP().toString();
    s += "\nBluetooth started: " + String(btServiceStarted ? "YES" : "NO");
    s += "\nBT connection: " + btConnectionState;
    s += "\nBT audio: " + btAudioState;
    s += "\nM1: " + getOnOff(mosfet1State);
    s += "\nM2: " + getOnOff(mosfet2State);
    s += "\nM3: " + getOnOff(mosfet3State);
    s += "\nM4: " + getOnOff(mosfet4State);
    sendText(s);
}

void handleJson()
{
    sendJson(buildStatusJson());
}

void handleSensors()
{
    sendJson(buildSensorsJson());
}

void handleDistance()
{
    float d1 = readDistanceCM(TRIG_PIN_1, ECHO_PIN_1);
    float d2 = readDistanceCM(TRIG_PIN_2, ECHO_PIN_2);
    float d3 = readDistanceCM(TRIG_PIN_3, ECHO_PIN_3);

    String json = "{";
    json += "\"sensor1_cm\":" + floatOrNull(d1) + ",";
    json += "\"sensor2_cm\":" + floatOrNull(d2) + ",";
    json += "\"sensor3_cm\":" + floatOrNull(d3);
    json += "}";
    sendJson(json);
}

void handleDistance1()
{
    float d = readDistanceCM(TRIG_PIN_1, ECHO_PIN_1);
    if (isnan(d))
        sendText("Eroare: nu s-a putut masura distanta senzor 1");
    else
        sendText("Distance 1: " + String(d, 1) + " cm");
}

void handleDistance2()
{
    float d = readDistanceCM(TRIG_PIN_2, ECHO_PIN_2);
    if (isnan(d))
        sendText("Eroare: nu s-a putut masura distanta senzor 2");
    else
        sendText("Distance 2: " + String(d, 1) + " cm");
}

void handleDistance3()
{
    float d = readDistanceCM(TRIG_PIN_3, ECHO_PIN_3);
    if (isnan(d))
        sendText("Eroare: nu s-a putut masura distanta senzor 3");
    else
        sendText("Distance 3: " + String(d, 1) + " cm");
}

void handleLight()
{
    int lightValue = analogRead(LDR_PIN);
    int lightPercent = map(lightValue, 0, 4095, 0, 100);
    lightPercent = constrain(lightPercent, 0, 100);

    String s;
    s += "Lumina raw: " + String(lightValue);
    s += "\nLumina percent: " + String(lightPercent) + " %";
    s += "\nStatus: " + getLightStatus(lightPercent);
    sendText(s);
}

void handleAir()
{
    int airQuality = analogRead(MQ135_PIN);
    String s;
    s += "MQ135 raw: " + String(airQuality);
    s += "\nStatus: " + getAirStatus(airQuality);
    sendText(s);
}

void handleHelp()
{
    String s;
    s += "Rute disponibile:\n\n";
    s += "/\n";
    s += "/status\n";
    s += "/json\n";
    s += "/sensors\n";
    s += "/distance\n";
    s += "/distance1\n";
    s += "/distance2\n";
    s += "/distance3\n";
    s += "/light\n";
    s += "/air\n";
    s += "/restart\n\n";

    s += "/m1/on\n/m1/off\n/m1/toggle\n";
    s += "/m2/on\n/m2/off\n/m2/toggle\n";
    s += "/m3/on\n/m3/off\n/m3/toggle\n";
    s += "/m4/on\n/m4/off\n/m4/toggle\n\n";

    s += "/all/on\n/all/off\n/all/toggle\n\n";

    s += "/bt/start\n";
    s += "/bt/stop\n";
    s += "/bt/status\n";
    sendText(s);
}

void handleNotFound()
{
    String msg = "Ruta inexistenta.\n\n";
    msg += "Ai cerut: " + server.uri() + "\n\n";
    msg += "Incearca /help pentru lista rutelor.";
    server.send(404, "text/plain; charset=utf-8", msg);
}

// -------------------- Setup --------------------
void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("Pornire sistem...");

    dht.begin();

    pinMode(MQ135_PIN, INPUT);
    pinMode(LDR_PIN, INPUT);

    pinMode(TRIG_PIN_1, OUTPUT);
    pinMode(ECHO_PIN_1, INPUT);
    digitalWrite(TRIG_PIN_1, LOW);

    pinMode(TRIG_PIN_2, OUTPUT);
    pinMode(ECHO_PIN_2, INPUT);
    digitalWrite(TRIG_PIN_2, LOW);

    pinMode(TRIG_PIN_3, OUTPUT);
    pinMode(ECHO_PIN_3, INPUT);
    digitalWrite(TRIG_PIN_3, LOW);

    pinMode(MOSFET1, OUTPUT);
    pinMode(MOSFET2, OUTPUT);
    pinMode(MOSFET3, OUTPUT);
    pinMode(MOSFET4, OUTPUT);
    applyMosfetStates();

    Wire.begin(I2C_SDA, I2C_SCL);

    if (!aht.begin(&Wire))
    {
        Serial.println("Nu gasesc AHT20!");
    }
    else
    {
        aht_ok = true;
        Serial.println("AHT20 gasit.");
    }

    bool status = bmp.begin(0x76);
    if (!status)
        status = bmp.begin(0x77);

    if (status)
    {
        bmp_ok = true;
        Serial.println("BMP280 gasit.");
        bmp.setSampling(
            Adafruit_BMP280::MODE_NORMAL,
            Adafruit_BMP280::SAMPLING_X2,
            Adafruit_BMP280::SAMPLING_X16,
            Adafruit_BMP280::FILTER_X16,
            Adafruit_BMP280::STANDBY_MS_500);
    }
    else
    {
        Serial.println("Nu gasesc BMP280!");
    }

    // WiFi
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    Serial.print("Conectare WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.println();
    Serial.println("WiFi conectat!");
    Serial.print("IP ESP32: ");
    Serial.println(WiFi.localIP());

    // Web routes
    server.on("/", handleRoot);

    server.on("/status", handleStatus);
    server.on("/json", handleJson);
    server.on("/sensors", handleSensors);

    server.on("/distance", handleDistance);
    server.on("/distance1", handleDistance1);
    server.on("/distance2", handleDistance2);
    server.on("/distance3", handleDistance3);

    server.on("/light", handleLight);
    server.on("/air", handleAir);
    server.on("/help", handleHelp);

    server.on("/restart", []()
              {
    server.send(200, "text/plain; charset=utf-8", "ESP32 restart...");
    delay(1000);
    ESP.restart(); });

    // MOSFET 1
    server.on("/m1/on", []()
              { mosfet1State = true;  applyMosfetStates(); redirectHome(); });
    server.on("/m1/off", []()
              { mosfet1State = false; applyMosfetStates(); redirectHome(); });
    server.on("/m1/toggle", []()
              { mosfet1State = !mosfet1State; applyMosfetStates(); redirectHome(); });

    // MOSFET 2
    server.on("/m2/on", []()
              { mosfet2State = true;  applyMosfetStates(); redirectHome(); });
    server.on("/m2/off", []()
              { mosfet2State = false; applyMosfetStates(); redirectHome(); });
    server.on("/m2/toggle", []()
              { mosfet2State = !mosfet2State; applyMosfetStates(); redirectHome(); });

    // MOSFET 3
    server.on("/m3/on", []()
              { mosfet3State = true;  applyMosfetStates(); redirectHome(); });
    server.on("/m3/off", []()
              { mosfet3State = false; applyMosfetStates(); redirectHome(); });
    server.on("/m3/toggle", []()
              { mosfet3State = !mosfet3State; applyMosfetStates(); redirectHome(); });

    // MOSFET 4
    server.on("/m4/on", []()
              { mosfet4State = true;  applyMosfetStates(); redirectHome(); });
    server.on("/m4/off", []()
              { mosfet4State = false; applyMosfetStates(); redirectHome(); });
    server.on("/m4/toggle", []()
              { mosfet4State = !mosfet4State; applyMosfetStates(); redirectHome(); });

    // ALL channels
    server.on("/all/on", []()
              { setAllMosfets(true); redirectHome(); });
    server.on("/all/off", []()
              { setAllMosfets(false); redirectHome(); });
    server.on("/all/toggle", []()
              { toggleAllMosfets(); redirectHome(); });

    // Bluetooth
    server.on("/bt/start", []()
              {
    if (!btServiceStarted) {
      a2dp_sink.start(bt_name);
      btServiceStarted = true;
      btConnectionState = "STARTED";
    }
    redirectHome(); });

    server.on("/bt/stop", []()
              {
    if (btServiceStarted) {
      a2dp_sink.end();
      btServiceStarted = false;
      btConnectionState = "STOPPED";
      btAudioState = "STOPPED";
    }
    redirectHome(); });

    server.on("/bt/status", []()
              {
    String s;
    s += "Bluetooth started: " + String(btServiceStarted ? "YES" : "NO");
    s += "\nConnection: " + btConnectionState;
    s += "\nAudio: " + btAudioState;
    sendText(s); });

    server.onNotFound(handleNotFound);

    server.begin();
    Serial.println("Server web pornit.");

    // Bluetooth A2DP -> DAC intern -> PAM8403
    auto cfg = audio_out.defaultConfig();
    audio_out.begin(cfg);

    a2dp_sink.set_auto_reconnect(true);
    a2dp_sink.set_on_connection_state_changed(connection_state_changed);
    a2dp_sink.set_on_audio_state_changed(audio_state_changed);
    a2dp_sink.start(bt_name);
    btServiceStarted = true;

    Serial.println("Bluetooth A2DP pornit.");
    Serial.print("Nume Bluetooth: ");
    Serial.println(bt_name);
}

void loop()
{
    server.handleClient();
}