#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "esp_timer.h"
#include "Arduino.h"

const char* ssid = "Ghile";
const char* password = "ghilezan";

// AI Thinker ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

#define FLASH_LED_PIN      4

httpd_handle_t camera_httpd = NULL;

bool flashState = false;
unsigned long bootMillis = 0;

// =====================================================
// Utilitare
// =====================================================

void setFlash(bool state) {
  flashState = state;
  digitalWrite(FLASH_LED_PIN, state ? HIGH : LOW);
}

void toggleFlash() {
  setFlash(!flashState);
}

String getUptimeString() {
  unsigned long sec = millis() / 1000;
  unsigned long days = sec / 86400;
  sec %= 86400;
  unsigned long hours = sec / 3600;
  sec %= 3600;
  unsigned long mins = sec / 60;
  sec %= 60;

  String s;
  s += String(days) + "d ";
  s += String(hours) + "h ";
  s += String(mins) + "m ";
  s += String(sec) + "s";
  return s;
}

String buildJsonStatus() {
  String json = "{";
  json += "\"device\":\"ESP32-CAM\",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"wifi_connected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"flash\":\"" + String(flashState ? "ON" : "OFF") + "\",";
  json += "\"free_heap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"psram\":" + String(psramFound() ? "true" : "false") + ",";
  json += "\"uptime\":\"" + getUptimeString() + "\"";
  json += "}";
  return json;
}

String buildTextStatus() {
  String s;
  s += "ESP32-CAM STATUS\n";
  s += "IP: " + WiFi.localIP().toString() + "\n";
  s += "WiFi: " + String(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED") + "\n";
  s += "RSSI: " + String(WiFi.RSSI()) + " dBm\n";
  s += "Flash: " + String(flashState ? "ON" : "OFF") + "\n";
  s += "Free heap: " + String(ESP.getFreeHeap()) + "\n";
  s += "PSRAM: " + String(psramFound() ? "YES" : "NO") + "\n";
  s += "Uptime: " + getUptimeString() + "\n";
  return s;
}

// =====================================================
// HTML
// =====================================================

static const char* INDEX_HTML =
"<!DOCTYPE html><html><head>"
"<meta name='viewport' content='width=device-width, initial-scale=1'>"
"<meta charset='UTF-8'>"
"<title>ESP32-CAM Control</title>"
"<style>"
"body{font-family:Arial;background:#111;color:#fff;text-align:center;margin:0;padding:20px;}"
".box{max-width:900px;margin:auto;background:#1a1a1a;padding:20px;border-radius:16px;}"
"img{width:95%;max-width:820px;border-radius:12px;margin-top:20px;border:2px solid #333;}"
".btn{display:inline-block;margin:8px;padding:12px 22px;border-radius:10px;text-decoration:none;color:white;font-weight:bold;font-size:17px;}"
".on{background:#16a34a;}"
".off{background:#dc2626;}"
".mid{background:#2563eb;}"
".warn{background:#ea580c;}"
".small{font-size:18px;color:#ddd;margin:10px 0;}"
"</style></head><body>"
"<div class='box'>"
"<h1>ESP32-CAM Live</h1>"
"<div class='small'>Flash: <span id='flashstate'>...</span></div>"
"<div class='small'>IP: <span id='ipstate'>...</span></div>"
"<div>"
"<a class='btn on' href='/flash/on'>FLASH ON</a>"
"<a class='btn off' href='/flash/off'>FLASH OFF</a>"
"<a class='btn mid' href='/flash/toggle'>FLASH TOGGLE</a>"
"<a class='btn mid' href='/capture'>CAPTURE</a>"
"<a class='btn mid' href='/status'>STATUS</a>"
"<a class='btn mid' href='/json'>JSON</a>"
"<a class='btn warn' href='/restart'>RESTART</a>"
"<a class='btn mid' href='/help'>HELP</a>"
"</div>"
"<img src='/stream'>"
"</div>"
"<script>"
"fetch('/json').then(r=>r.json()).then(d=>{"
"document.getElementById('flashstate').innerText=d.flash;"
"document.getElementById('ipstate').innerText=d.ip;"
"});"
"</script>"
"</body></html>";

// =====================================================
// Handlers
// =====================================================

static esp_err_t index_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html; charset=UTF-8");
  return httpd_resp_send(req, INDEX_HTML, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t flash_on_handler(httpd_req_t *req) {
  setFlash(true);
  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  return httpd_resp_send(req, "FLASH ON", HTTPD_RESP_USE_STRLEN);
}

static esp_err_t flash_off_handler(httpd_req_t *req) {
  setFlash(false);
  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  return httpd_resp_send(req, "FLASH OFF", HTTPD_RESP_USE_STRLEN);
}

static esp_err_t flash_toggle_handler(httpd_req_t *req) {
  toggleFlash();
  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  return httpd_resp_send(req, flashState ? "FLASH ON" : "FLASH OFF", HTTPD_RESP_USE_STRLEN);
}

static esp_err_t flash_status_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  return httpd_resp_send(req, flashState ? "ON" : "OFF", HTTPD_RESP_USE_STRLEN);
}

static esp_err_t status_handler(httpd_req_t *req) {
  String s = buildTextStatus();
  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  return httpd_resp_send(req, s.c_str(), HTTPD_RESP_USE_STRLEN);
}

static esp_err_t json_handler(httpd_req_t *req) {
  String s = buildJsonStatus();
  httpd_resp_set_type(req, "application/json; charset=UTF-8");
  return httpd_resp_send(req, s.c_str(), HTTPD_RESP_USE_STRLEN);
}

static esp_err_t help_handler(httpd_req_t *req) {
  String s;
  s += "Rute disponibile:\n\n";
  s += "/\n";
  s += "/stream\n";
  s += "/capture\n";
  s += "/flash/on\n";
  s += "/flash/off\n";
  s += "/flash/toggle\n";
  s += "/flash/status\n";
  s += "/status\n";
  s += "/json\n";
  s += "/restart\n";
  s += "/help\n";

  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  return httpd_resp_send(req, s.c_str(), HTTPD_RESP_USE_STRLEN);
}

static esp_err_t restart_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  httpd_resp_send(req, "ESP32-CAM restart...", HTTPD_RESP_USE_STRLEN);
  delay(1000);
  ESP.restart();
  return ESP_OK;
}

