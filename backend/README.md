# TruthLens Backend

FastAPI service for image forensic analysis.

**Phase:** `phase_2a`  
**Tagline:** See beyond the image. Verify what is real.

## Overview

Phase 2A provides:

1. Safe image upload intake (in-memory)
2. Format and integrity validation
3. Image property extraction
4. SHA-256 fingerprinting of the original file bytes
5. EXIF / metadata extraction and interpretation

ELA, noise, frequency, regional anomaly, and authenticity scoring are **not** implemented and are never fabricated.

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, routers
│   ├── api/routes/          # HTTP endpoints
│   ├── core/                # Settings and error handling
│   ├── models/              # Pydantic response contracts
│   ├── services/            # Validation, hashing, metadata
│   └── utils/               # Image I/O helpers
├── tests/
├── requirements.txt
├── .env.example
└── README.md
```

## Installation

Requires **Python 3.11+**.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional local overrides
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `TruthLens` | Application name |
| `APP_VERSION` | `1.0.0` | API version |
| `DEBUG` | `false` | Debug flag |
| `CORS_ORIGINS` | Vite/local origins | Comma-separated allowed origins |
| `MAX_UPLOAD_BYTES` | `15728640` (15 MB) | Max upload size |
| `MAX_IMAGE_DIMENSION` | `12000` | Max width or height |
| `MAX_PIXEL_COUNT` | `40000000` | Max total pixels |

See `.env.example` for safe placeholders. Do not commit a real `.env`.

CORS uses an explicit origin allowlist. Wildcard origins are not combined with credentials.

## Running the server

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Swagger UI: http://localhost:8000/docs  
- OpenAPI schema: http://localhost:8000/openapi.json  

## Running tests

```bash
cd backend
source .venv/bin/activate
pytest
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health |
| `POST` | `/api/v1/analyze` | Validation + properties + SHA-256 + metadata |

### Sample curl

```bash
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -F "file=@sample.jpg"
```

## Metadata extraction (Phase 2A)

### Supported formats

| Format | Notes |
|--------|--------|
| JPEG | Full classic EXIF support when present |
| PNG | Often has no EXIF; absence is normal |
| WEBP | EXIF optional depending on encoder; absence is common |

### Fields extracted when present

- Camera make / model
- Lens information (when available)
- Orientation
- Capture / digitized date-time
- Software / processing software indicators
- Color space
- EXIF version
- GPS **presence** and GPS **field names only**

### GPS privacy

- Exact GPS coordinates are **never** returned by default
- The API reports `gps_present` and `gps_fields_present` (tag names only)
- Latitude / longitude / altitude values are withheld

### Interpretation rules

- Missing metadata ≠ AI-generated or manipulated
- Camera metadata ≠ authenticity
- Software tags alone ≠ proof of editing
- No authenticity percentage or binary fake/authentic verdict

### Analysis status meanings

| Status | Meaning |
|--------|---------|
| `completed` | Metadata analysis finished (EXIF may be present or absent) |
| `failed` | Parsing failed defensively; see `details.parse_errors` |

Empty EXIF is reported as `completed` with `exif_present: false`, not as failure.

## Implemented forensic modules

1. Image validation and properties
2. SHA-256 identity fingerprint
3. EXIF / metadata analysis

## Unimplemented modules

1. Error Level Analysis (ELA)
2. Noise residual analysis
3. Frequency-domain analysis
4. Regional anomaly analysis
5. Multi-signal evidence assessment beyond `INCOMPLETE`

## Frontend integration

- Contract-first via `/openapi.json`
- `POST /api/v1/analyze` accepts `multipart/form-data` field `file`
- Metadata results appear in `analyses[]` with `name: "metadata"`
- Configure `CORS_ORIGINS` for the frontend developer’s Vite origin
- Do not modify the `frontend/` tree from the backend agent
