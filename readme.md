# Solemtrix — Next.js + FastAPI + Neon

**Aplicație MVP pentru îngrijitori – urmărire în timp real a bastonului inteligent.**

---

## Arhitectură

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Caregiver)                                    │
│  Next.js 15 · TypeScript · Tailwind CSS                 │
│  Polling la fiecare 3s → GET /locations/{id}/latest     │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP / REST (JSON)
┌───────────────────▼─────────────────────────────────────┐
│  FastAPI (Python 3.11+)                                 │
│  JWT Auth · SQLAlchemy · Uvicorn                        │
└───────────────────┬─────────────────────────────────────┘
                    │ SQLAlchemy / psycopg2
┌───────────────────▼─────────────────────────────────────┐
│  Neon Postgres (PostgreSQL 16)                          │
│  users · canes · cane_access                           │
│  latest_locations · location_history                   │
└─────────────────────────────────────────────────────────┘
```

**Flux locație (MVP – simulat):**
Telefonul / Simulatorul → `POST /locations/{caneId}/update` → Neon → Front-end polling

**Flux locație (producție viitoare):**
Baston real / Aplicație mobilă → același endpoint → același front-end, zero modificări

---

## Structura proiectului

```
solemtrix-next/
├── backend/
│   ├── main.py                 # FastAPI app + CORS + routers
│   ├── database.py             # SQLAlchemy engine + session
│   ├── models.py               # ORM models (User, Cane, CaneAccess, LatestLocation, LocationHistory)
│   ├── schemas.py              # Pydantic schemas
│   ├── auth.py                 # JWT helpers + password hashing
│   ├── routers/
│   │   ├── auth.py             # POST /auth/signup, POST /auth/login
│   │   ├── users.py            # GET /users/me
│   │   ├── canes.py            # GET/POST/DELETE /canes/
│   │   └── locations.py        # GET/POST /locations/{id}/latest|update|history
│   ├── requirements.txt
│   └── .env.example
├── database/
│   └── init.sql                # Schema Neon Postgres (rulează o singură dată)
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root layout (HTML lang="ro")
│   │   │   ├── globals.css             # Tailwind directives
│   │   │   ├── (auth)/auth/page.tsx    # Login + Signup
│   │   │   └── (app)/
│   │   │       ├── layout.tsx          # Auth guard (redirect dacă nu e autentificat)
│   │   │       ├── page.tsx            # Pagina principală cu hartă live
│   │   │       ├── settings/page.tsx   # Setări cont
│   │   │       └── simulator/page.tsx  # Debug GPS sender
│   │   ├── components/
│   │   │   ├── OnboardingModal.tsx     # 4 pași onboarding în română
│   │   │   ├── EnrollmentModal.tsx     # Înrolare baston (cod manual)
│   │   │   ├── CaneSidebar.tsx         # Lista bastoane + buton +
│   │   │   ├── CaneMap.tsx             # Google Map cu marker (client-only)
│   │   │   └── LocationPanel.tsx       # Overlay coordonate / status / timestamp
│   │   ├── lib/
│   │   │   ├── api.ts                  # Fetch wrapper cu Bearer token
│   │   │   └── auth.ts                 # JWT în localStorage
│   │   └── types/index.ts              # TypeScript interfaces
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── .env.local.example
└── README.md
```

---

## Cerințe preliminare

- **Node.js 18+** și **npm 9+**
- **Python 3.11+** și **pip**
- Cont **[Neon](https://neon.tech/)** (tier gratuit este suficient)
- Cont **Google Cloud** cu **Maps JavaScript API** activat

---

## 1. Baza de date – Neon Postgres

1. Creează un proiect nou pe [neon.tech](https://neon.tech/).
2. Din **Dashboard → Connection details**, copiază connection string-ul
   (formatul: `postgresql://user:pass@host/dbname?sslmode=require`).
3. În interfața SQL Neon (sau orice client Postgres), rulează fișierul:

```bash
# Cu psql local:
psql "postgresql://user:pass@host/dbname?sslmode=require" -f database/init.sql

# Sau copiază conținutul fișierului direct în editorul SQL Neon
```

---

## 2. Backend – FastAPI

```bash
cd backend

# Creează mediu virtual
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Instalează dependențe
pip install -r requirements.txt

# Configurează variabilele de mediu
copy .env.example .env   # Windows
# cp .env.example .env   # Linux/macOS
```

Editează `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
SECRET_KEY=un_sir_lung_aleatoriu_de_minim_32_caractere
ALLOWED_ORIGINS=http://localhost:3000
```

