# WorkTrack - Çalışan Takip ve Görev Yönetim Sistemi

Şeffaf, KVKK uyumlu, çalışan tarafından görülebilen kurumsal çalışma takip sistemi.

> **Önemli:** Bu sistem gizli takip, keylogger, ekran görüntüsü veya habersiz izleme yapmaz.

## Mimari

```
worktrack-system/
├── backend/          # NestJS + Prisma + PostgreSQL API
├── frontend/         # React + TypeScript Dashboard
├── desktop-agent/    # Electron masaüstü agent (Windows öncelikli)
└── docker-compose.yml
```

### Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Backend | NestJS, TypeScript, Prisma, PostgreSQL, JWT |
| Frontend | React, TypeScript, Vite, Recharts |
| Desktop | Electron, TypeScript |
| Storage | Local (S3/R2/Supabase'e taşınabilir) |

### Roller

- **SUPER_ADMIN** — Tüm sistem erişimi
- **MANAGER** — Kendi takımı/departmanı
- **EMPLOYEE** — Kendi verileri

## Hızlı Başlangıç

### Gereksinimler

- Node.js 20+
- Docker (PostgreSQL için)
- npm veya yarn

### 1. Veritabanı

```bash
cd worktrack-system
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

API: `http://localhost:3000/api`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Panel: `http://localhost:5173`

### 4. Desktop Agent (opsiyonel)

```bash
cd desktop-agent
npm install
npm run build
npm start
```

## Demo Hesaplar

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Süper Admin | admin@worktrack.local | Admin123! |
| Yönetici | manager@worktrack.local | Manager123! |
| Çalışan | ayse.demir@worktrack.local | Employee123! |

## API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Users
- `GET/POST /api/users`
- `GET/PATCH /api/users/:id`
- `PATCH /api/users/:id/deactivate`

### Departments
- `GET/POST /api/departments`
- `GET/PATCH/DELETE /api/departments/:id`

### Tasks
- `GET/POST /api/tasks`
- `GET/PATCH /api/tasks/:id`
- `PATCH /api/tasks/:id/status`
- `POST /api/tasks/:id/comments`

### Files
- `POST /api/files/upload`
- `GET /api/files`
- `GET /api/files/:id/download`

### Work Sessions
- `POST /api/work-sessions/start`
- `POST /api/work-sessions/stop`
- `GET /api/work-sessions/today`
- `GET /api/work-sessions/reports`

### Agent
- `POST /api/agent/heartbeat`
- `POST /api/agent/event`
- `POST /api/agent/sync`
- `GET /api/agent/settings`

### Reports
- `GET /api/reports/daily|weekly|monthly`
- `GET /api/reports/users/:id`
- `GET /api/reports/departments/:id`

## Geliştirme Aşamaları

| Aşama | Durum | İçerik |
|-------|-------|--------|
| 1 | ✅ | Backend, Auth, CRUD, Dashboard |
| 2 | 🔧 | Dosya, yorumlar, bildirimler |
| 3 | 🔧 | WorkSession, heartbeat, raporlama |
| 4 | 🔧 | Electron agent, idle, sync |
| 5 | 📋 | Grafikler, export, audit UI |

## Güvenlik

- bcrypt şifre hash
- JWT access + refresh token
- Role-based authorization
- Rate limiting (Throttler)
- Helmet güvenlik başlıkları
- Dosya upload validasyonu
- Audit log
- Soft delete

## KVKK / Etik

Sistemde **Şeffaflık ve Veri Kullanımı** ekranı bulunur. Çalışanlar hangi verilerin toplandığını ve toplanmadığını açıkça görebilir.

**Toplanan:** Çalışma süreleri, idle/mola/lock eventleri, görev hareketleri, dosya metadata

**Toplanmayan:** Keylogger, ekran görüntüsü, mikrofon/kamera, tarayıcı geçmişi

## Lisans

Özel proje — tüm hakları saklıdır.
