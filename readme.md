# Itfest 2026 — ESP32 Unified System

Sistem de asistență bazat pe ESP32 + ESP32-CAM + FastAPI pe Mac.
Recunoaștere facială, feedback haptic pentru obstacole, TTS în română prin ElevenLabs, OCR, YOLO și descriere scenă GPT-4o-mini.

---

## Hardware

| Componentă | IP | Port |
|---|---|---|
| ESP32 (senzori + motoare + BT) | `10.210.85.244` | 80 |
| ESP32-CAM (cameră) | `10.210.85.207` | 80 |
| FastAPI Mac backend | `localhost` | 8000 |

### Pinout ESP32 — senzori distanță HC-SR04

| Senzor | Direcție | TRIG | ECHO | Motor haptic |
|---|---|---|---|---|
| Sensor 1 | Față | GPIO 16 | GPIO 17 | MOSFET 1 (GPIO 12) |
| Sensor 2 | Stânga | GPIO 4 | GPIO 2 | MOSFET 2 (GPIO 13) |
| Sensor 3 | Dreapta | GPIO 14 | GPIO 5 | MOSFET 3 (GPIO 22) |
| — | Critic (toți < 30 cm) | — | — | MOSFET 4 (GPIO 23) |

### Alți senzori ESP32

| Senzor | Pin |
|---|---|
| DHT11 (temp/umiditate) | GPIO 18 |
| MQ135 (calitate aer) | GPIO 33 |
| LDR (lumină) | GPIO 34 |
| AHT20 (I²C) | SDA GPIO 19, SCL GPIO 21 |
| BMP280 (I²C) | SDA GPIO 19, SCL GPIO 21 |

### ESP32-CAM

| Componentă | Detaliu |
|---|---|
| Model | AI Thinker ESP32-CAM |
| Flash LED | GPIO 4 |
| Stream format | MJPEG multipart, port 80 |

---

## Structura proiect

```
BackendEsp/
├── codEsp.c                  Firmware ESP32 (senzori + motoare + BT)
├── codCamera.c               Firmware ESP32-CAM
├── find_devices.sh           Script descoperire IP-uri în rețea
└── imageDetection/
    ├── main.py               Entry point FastAPI + camera loop
    ├── config.py             Toate setările (citite din .env)
    ├── state.py              AppState partajat între thread-uri
    ├── face_engine.py        InsightFace — încărcare model + recunoaștere
    ├── face_loop.py          Bucla principală OpenCV (rulează pe main thread)
    ├── camera_thread.py      ThreadedCamera — citire MJPEG non-blocking
    ├── haptic.py             Polling distanță → control motoare
    ├── tts.py                ElevenLabs TTS + cache MP3 + afplay
    ├── notify.py             Notificări macOS (osascript)
    ├── ocr_engine.py         EasyOCR lazy-load
    ├── yolo_engine.py        YOLOv8 lazy-load
    ├── gpt_engine.py         GPT-4o-mini (scenă + sumarizare OCR)
    ├── esp_client.py         Client HTTP pentru ESP32
    ├── cam_client.py         Client HTTP pentru ESP32-CAM
    ├── find_devices.py       Scanner rețea pentru descoperire IP-uri
    ├── routers/
    │   ├── esp.py            Rute FastAPI /esp/* → proxy ESP32
    │   ├── cam.py            Rute FastAPI /cam/* → proxy ESP32-CAM
    │   └── control.py        Rute control: /ocr /detect /describe /tts /haptic
    ├── known_faces/          Imagini persoane cunoscute (1 poză/persoană)
    ├── tts_cache/            MP3-uri generate de ElevenLabs (cache local)
    ├── .env                  Secrets + IP-uri (nu se commitează)
    └── requirements.txt
```

---

## Instalare

```bash
# Creare mediu conda izolat
conda create -n itfest python=3.11 -y
conda activate itfest

cd BackendEsp/imageDetection
pip install -r requirements.txt
```

---

## Configurare `.env`

Fișier: `BackendEsp/imageDetection/.env`

```env
# IP-uri hardware
ESP_IP=10.210.85.244
CAM_IP=10.210.85.207

# API Keys
CHATGPT_API_KEY=sk-...
ELEVENLABS_API_KEY=sk_...

# Voce ElevenLabs (default: Ana Maria — română)
# ELEVENLABS_VOICE_ID=urzoE6aZYmSRdFQ6215h

# Prag obstacol haptic (cm)
OBSTACLE_THRESHOLD_CM=50
CRITICAL_THRESHOLD_CM=30

# Recunoaștere facială
FACE_THRESHOLD=0.4
FACE_COOLDOWN=30

# Server
API_PORT=8000
```

---

## Pornire

```bash
conda activate itfest
cd BackendEsp/imageDetection
python main.py
```

- API docs: http://localhost:8000/docs
- Status:   http://localhost:8000/status
- Dashboard ESP32: http://10.210.85.244/
- Stream cameră:   http://10.210.85.207/stream

---

## Descoperire IP-uri automat

Dacă IP-urile s-au schimbat (rețea nouă):

```bash
# Scanează rețeaua și afișează IP-urile găsite
./BackendEsp/find_devices.sh

# Sau actualizează automat .env
./BackendEsp/find_devices.sh --update-env

# Cu subnet explicit
./BackendEsp/find_devices.sh 10.210.85 --update-env
```

---

## Rute API FastAPI (port 8000)

### Control general

| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/status` | Status complet sistem |
| GET | `/help` | Lista tuturor rutelor |
| POST | `/ocr` | Activare/dezactivare burst OCR (10s) |
| POST | `/detect` | Activare/dezactivare YOLO |
| POST | `/describe` | Declanșare descriere scenă GPT-4o-mini |
| POST | `/tts` | TTS cu text arbitrar `{"text": "..."}` |
| DELETE | `/tts/cache` | Șterge cache MP3 ElevenLabs |
| POST | `/haptic/enable` | Activare monitor haptic |
| POST | `/haptic/disable` | Dezactivare monitor haptic |
| POST | `/haptic/threshold` | Setare prag distanță `{"cm": 50}` |

### Proxy ESP32 (`/esp/*`)

| Rută | Răspuns | Descriere |
|---|---|---|
| `/esp/json` | JSON | Tot: WiFi + BT + mosfete + senzori |
| `/esp/sensors` | JSON | Toți senzorii (DHT11, MQ135, AHT20, BMP280, distanțe, lumină) |
| `/esp/distance` | JSON `{sensor1_cm, sensor2_cm, sensor3_cm}` | Cele 3 distanțe |
| `/esp/distance1` | text | Distanță senzor față |
| `/esp/distance2` | text | Distanță senzor stânga |
| `/esp/distance3` | text | Distanță senzor dreapta |
| `/esp/light` | text | LDR |
| `/esp/air` | text | MQ135 |
| `/esp/status` | text | Status general |
| `/esp/m{1-4}/on` | JSON | Pornire motor haptic |
| `/esp/m{1-4}/off` | JSON | Oprire motor haptic |
| `/esp/m{1-4}/toggle` | JSON | Toggle motor haptic |
| `/esp/all/on` | JSON | Toate motoarele ON |
| `/esp/all/off` | JSON | Toate motoarele OFF |
| `/esp/bt/start` | JSON | Pornire Bluetooth A2DP |
| `/esp/bt/stop` | JSON | Oprire Bluetooth |
| `/esp/bt/status` | text | Status Bluetooth |
| `/esp/restart` | text | Restart ESP32 |

### Proxy ESP32-CAM (`/cam/*`)

| Rută | Răspuns | Descriere |
|---|---|---|
| `/cam/stream` | MJPEG | Stream live (proxy) |
| `/cam/capture` | JPEG | Captură cadru unic |
| `/cam/flash/on` | text | Flash ON |
| `/cam/flash/off` | text | Flash OFF |
| `/cam/flash/toggle` | text | Flash toggle |
| `/cam/flash/status` | text `ON`/`OFF` | Stare flash |
| `/cam/json` | JSON `{device, ip, rssi, flash, free_heap, uptime}` | Status JSON |
| `/cam/status` | text | Status text |
| `/cam/restart` | text | Restart cameră |

---

## Funcționalități principale

### Recunoaștere facială
- Model: **InsightFace buffalo_l** (detection + recognition + genderage)
- Adaugă imagini în `known_faces/` cu numele ca filename (ex: `Miroslav_Maletic.jpg`)
- La detecție → TTS: *"Miroslav e în fața ta"* + notificare macOS
- Cooldown 30s per persoană (configurabil)

### Feedback haptic obstacole
- Polling ESP `/distance` la **5 Hz**
- Prag implicit **50 cm** → activează motorul direcțional
- Prag critic **30 cm** (toate 3 senzori) → activează M4
- Controlabil runtime via `/haptic/threshold`

### TTS ElevenLabs
- Model: `eleven_flash_v2_5` (~75ms latență)
- Voce: **Ana Maria** (română feminină, `urzoE6aZYmSRdFQ6215h`)
- Cache local MP3 în `tts_cache/` — nu regenerează același text
- Redare via `afplay` → iese pe device-ul audio implicit al Mac-ului
- Pentru boxă BT: setează ESP32 BT Speaker ca output implicit în System Settings → Sound

### OCR (EasyOCR)
- Activare: tasta `O` în fereastra OpenCV sau `POST /ocr`
- Burst 10s, captură la 2s interval
- La final → sumarizare automată GPT-4o-mini

### YOLO Object Detection
- Activare: tasta `D` sau `POST /detect`
- Model: YOLOv8n (lightweight)
- Alert pentru clasele din `YOLO_ALERT_CLASSES` (default: `bus`)

### GPT-4o-mini Scene Description
- Activare: tasta `G` sau `POST /describe`
- Trimite frame-ul curent la vision API
- Afișează descrierea overlay în fereastra OpenCV 12s

### Comenzi tastatură (fereastră OpenCV)

| Tastă | Acțiune |
|---|---|
| `O` | Toggle OCR burst |
| `D` | Toggle YOLO detection |
| `G` | GPT scene describe |
| `Q` | Ieșire |

---

## TTS pe boxa Bluetooth

1. Conectează ESP32 BT Speaker din **System Settings → Bluetooth**
2. Setează-l ca output implicit în **System Settings → Sound → Output**
3. `afplay` din `tts.py` va folosi automat outputul implicit

---

## Dependențe principale

| Pachet | Versiune instalată | Rol |
|---|---|---|
| `insightface` | 0.7.3 | Recunoaștere facială |
| `onnxruntime` | 1.24.3 | Inferență modele ONNX |
| `opencv-python` | 4.13.0 | Captură video + display |
| `fastapi` | 0.135.1 | API REST |
| `uvicorn` | latest | Server ASGI |
| `elevenlabs` | 2.39.0 | TTS |
| `easyocr` | 1.7.2 | OCR |
| `ultralytics` | 8.4.21 | YOLOv8 |
| `openai` | 2.28.0 | GPT-4o-mini |
| `httpx` | latest | Client HTTP async |
| `python-dotenv` | latest | Citire .env |