Pornește serverul:

```bash
uvicorn main:app --reload --port 8000
```

Documentație API automată: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 3. Frontend – Next.js

```bash
cd frontend

# Instalează dependențe
npm install

# Configurează variabilele de mediu
copy .env.local.example .env.local   # Windows
# cp .env.local.example .env.local   # Linux/macOS
```

Editează `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=cheia_ta_google_maps
```

> **Google Maps API key:** [Google Cloud Console](https://console.cloud.google.com/) →
> Activează **Maps JavaScript API** → Credentials → Create API key.

Pornește aplicația:

```bash
npm run dev
```

Deschide [http://localhost:3000](http://localhost:3000).

---

## 4. Flux de utilizare

### Prima utilizare
1. Accesează [http://localhost:3000/auth](http://localhost:3000/auth).
2. Creează un cont nou.
3. Se afișează onboarding-ul în română (4 pași).

### Adaugă un baston
1. Pe pagina principală, apasă **+** din sidebar.
2. Introdu un cod baston (ex: `cane_demo_001`) sau generează unul automat.
3. Dă un nume opțional → **Asociază baston**.

### Simulează locația
1. Mergi la [http://localhost:3000/simulator](http://localhost:3000/simulator).
2. Selectează bastonul.
3. Introdu coordonate (ex: București: 44.4268, 26.1025).
4. **Trimite manual** sau pornește **Simulare auto** (trimite la fiecare 3 secunde).
5. Pe pagina principală, harta se actualizează automat (polling 3s).

---

## 5. Endpoint-uri API

| Metodă | Endpoint | Descriere |
|--------|----------|-----------|
| POST | `/auth/signup` | Înregistrare cont nou |
| POST | `/auth/login` | Autentificare, returnează JWT |
| GET | `/users/me` | Profil utilizator curent |
| GET | `/canes/` | Lista bastoane asociate |
| POST | `/canes/enroll` | Înrolează un baston nou |
| DELETE | `/canes/{id}` | Dezasociază baston |
| GET | `/locations/{id}/latest` | Ultima locație a unui baston |
| POST | `/locations/{id}/update` | Actualizează locația (simulator / device) |
| GET | `/locations/{id}/history` | Istoric traseu (pregătit pentru viitor) |

**Toate endpoint-urile (excepție: `/auth/*`) necesită header:**
```
Authorization: Bearer <jwt_token>
```

---

## 6. Schema Neon Postgres

```sql
users           – id (UUID) · email · hashed_password · created_at
canes           – id (TEXT, = codul QR) · name · created_at
cane_access     – id · caregiver_id → users · cane_id → canes · linked_at
                  UNIQUE(caregiver_id, cane_id)
latest_locations – cane_id (PK) → canes · latitude · longitude · accuracy · recorded_at · source
location_history – id · cane_id → canes · latitude · longitude · accuracy · recorded_at · source
                   INDEX(cane_id, recorded_at DESC)
```

**Relație many-to-many:** un îngrijitor → multe bastoane, un baston → mulți îngrijitori.

---

## 7. Online / Offline

Logica de stale detection este în `frontend/src/components/LocationPanel.tsx`:

```ts
const STALE_MS = 5 * 60 * 1000; // 5 minute
const isOnline = location != null &&
  Date.now() - new Date(location.recorded_at).getTime() < STALE_MS;
```

Ajustează `STALE_MS` după nevoie.

---

## 8. Înlocuire simulator cu dispozitiv real

Când bastonul sau telefonul real trimite GPS, va apela același endpoint:

```
POST /locations/{cane_id}/update
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "latitude": 44.4268,
  "longitude": 26.1025,
  "accuracy": 5.0,
  "source": "phone"
}
```

**Zero modificări la frontend sau schema bazei de date.**

---

## 9. Îmbunătățiri viitoare

- **Traseu pe hartă** – activează scrierea în `location_history`, desenează `Polyline` pe `CaneMap.tsx`
- **WebSocket / SSE** – înlocuiește polling-ul cu push real-time din FastAPI
- **Notificări push** – alertă când bastonul intră offline > X minute
- **QR generator** – pagină care generează și afișează QR SVG pentru un cod baston nou
- **Aplicație mobilă** – React Native sau Flutter care trimite GPS continuu la backend
- **PWA** – `next-pwa` pentru instalare pe telefon
- **Autentificare avansată** – refresh tokens, OAuth (Google)
- **Geofencing** – alertă la ieșire din zonă definită
