# RWVCA Backend

Rwanda Wood Value Chain Association — REST API (Node.js / Express / PostgreSQL).

This folder is the new backend. `UR_SAMPLE_PROJECT/WARS_BACKEND` is only a structure reference.

## Stack

- Node.js + Express
- Sequelize ORM
- PostgreSQL
- JWT authentication
- Swagger UI (`/api/v1/docs`)

## Configuration

Copy `.env.example` to `.env` and point at the empty local database:

```
DEV_DATABASE_NAME=rwvca
DEV_DATABASE_USER=postgres
DEV_DATABASE_PASSWORD=password
DEV_DATABASE_HOST=localhost
DEV_DATABASE_PORT=5432
```

Models and migrations were generated from the PHP `database.sql` schema. There are no seeders — production already has data.

## Development

```bash
cd BACKEND
npm install
npm run migrate
npm run start:dev
```

- API base: `http://127.0.0.1:9000/api/v1/`
- Health: `http://127.0.0.1:9000/api/v1/health`
- Docs: `http://127.0.0.1:9000/api/v1/docs`
