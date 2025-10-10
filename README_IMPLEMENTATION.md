# SuiVerify — Implementation Overview

This README documents the SuiVerify project architecture, how the components fit together, how the code is organized, and how to run and test the system locally. It focuses on the implementation in this repository (backend, frontend, and infra pieces).

Repository layout (high-level)
- contracts/: Move contracts used for on-chain pieces
- frontend/: React + TypeScript frontend (Vite)
- nautilus_infra/: Rust + container infra for Sui/nautilus components
- suiverify-sdk/: TypeScript SDK to interact with SuiVerify services
- verification-backend/: Python FastAPI backend (OCR, Face, OTP, DB, Redis)
- scripts/: local automation for Gemini indexing (setup/index)
- docs/: documentation and guides (including Gemini setup and Ghana migration)

Backend (verification-backend)
- Framework: FastAPI with async lifespan management
- Key services:
  - OCRService (app.services.ocr_service) — extracts Aadhaar information from images
  - Face recognition service (app.services.face_recognition_service) — performs face matching
  - OTPService (app.services.otp_service) — handles OTP generation and verification
  - encryption_service (app.services.encryption_service) — encryption metadata and indexes
  - redis_service (app.services.redis_service) — caching and transient storage
  - database (app.database) — MongoDB connection and models

How startup works
- main.py registers a lifespan manager that:
  - connects to MongoDB
  - creates indexes for encryption metadata
  - initializes OCR, face, and OTP services
  - tests Redis connectivity

Health endpoints
- `/` — basic status and service readiness
- `/health` — detailed health of OCR, face, OTP, Redis

Routers
- The backend exposes routers under `/api` and subpaths for Aadhaar, face, OTP, KYC, encryption metadata, credentials, and user management.

Frontend (frontend)
- Vite React TypeScript app in `frontend/`
- Key components in `frontend/src/components/` handle the KYC flow (Aadhaar upload, face verification steps, OTP verification, and NFT claim success screens).

Indexing & Gemini/Cursor integration
- Scripts in `scripts/` help set up and index repository contents to a Gemini/Cursor instance.
  - `setup_gemini.ps1` — interactive setup and key collection
  - `index_gemini.ps1` — single-target indexer
  - `index_all_gemini.ps1` — repository-wide indexer (builds commands and runs them sequentially)
- These scripts require a valid `GEMINI_API_KEY` (or `CURSOR_API_KEY`) set in `.env` or environment variables.

Running locally (backend)
1. Create a Python virtual environment and install requirements

```powershell
python -m venv .venv; .\.venv\Scripts\Activate; pip install -r verification-backend\requirements.txt
```

2. Create an `.env` (or edit `verification-backend/.env.example`) with keys for MongoDB, Redis, OTP provider, and any secrets.

3. Start the backend (development):

```powershell
cd verification-backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Running locally (frontend)
1. Install dependencies (requires pnpm or npm)

```powershell
cd frontend
pnpm install
pnpm run dev
```

Gemini/Cursor indexing (local)
1. Run the interactive setup script (from repo root):

```powershell
.\scripts\setup_gemini.ps1
```

2. After setup, index the repository (example):

```powershell
.\scripts\index_all_gemini.ps1
```

Security & Secrets
- `.env` is ignored by the repo `.gitignore`. Do not commit secrets. Prefer a secret manager for production deployments.

Deployment notes
- Backend: containerize with Docker and use a process manager or Kubernetes. Use environment variables (not .env) for production.
- Frontend: build assets via `pnpm run build` and serve with a static hosting service or behind Nginx.

Next improvements
- Integrate indexing as a CI step with encrypted secrets
- Add unit and integration tests for backend services (OCR and face matching)
- Add automated data privacy checks for PII handling

Contact
- See `docs/` for more guides including Gemini setup and country migration instructions.
