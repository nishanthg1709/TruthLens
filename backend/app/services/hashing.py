"""SHA-256 hashing for uploaded image identity/integrity fingerprinting.

SHA-256 is not a manipulation detector. It fingerprints the exact input bytes.
"""

from __future__ import annotations

import hashlib


def compute_sha256(data: bytes) -> str:
    """Compute a lowercase hexadecimal SHA-256 digest of the given bytes.

    Args:
        data: Exact original file bytes (not a re-encoded image).

    Returns:
        64-character lowercase hex SHA-256 string.
    """
    return hashlib.sha256(data).hexdigest()
