# TruthLens Backend Integration Contract & Status

The TruthLens frontend is integrated with the TruthLens Phase 3.1 FastAPI backend.

## Confirmed Backend Contract

1. **Base URL:** `http://127.0.0.1:8000` (configurable via `VITE_TRUTHLENS_API_URL`).
2. **Analysis Endpoint:** `POST /api/v1/analyze` (synchronous in-memory forensic analysis).
3. **Form Field:** `file` (multipart/form-data `UploadFile`).
4. **Health Endpoint:** `GET /health` returning `{ "application": "TruthLens", "status": "healthy", "version": "..." }`.
5. **Supported Formats:** JPEG, PNG, WebP.
6. **Maximum File Size:** 15 MB (`15 * 1024 * 1024` bytes).
7. **Response Schema:** `AnalyzeResponse` containing:
   - `success`: `boolean`
   - `application`: `"TruthLens"`
   - `phase`: `"phase_3"`
   - `image_properties`: `ImageProperties`
   - `sha256`: `string` (64-character hexadecimal digest)
   - `analyses`: array of `AnalysisItem` containing:
     - `metadata`: EXIF details, camera make/model, timestamps, software, GPS presence, fields found/missing.
     - `ela`: Error Level Analysis scale factor, differences, channel stats, 4×4 regional grid, and difference image data URL.
     - `noise`: Gaussian smoothing sigma, residual std, statistics, channel stds, 4×4 regional grid, and visualization data URL.
     - `frequency`: 2D FFT Hann-windowed spectrum, low/mid/high energy percentages, spectral centroid, spectral entropy, and visualization data URL.
     - `regional_anomaly`: 4×4 spatial anomaly tiles with deviation scores, neighbor contrast, feature z-scores, and visualization data URL.
     - `synthesis`: Evidence summary relationship category, primary contributing domains, cross-domain relationships, key observations, and regional spatial synthesis.
   - `assessment`: `{ "status": "COMPLETE", "summary": string, "limitations": string[] }`.

## Active Environment Variables

- `VITE_TRUTHLENS_API_URL`: Backend URL (defaults to `http://127.0.0.1:8000`).
- `VITE_TRUTHLENS_ANALYSIS_PATH`: Path to image analysis route (defaults to `/api/v1/analyze`).
- `VITE_TRUTHLENS_HEALTH_PATH`: Path to health check (defaults to `/health`).
- `VITE_TRUTHLENS_REQUEST_TIMEOUT_MS`: Request timeout in ms (defaults to `60000`).
