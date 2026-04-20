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
3. Pastikan `DB_NAME=recruitment_ms`
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
DB_NAME=recruitment_ms
DB_CONNECTION_LIMIT=10
CORS_ORIGIN=*
JWT_SECRET=change-this-secret
JWT_EXPIRES_IN=12h
```

## Base URL

```text
http://localhost:3001/api
```

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
