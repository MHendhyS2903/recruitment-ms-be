# Recruitment API

Backend `Express.js` + TypeScript untuk flow recruitment sesuai schema `recruitment_ms`:

`Recruiter TO_DO -> Recruiter READY_TO_INTERVIEW -> Sales TO_DO -> Sales INTERVIEWING -> Interview Schedule`

## Struktur Project

```text
src/
  modules/
    auth/
    candidates/
    recruiter/
    sales/
    interviews/
    dashboard/
  shared/
    auth/
    db/
    http/
  config/
  middleware/
  routes/
  utils/
```

## Setup

1. Import schema MySQL dari `internal/db/mysql/recruitment_schema.sql`
2. Copy `.env.example` menjadi `.env`
3. Pastikan database mengarah ke `railway` atau set env Railway bawaan
4. Jalankan:

```bash
npm install
npm run dev
```

Script lain:

```bash
npm run build
npm start
npm run start:prod
```

## Environment

```env
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=railway
DB_CONNECTION_LIMIT=10
CORS_ORIGIN=*
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=12h
UPLOAD_DIR=./uploads
```

## Base URL

```text
http://localhost:3001/api
```

## Railway Deploy

Backend ini sudah mendukung env Railway bawaan. Anda bisa memakai salah satu dari dua pendekatan berikut:

### Opsi 1: pakai env app sendiri

```env
DB_HOST=mysql.railway.internal
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=railway
DB_CONNECTION_LIMIT=10
JWT_SECRET=your_random_secret
JWT_EXPIRES_IN=12h
CORS_ORIGIN=https://your-frontend-domain.com
NODE_ENV=production
UPLOAD_DIR=/data/uploads
```

### Opsi 2: pakai env bawaan Railway

App ini otomatis fallback ke variable berikut bila `DB_*` tidak diisi:

```env
MYSQLHOST
MYSQLPORT
MYSQLUSER
MYSQLPASSWORD
MYSQLDATABASE
MYSQL_DATABASE
MYSQL_URL
DATABASE_URL
```

Yang tetap perlu Anda set manual di service backend:

```env
JWT_SECRET=your_random_secret
JWT_EXPIRES_IN=12h
CORS_ORIGIN=https://your-frontend-domain.com
NODE_ENV=production
UPLOAD_DIR=/data/uploads
```

Catatan:

- `UPLOAD_DIR=/data/uploads` disarankan bila Anda mount Railway Volume.
- Jika tidak memakai volume, upload file lokal bisa hilang saat redeploy atau restart.
- Start command yang dipakai project ini adalah `npm start`.

## Implemented Endpoints

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /candidates`
- `POST /candidates`
- `GET /candidates/:candidateId`
- `PATCH /candidates/:candidateId`
- `DELETE /candidates/:candidateId`
- `GET /candidates/:candidateId/history`
- `GET /candidates/:candidateId/documents`
- `POST /candidates/:candidateId/documents`
- `POST /candidates/:candidateId/photo`
- `DELETE /candidates/:candidateId/documents/:documentId`
- `GET /recruiter/candidates`
- `GET /recruiter/candidates/:candidateId`
- `PATCH /recruiter/candidates/:candidateId`
- `POST /recruiter/candidates/:candidateId/process`
- `DELETE /recruiter/candidates/:candidateId`
- `GET /sales/candidates`
- `GET /sales/candidates/:candidateId`
- `PATCH /sales/candidates/:candidateId`
- `POST /sales/candidates/:candidateId/process`
- `DELETE /sales/candidates/:candidateId`
- `GET /interviews`
- `GET /interviews/:interviewId`
- `POST /interviews`
- `PATCH /interviews/:interviewId`
- `DELETE /interviews/:interviewId`
- `GET /dashboard`

## Response Format

Sukses:

```json
{
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "scheduledAt is required",
    "details": {
      "scheduledAt": ["scheduledAt is required"]
    }
  }
}
```

## Notes

- File upload kandidat disimpan ke local storage dan diexpose lewat path `/files/...`.
- Endpoint `master-report` dan import/export belum diimplementasikan.
- Login memakai `bcrypt` hash pada kolom `users.password_hash`.
- Endpoint recruiter dan sales memakai validasi role berbasis JWT bearer token.
