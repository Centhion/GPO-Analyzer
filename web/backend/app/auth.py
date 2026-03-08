"""
Entra ID (Azure AD) JWT Token Validation

Validates tokens issued by Microsoft Entra ID for authenticated API access.
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError
import httpx
from cachetools import TTLCache
from typing import Optional
import logging

from .config import get_settings

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer(auto_error=False)

# Cache JWKS keys for 1 hour
jwks_cache: TTLCache = TTLCache(maxsize=1, ttl=3600)


async def get_jwks() -> dict:
    """Fetch and cache Microsoft's public keys for token validation."""
    if 'keys' in jwks_cache:
        return jwks_cache['keys']
    
    settings = get_settings()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(settings.azure_jwks_uri, timeout=10.0)
            response.raise_for_status()
            jwks = response.json()
            jwks_cache['keys'] = jwks
            logger.info("Refreshed JWKS keys from Microsoft")
            return jwks
    except Exception as e:
        logger.error(f"Failed to fetch JWKS keys: {e}")
        # Return cached keys if available, even if expired
        if 'keys' in jwks_cache:
            return jwks_cache['keys']
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )


def get_signing_key(token: str, jwks: dict) -> Optional[dict]:
    """Extract the correct signing key from JWKS based on token header."""
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')
        
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                return key
        return None
    except JWTError:
        return None


class User:
    """Authenticated user information extracted from JWT token."""
    
    def __init__(self, token_payload: dict, token: str):
        self.id: str = token_payload.get('oid', '')  # Object ID
        self.email: str = token_payload.get('preferred_username', '') or token_payload.get('email', '')
        self.name: str = token_payload.get('name', '')
        self.token: str = token
        self.raw_claims: dict = token_payload
        # Set by middleware
        self.ip: str = ''
        self.user_agent: str = ''
    
    def __repr__(self):
        return f"User(email={self.email}, name={self.name})"


async def validate_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """
    Validate JWT token from Authorization header.
    
    Raises HTTPException 401 if token is missing, invalid, or expired.
    """
    settings = get_settings()
    
    # Skip auth if disabled (development only)
    if not settings.auth_enabled:
        logger.debug("Auth disabled - returning dev user")
        return User(
            {'oid': 'dev-user', 'preferred_username': 'dev@localhost', 'name': 'Dev User'},
            ''
        )
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    try:
        # Get signing keys
        jwks = await get_jwks()
        signing_key = get_signing_key(token, jwks)
        
        if not signing_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate signing key",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Validate token
        # Note: For ID tokens from SPA, audience is the client ID
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=['RS256'],
            audience=settings.azure_client_id,
            issuer=settings.azure_issuer,
            options={
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
            }
        )
        
        user = User(payload, token)
        logger.debug(f"Authenticated user: {user.email}")
        return user
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        logger.warning(f"JWT validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    request: Request,
    user: User = Depends(validate_token)
) -> User:
    """Dependency to get current authenticated user with request context."""
    # Attach request info for audit logging
    user.ip = request.client.host if request.client else "unknown"
    user.user_agent = request.headers.get("user-agent", "unknown")
    return user
