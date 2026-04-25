# The_Social_Event_Discovery_App

CPSC 491- Senior Capstone Project in Computer Science

## Frontend (Web)

The web client lives in `frontend/eventconnect-web`.

### Run locally

```bash
cd frontend/eventconnect-web
npm install
npm run dev

## Tech Stack
- Frontend: React + Vite + Tailwind + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL + Redis
- Auth: JWT + Google OAuth
- Testing: Jest + Supertest (backend), Vitest (frontend)
- CI/CD: GitHub Actions
```

## Backend

### Team Setup Guide (Backend)

````bash


Follow these steps to run the backend locally.


---


## 1 - Install Required Tools (One-Time Setup)


Make sure you have installed:


- Node.js (LTS version recommended)
- Docker Desktop
- Git


Verify installations:


```bash
node -v
npm -v
docker -v
docker compose version
git --version


## 2 Start PostgreSQL and Redis (Docker)


From the project root (where docker-compose.yml is located):
- docker compose up -d


Verify containers are running:
- docker compose ps


## 3 Create Backend Environment File


Create this file:
- backend/.env


Paste the following:


PORT=4000


# PostgreSQL
PG_HOST=localhost
PG_PORT=5499
PG_USER=myuser
PG_PASSWORD=mypassword
PG_DATABASE=mydb


# Redis
REDIS_URL=redis://localhost:6379
note - Make sure these values match your docker-compose.yml configuration.


## 4 Install Backend Dependencies
- cd backend
- npm install
- npm run dev


## Backend runs at:
- http://localhost:4000


## Running Backend Tests
- npm test

## Running Frontend Tests
cd frontend/eventconnect-web
npx vitest run

## Secret Keys & APIs (Fill these in!)
TICKETMASTER_API_KEY=ask_the_team_for_the_current_key
GOOGLE_CLIENT_ID=ask_peter_for_client_id
GOOGLE_CLIENT_SECRET=ask_peter_for_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
JWT_SECRET=ask_peter_for_the_local_secret_or_make_one_up
SESSION_SECRET=ask_peter_for_the_local_secret_or_make_one_up

note - If you run your backend on a port other than 4000, Google login will fail due to an origin mismatch.
````

## CI/CD Pipeline

Three GitHub Actions workflows run on every push and pull request:

- **node-build.yml:** installs dependencies and builds both frontend and backend to catch any build failures early
- **backend-integration.yml:** spins up PostgreSQL and Redis, runs migrations, and executes the full backend test suite with coverage reporting
- **db-validation.yml:** runs migrations against a clean PostgreSQL instance and verifies all required tables and foreign key constraints exist