static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_set_type(req, "text/plain; charset=UTF-8");
    return httpd_resp_send(req, "Eroare captura camera", HTTPD_RESP_USE_STRLEN);
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);

  esp_camera_fb_return(fb);
  return res;
}

static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];

  static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=frame";
  static const char* _STREAM_BOUNDARY = "\r\n--frame\r\n";
  static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Eroare captura camera");
      return ESP_FAIL;
    }

    res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, sizeof(part_buf), _STREAM_PART, fb->len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char*)fb->buf, fb->len);
    }

    esp_camera_fb_return(fb);
    fb = NULL;

    if (res != ESP_OK) {
      break;
    }
  }

  return res;
}

static esp_err_t not_found_handler(httpd_req_t *req, httpd_err_code_t err) {
  String s = "Ruta inexistenta: ";
  s += req->uri;
  s += "\nIncearca /help";

  httpd_resp_set_type(req, "text/plain; charset=UTF-8");
  httpd_resp_send(req, s.c_str(), HTTPD_RESP_USE_STRLEN);
  return ESP_OK;
}

// =====================================================
// Server
// =====================================================

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.max_uri_handlers = 16;

  httpd_uri_t index_uri = {
    .uri = "/",
    .method = HTTP_GET,
    .handler = index_handler,
    .user_ctx = NULL
  };

  httpd_uri_t stream_uri = {
    .uri = "/stream",
    .method = HTTP_GET,
    .handler = stream_handler,
    .user_ctx = NULL
  };

  httpd_uri_t capture_uri = {
    .uri = "/capture",
    .method = HTTP_GET,
    .handler = capture_handler,
    .user_ctx = NULL
  };

  httpd_uri_t flash_on_uri = {
    .uri = "/flash/on",
    .method = HTTP_GET,
    .handler = flash_on_handler,
    .user_ctx = NULL
  };

  httpd_uri_t flash_off_uri = {
    .uri = "/flash/off",
    .method = HTTP_GET,
    .handler = flash_off_handler,
    .user_ctx = NULL
  };

  httpd_uri_t flash_toggle_uri = {
    .uri = "/flash/toggle",
    .method = HTTP_GET,
    .handler = flash_toggle_handler,
    .user_ctx = NULL
  };

  httpd_uri_t flash_status_uri = {
    .uri = "/flash/status",
    .method = HTTP_GET,
    .handler = flash_status_handler,
    .user_ctx = NULL
  };

  httpd_uri_t status_uri = {
    .uri = "/status",
    .method = HTTP_GET,
    .handler = status_handler,
    .user_ctx = NULL
  };

  httpd_uri_t json_uri = {
    .uri = "/json",
    .method = HTTP_GET,
    .handler = json_handler,
    .user_ctx = NULL
  };

  httpd_uri_t restart_uri = {
    .uri = "/restart",
    .method = HTTP_GET,
    .handler = restart_handler,
    .user_ctx = NULL
  };

  httpd_uri_t help_uri = {
    .uri = "/help",
    .method = HTTP_GET,
    .handler = help_handler,
    .user_ctx = NULL
  };

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &index_uri);
    httpd_register_uri_handler(camera_httpd, &stream_uri);
    httpd_register_uri_handler(camera_httpd, &capture_uri);
    httpd_register_uri_handler(camera_httpd, &flash_on_uri);
    httpd_register_uri_handler(camera_httpd, &flash_off_uri);
    httpd_register_uri_handler(camera_httpd, &flash_toggle_uri);
    httpd_register_uri_handler(camera_httpd, &flash_status_uri);
    httpd_register_uri_handler(camera_httpd, &status_uri);
    httpd_register_uri_handler(camera_httpd, &json_uri);
    httpd_register_uri_handler(camera_httpd, &restart_uri);
    httpd_register_uri_handler(camera_httpd, &help_uri);
    httpd_register_err_handler(camera_httpd, HTTPD_404_NOT_FOUND, not_found_handler);

    Serial.println("Webserver pornit");
  } else {
    Serial.println("Nu a pornit webserverul");
  }
}

// =====================================================
// Setup
// =====================================================

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  delay(1000);

  bootMillis = millis();

  Serial.println();
  Serial.println("Pornire ESP32-CAM...");

  pinMode(FLASH_LED_PIN, OUTPUT);
  setFlash(false);

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size = FRAMESIZE_CIF;
    config.jpeg_quality = 15;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return;
  }

  setFlash(false);

  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_framesize(s, FRAMESIZE_VGA);
  }

  WiFi.begin(ssid, password);
  Serial.print("Conectare WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    setFlash(false);
  }

  Serial.println();
  Serial.println("WiFi conectat");
  Serial.print("Deschide in browser: http://");
  Serial.println(WiFi.localIP());

  setFlash(false);
  startCameraServer();
}

// =====================================================
// Loop
// =====================================================

void loop() {
  delay(10000);
}