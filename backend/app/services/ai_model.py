"""AI model availability and execution handler.

This module provides an isolated, fail-safe interface for optional AI image detection models.
If an AI model is missing, unloaded, or fails to initialize:
1. It NEVER blocks or raises exceptions in the forensic analysis pipeline.
2. It NEVER fabricates fake confidence scores, predictions, or authenticity probabilities.
3. It clearly reports that the AI model is unavailable while traditional forensic algorithms remain active.
"""

from __future__ import annotations

import logging
from typing import Any

from app.models.schemas import AIModelStatus

logger = logging.getLogger(__name__)

DEFAULT_UNAVAILABLE_MESSAGE = (
    "AI detection model unavailable — traditional forensic analysis is still active."
)


def check_ai_model_status() -> AIModelStatus:
    """Check availability of optional AI detection model.

    Always returns a structured AIModelStatus. If the model is not installed,
    not loaded, or missing weights, returns an unavailable status without
    raising any exception.
    """
    try:
        # In this deployment, no external heavy deep learning weights (e.g. PyTorch,
        # ResNet, EfficientNet) are bundled to maintain zero-cost, lightweight,
        # in-memory forensic execution.
        return AIModelStatus(
            available=False,
            status="unavailable",
            model_name=None,
            message=DEFAULT_UNAVAILABLE_MESSAGE,
            warning=None,
        )
    except Exception as exc:  # pragma: no cover
        logger.warning("Error inspecting AI model state: %s", exc)
        return AIModelStatus(
            available=False,
            status="failed",
            model_name=None,
            message=DEFAULT_UNAVAILABLE_MESSAGE,
            warning=str(exc),
        )


def run_ai_detection(
    data: bytes,
    image_format: str,
) -> tuple[AIModelStatus, dict[str, Any] | None]:
    """Execute AI detection if available; gracefully fallback if missing or failing.

    Guarantees:
    - Never raises an unhandled exception that disrupts the main forensic request.
    - Never returns fabricated AI scores or simulated confidence values.
    - If the model is unavailable or fails, returns (status, None).
    """
    status = check_ai_model_status()
    if not status.available:
        return status, None

    # If in the future an AI model is loaded, execution would be wrapped here:
    try:
        # Placeholder for actual model inference if configured
        return status, None
    except Exception as exc:
        logger.warning("AI model inference failure: %s", exc)
        return (
            AIModelStatus(
                available=False,
                status="failed",
                model_name=status.model_name,
                message=DEFAULT_UNAVAILABLE_MESSAGE,
                warning=f"Inference error: {exc}",
            ),
            None,
        )
