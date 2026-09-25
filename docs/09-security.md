# X-Ray — Security

## Overview

X-Ray processes potentially sensitive source code uploaded by users. This document defines the
security controls, risks, and mitigations that must be implemented — even for the MVP.

The core principle is: **handle uploaded code as if it is sensitive, and never expose it
unnecessarily to external services.**

---

## 1. Credential Management

### Rules

| Rule | Implementation |
|---|---|
| No hardcoded credentials | Enforced by code review; `.env` in `.gitignore` |
| API keys from environment | All secrets loaded via `backend/config.py` using `pydantic-settings` |
| `.env.example` provided | Documents all required variables without values |
| No secrets in logs | Logger must never print environment variables or API keys |
| No secrets in API responses | API responses never include configuration or key data |

### Configuration Pattern

```python
# backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    WATSONX_API_KEY: str
    WATSONX_URL: str
    WATSONX_PROJECT_ID: str
    WATSONX_MODEL_ID: str = "ibm/granite-13b-chat-v2"

    UPLOAD_DIR: str = "/tmp/xray"
    MAX_UPLOAD_SIZE_MB: int = 50
    REPO_TTL_SECONDS: int = 3600

    class Config:
        env_file = ".env"

settings = Settings()
```

**Never** call `settings.WATSONX_API_KEY` in a log statement or include it in any response.

---

## 2. File Upload Security

### Risks

| Risk | Description |
|---|---|
| Path traversal | A zip file with `../../etc/passwd` style paths could write to unexpected locations |
| Zip bomb | A malicious zip could expand to gigabytes |
| Executable upload | A zip could contain executable scripts that get run |
| Large file DoS | A very large upload could fill disk or memory |

### Mitigations

| Control | Implementation |
|---|---|
| **Path traversal prevention** | Use `zipfile.ZipFile` safe extraction; validate all extracted paths are within the target directory |
| **Zip bomb protection** | Check uncompressed size before extraction; reject if > `MAX_UPLOAD_SIZE_MB * 10` |
| **File size limit** | FastAPI `UploadFile` with size limit enforced in the upload router |
| **No execution** | The application never executes uploaded files; only reads and parses them |
| **Extension filtering** | Only `.py` files are passed to the parser; all others are skipped |

### Safe Extraction Pattern

```python
import zipfile
import os

def safe_extract(zip_path: str, target_dir: str, max_size_bytes: int):
    with zipfile.ZipFile(zip_path) as zf:
        # Check for path traversal
        for member in zf.namelist():
            member_path = os.path.realpath(os.path.join(target_dir, member))
            if not member_path.startswith(os.path.realpath(target_dir)):
                raise SecurityError(f"Path traversal detected: {member}")

        # Check uncompressed size
        total_size = sum(info.file_size for info in zf.infolist())
        if total_size > max_size_bytes:
            raise SecurityError(f"Archive too large: {total_size} bytes")

        zf.extractall(target_dir)
```

---

## 3. Repository Isolation

Each uploaded repository is stored in an isolated directory:

```
/tmp/xray/{repo_id}/
    raw.zip          ← uploaded zip (deleted after extraction)
    src/             ← extracted source files
    graph.json       ← computed dependency graph
```

Where `repo_id` is a UUID generated at upload time.

### Rules

- Repositories are never stored in a shared directory where one repo can read another
- `repo_id` is a UUID — not guessable or sequential
- No API endpoint exposes the file system path to the client
- The `repo_id` is the only identifier; it is not derived from the file name

---

## 4. Data Sent to AI Services

**Rule: Source code is never sent to watsonx.ai or any external AI service.**

Only structural metadata is sent:
- Component names (file paths, class names, function names)
- Relationship types (import, call, inheritance)
- Numeric impact metrics (counts, depths, scores)
- The user's optional change description (plain text typed by the user)

### What is NOT sent

- Source code text
- Variable names or values
- Comments or docstrings
- String literals (which could contain secrets)
- File contents of any kind

### Why This Matters

