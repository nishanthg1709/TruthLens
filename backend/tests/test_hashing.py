"""Tests for the SHA-256 hashing service."""

import hashlib

from app.services.hashing import compute_sha256


def test_sha256_matches_hashlib() -> None:
    data = b"truthlens-phase-1"
    assert compute_sha256(data) == hashlib.sha256(data).hexdigest()


def test_identical_input_identical_hash() -> None:
    data = b"identical-bytes"
    assert compute_sha256(data) == compute_sha256(data)


def test_different_input_different_hash() -> None:
    assert compute_sha256(b"alpha") != compute_sha256(b"beta")


def test_hash_is_lowercase_hex() -> None:
    digest = compute_sha256(b"case-check")
    assert len(digest) == 64
    assert digest == digest.lower()
    int(digest, 16)  # raises if not valid hex
