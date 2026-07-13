"""
dependencies.py
FastAPI dependencies injected into route handlers via Depends().
Currently handles JWT verification and current-user extraction.
"""
import time
import base64
import hashlib
from typing import Optional

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import JWT_SECRET, TOKEN_TTL_SEC, USERS

security = HTTPBearer(auto_error=False)

# ── Token helpers ─────────────────────────────────────────────────────────────

def make_token(email: str) -> str:
    """Create a signed base64 token valid for TOKEN_TTL_SEC seconds."""
    expiry  = int(time.time()) + TOKEN_TTL_SEC
    payload = f"{email}:{expiry}"
    sig     = hashlib.sha256(f"{payload}{JWT_SECRET}".encode()).hexdigest()[:16]
    return base64.b64encode(f"{payload}:{sig}".encode()).decode()

def verify_token(token: str) -> Optional[str]:
    """
    Decode and verify token.
    Returns the email string if valid, None otherwise.
    """
    try:
        decoded       = base64.b64decode(token.encode()).decode()
        parts         = decoded.rsplit(":", 2)
        email, expiry, sig = parts[0], int(parts[1]), parts[2]

        if int(time.time()) > expiry:
            return None                          # expired

        expected = hashlib.sha256(
            f"{email}:{expiry}{JWT_SECRET}".encode()
        ).hexdigest()[:16]

        return email if sig == expected else None # tampered
    except Exception:
        return None

# ── FastAPI dependency ────────────────────────────────────────────────────────

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Dependency injected into any route that requires authentication.
    Raises 401 if the token is missing, invalid, or expired.
    Returns the user dict from the USERS store.
    """
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")

    email = verify_token(creds.credentials)
    if not email or email not in USERS:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {"email": email, **USERS[email]}
