# Live Streaming + One-Time Access Code

ระบบถ่ายทอดสดพร้อม Access Code แบบ one-time ตาม TOR

## โครงสร้างโปรเจกต์

- `backend/` Express + TypeScript + Prisma + PostgreSQL
- `frontend/` React + Vite + Material UI + hls.js
- `streaming/rtmp-hls/` RTMP ingest + HLS output (nginx-rtmp + ffmpeg)
- `deploy/reverse-proxy/` Nginx reverse proxy
- `docker-compose.yml` รวม services `api`, `web`, `postgres`, `rtmp-hls`, `reverse-proxy`

## Backend features

- `GET /health`
- `POST /api/redeem`
- `GET /api/stream-url?eventId=...`
- `POST /api/heartbeat`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/me`
- `GET /api/admin/events`
- `POST /api/admin/events`
- `PATCH /api/admin/events/:id`
- `POST /api/admin/codes/bulk` (สูงสุด 10,000 ต่อครั้ง)
- `GET /api/admin/codes/export.csv?eventId=...`

## Data model

Prisma schema ครอบคลุมตาราง:

- `events`
- `access_codes`
- `redemptions`
- `viewer_sessions`
- `admins`
- `audit_logs`

Seed เริ่มต้น:

- Event ตัวอย่าง 1 รายการ
- Admin จาก `ADMIN_EMAIL` / `ADMIN_PASSWORD`

## รันแบบ Local (dev)

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:up
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

ถ้าเจอ `Can't reach database server at localhost:5432`:

```bash
cd backend
npm run db:up
npm run prisma:seed:with-db
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev: `http://localhost:5173`
Backend dev: `http://localhost:4000`

## Deploy แบบ Docker Compose

> ต้องมี Docker/Compose บนเครื่อง target VPS

```bash
docker compose up -d --build
```

หลังจากระบบขึ้นแล้ว:

1. เปิด `http://<server-ip>/health`
2. เปิด `http://<server-ip>/admin/login`
3. login ด้วย admin จาก env ใน `docker-compose.yml`

## HTTPS (Production)

- default compose ใช้ `deploy/reverse-proxy/nginx.conf` (HTTP)
- สำหรับ production HTTPS ให้สลับไปใช้ `deploy/reverse-proxy/nginx.tls.conf`
- mount cert เข้า container ที่ `/etc/nginx/certs/fullchain.pem` และ `/etc/nginx/certs/privkey.pem`

## OBS -> RTMP -> HLS

- RTMP URL: `rtmp://<server-ip>/live`
- Stream Key: ใช้ค่า `streamKey` จาก event ในหน้า admin
- HLS output: `http://<server-ip>/hls/live/<streamKey>/index.m3u8`

ระบบ backend จะคืน `playbackUrl` จาก `event.hls_path` ซึ่ง default เป็น `live/<streamKey>/index.m3u8`

## Security ที่ใส่ไว้

- HttpOnly cookie สำหรับ `viewer_token` และ `admin_token`
- Rate limit ที่ `/api/redeem`
- Code format validation `^[A-Z0-9]{8}$`
- Audit log สำหรับ admin action หลัก
- Concurrent policy: fixed 1 session/code + keep oldest (session ใหม่โดนปฏิเสธถ้ามี active เดิม)

## Tests

Backend unit tests:

```bash
cd backend
npm test
```

ครอบคลุม policy ของ redeem และ session stale/concurrent