Even public repositories may contain:
- API keys accidentally committed
- Database passwords in config files
- Internal infrastructure hostnames
- Proprietary business logic

By sending only structural metadata, X-Ray eliminates this risk category entirely.

---

## 5. Secrets Detection (Future)

In a future version, X-Ray should scan uploaded repositories for accidentally committed secrets
before processing them — and warn the user rather than silently including that data.

For the MVP, this is not implemented but should be documented as a planned feature.

Common patterns to detect in a future version:
- Strings matching `sk_live_`, `AKIA`, `ghp_` (API key prefixes)
- Files named `.env` with `KEY=value` patterns
- `password =` patterns in configuration files

---

## 6. Temporary File Cleanup

Uploaded repositories must be cleaned up to prevent disk exhaustion and data leakage.

### Strategy

| Event | Action |
|---|---|
| User clears repository | Immediately delete `/tmp/xray/{repo_id}/` |
| TTL expiry (1 hour) | Background task deletes expired repo directories |
| Application shutdown | Optional: clean up all active repos |

### Implementation

```python
import shutil
import os

def cleanup_repository(repo_id: str, upload_dir: str):
    repo_path = os.path.join(upload_dir, repo_id)
    if os.path.exists(repo_path):
        shutil.rmtree(repo_path)
```

A background task runs every 15 minutes to find and delete repos older than `REPO_TTL_SECONDS`.

---

## 7. Logging Safety

### Rules

- Log **events** (scan started, file parsed, error occurred) — not data
- Never log: file contents, prompt text sent to AI, API keys, user-provided text
- Log levels:
  - `INFO`: normal operations (scan started, completed, node selected)
  - `WARNING`: degraded operations (git unavailable, file parse failed)
  - `ERROR`: failures with context (scan failed for repo_id, AI request failed)
  - `DEBUG`: detailed tracing (for development only; disabled in production)

### Example — Safe Log vs Unsafe Log

```python
# SAFE
logger.info(f"Scan started for repo_id={repo_id}, file_count={len(file_paths)}")
logger.warning(f"Failed to parse file: {file_path}, error: {type(e).__name__}")

# UNSAFE — never do this
logger.debug(f"Source code: {source_text}")
logger.info(f"Sending to AI: {prompt}")
logger.error(f"API key used: {settings.WATSONX_API_KEY}")
```

---

## 8. CORS and API Security

For the MVP (local development), CORS is configured to allow requests from `localhost:5173`
(Vite dev server) only.

```python
# backend/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)
```

For any deployed version, CORS must be restricted to the known frontend origin only.

---

## 9. Input Validation

All API inputs are validated by Pydantic models before reaching service logic.

Examples:
- `node_id` must be a non-empty string matching the known ID format
- `repo_id` must be a valid UUID
- `change_description` must be a string, max 500 characters (to cap prompt size)
- File uploads must have `content_type: application/zip`

Invalid inputs are rejected with HTTP 422 before any processing occurs.

---

## 10. Security Risks Summary

| Risk | Likelihood (MVP) | Mitigation |
|---|---|---|
| Hardcoded credentials | Low (code review) | `.env` pattern + `.gitignore` |
| Path traversal via zip | Medium | Safe extraction with path validation |
| Zip bomb | Low | Uncompressed size check before extraction |
| Source code leaked to AI | None | Structural metadata only in prompts |
| Repo data exposed to other users | Low (single-user MVP) | UUID isolation |
| Log leaking sensitive data | Low (with rules) | Logging guidelines above |
| Large upload DoS | Medium | File size limit enforcement |
| Prompt injection via filenames | Low | Filenames treated as data, not instructions |

---

## 11. Future Security Work

The following are not required for the MVP but should be addressed before any public deployment:

- Rate limiting on upload and scan endpoints
- Authentication for the X-Ray application itself
- Secret scanning of uploaded repositories before processing
- Audit logging of all repository operations
- HTTPS enforcement
- Content Security Policy headers
- Dependency vulnerability scanning (`pip audit`, `npm audit`)
