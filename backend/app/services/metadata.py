"""EXIF / image metadata extraction and forensic interpretation.

Separation of concerns:
- extract_* functions read whatever is present (no invention).
- interpret_metadata / build_metadata_analysis produce observations.

Absence of metadata is never treated as evidence of AI generation or
manipulation. Exact GPS coordinates are never returned.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS, IFD

from app.models.schemas import AnalysisItem, MetadataDetails

# Fields we care about for "expected when EXIF exists" completeness checks.
EXPECTED_WHEN_EXIF_PRESENT: tuple[str, ...] = (
    "camera_make",
    "camera_model",
    "capture_datetime",
    "software",
    "orientation",
)

# GPS tag names whose values must never appear in API responses.
_GPS_COORDINATE_TAGS = {
    "GPSLatitude",
    "GPSLongitude",
    "GPSAltitude",
    "GPSDestLatitude",
    "GPSDestLongitude",
    "GPSImgDirection",
    "GPSTrack",
    "GPSSpeed",
    "GPSHPositioningError",
    "GPSDOP",
}


@dataclass
class MetadataExtraction:
    """Raw extraction result before observation generation."""

    image_format: str
    exif_present: bool = False
    camera_make: str | None = None
    camera_model: str | None = None
    lens: str | None = None
    orientation: int | str | None = None
    capture_datetime: str | None = None
    digitized_datetime: str | None = None
    color_space: str | None = None
    exif_version: str | None = None
    software: str | None = None
    gps_present: bool = False
    gps_fields_present: list[str] = field(default_factory=list)
    fields_found: list[str] = field(default_factory=list)
    fields_missing: list[str] = field(default_factory=list)
    parse_errors: list[str] = field(default_factory=list)
    format_notes: str | None = None


def _as_str(value: Any) -> str | None:
    """Normalize EXIF values to stripped strings when possible."""
    if value is None:
        return None
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="replace").rstrip("\x00").strip()
        return text or None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)
    return str(value)


def _as_orientation(value: Any) -> int | str | None:
    """Normalize orientation to int when possible."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    text = _as_str(value)
    if text is None:
        return None
    if text.isdigit():
        return int(text)
    return text


def _color_space_label(value: Any) -> str | None:
    if value == 1 or value == "1" or value == b"1":
        return "sRGB"
    if value == 2 or value == "2" or value == b"2":
        return "Adobe RGB"
    if value == 65535 or value == "65535":
        return "Uncalibrated"
    return _as_str(value)


def _mark_found(extraction: MetadataExtraction, name: str) -> None:
    if name not in extraction.fields_found:
        extraction.fields_found.append(name)


def _apply_tag(extraction: MetadataExtraction, tag_name: str, raw: Any) -> None:
    """Map a known EXIF tag name onto the extraction dataclass."""
    if tag_name == "Make":
        extraction.camera_make = _as_str(raw)
        if extraction.camera_make:
            _mark_found(extraction, "camera_make")
    elif tag_name == "Model":
        extraction.camera_model = _as_str(raw)
        if extraction.camera_model:
            _mark_found(extraction, "camera_model")
    elif tag_name in {"LensModel", "LensMake", "LensSpecification"}:
        decoded = _as_str(raw)
        if decoded and (not extraction.lens or tag_name == "LensModel"):
            extraction.lens = decoded
            _mark_found(extraction, "lens")
    elif tag_name == "Orientation":
        extraction.orientation = _as_orientation(raw)
        if extraction.orientation is not None:
            _mark_found(extraction, "orientation")
    elif tag_name in {"DateTimeOriginal", "DateTime"}:
        # Prefer DateTimeOriginal; fall back to DateTime.
        decoded = _as_str(raw)
        if decoded:
            if tag_name == "DateTimeOriginal" or not extraction.capture_datetime:
                extraction.capture_datetime = decoded
                _mark_found(extraction, "capture_datetime")
    elif tag_name == "DateTimeDigitized":
        decoded = _as_str(raw)
        if decoded:
            extraction.digitized_datetime = decoded
            _mark_found(extraction, "digitized_datetime")
    elif tag_name == "Software":
        decoded = _as_str(raw)
        if decoded:
            extraction.software = decoded
            _mark_found(extraction, "software")
    elif tag_name == "ColorSpace":
        label = _color_space_label(raw)
        if label:
            extraction.color_space = label
            _mark_found(extraction, "color_space")
    elif tag_name == "ExifVersion":
        decoded = _as_str(raw)
        if decoded:
            extraction.exif_version = decoded
            _mark_found(extraction, "exif_version")
    elif tag_name == "ProcessingSoftware":
        decoded = _as_str(raw)
        if decoded and not extraction.software:
            extraction.software = decoded
            _mark_found(extraction, "software")
        elif decoded:
            _mark_found(extraction, "processing_software")


def _extract_gps_field_names(exif: Image.Exif) -> list[str]:
    """Return GPS tag names present without exposing coordinate values."""
    names: list[str] = []
    try:
        gps_ifd = exif.get_ifd(IFD.GPSInfo)
    except Exception:
        return names

    if not gps_ifd:
        return names

    for tag_id in gps_ifd.keys():
        name = GPSTAGS.get(tag_id, f"GPSTag_{tag_id}")
        names.append(name)
    return sorted(set(names))


def extract_metadata(data: bytes, image_format: str) -> MetadataExtraction:
    """Extract EXIF-related metadata from image bytes.

    Does not invent missing fields. Exact GPS coordinates are never stored
    on the returned object.
    """
    fmt = (image_format or "").upper()
    if fmt == "JPG":
        fmt = "JPEG"

    extraction = MetadataExtraction(image_format=fmt)

    if fmt == "PNG":
        extraction.format_notes = (
            "PNG commonly lacks classic EXIF camera metadata; "
            "absence is normal and not evidence of manipulation."
        )
    elif fmt == "WEBP":
        extraction.format_notes = (
            "WEBP may omit EXIF depending on how the file was encoded; "
            "absence is common and not evidence of manipulation."
        )
    elif fmt == "JPEG":
        extraction.format_notes = (
            "JPEG may contain EXIF, but many platforms strip metadata "
            "during upload, export, or messaging."
        )

    try:
        with Image.open(BytesIO(data)) as image:
            exif = image.getexif()
            if not exif or len(exif) == 0:
                # Also check info dict for rare embedded exif bytes.
                info_exif = image.info.get("exif")
                if not info_exif:
                    extraction.exif_present = False
                    return extraction

            extraction.exif_present = True

            # Primary IFD tags.
            for tag_id, raw in exif.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                if tag_name == "GPSInfo":
                    continue
                try:
                    _apply_tag(extraction, tag_name, raw)
                except Exception as exc:  # noqa: BLE001 - defensive per-tag
                    extraction.parse_errors.append(
                        f"Failed to parse tag '{tag_name}': {exc.__class__.__name__}"
                    )

            # EXIF IFD (nested).
            try:
                exif_ifd = exif.get_ifd(IFD.Exif)
            except Exception as exc:  # noqa: BLE001
                extraction.parse_errors.append(
                    f"Failed to read EXIF IFD: {exc.__class__.__name__}"
                )
                exif_ifd = {}

            for tag_id, raw in exif_ifd.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                try:
                    _apply_tag(extraction, tag_name, raw)
                except Exception as exc:  # noqa: BLE001
                    extraction.parse_errors.append(
                        f"Failed to parse EXIF IFD tag '{tag_name}': {exc.__class__.__name__}"
                    )

            # GPS presence only — never decode coordinate values into the result.
            gps_fields = _extract_gps_field_names(exif)
            if gps_fields:
                extraction.gps_present = True
                extraction.gps_fields_present = gps_fields
                _mark_found(extraction, "gps")

    except Exception as exc:  # noqa: BLE001 - metadata must not crash analyze
        extraction.parse_errors.append(
            f"Metadata parsing failed: {exc.__class__.__name__}"
        )
        return extraction

    if extraction.exif_present:
        for expected in EXPECTED_WHEN_EXIF_PRESENT:
            value = getattr(extraction, expected, None)
            if value is None and expected not in extraction.fields_found:
                extraction.fields_missing.append(expected)

    return extraction


def interpret_metadata(extraction: MetadataExtraction) -> list[str]:
    """Build human-readable observations strictly from extracted data."""
    observations: list[str] = []

    if extraction.parse_errors and not extraction.exif_present:
        observations.append(
            "Metadata parsing encountered errors; available metadata may be incomplete."
        )
        return observations

    if not extraction.exif_present:
        observations.append("No EXIF metadata was detected.")
        observations.append(
            "Absence of metadata is common after social uploads, messaging, "
            "screenshots, exports, or privacy-related processing, and is not "
            "evidence of AI generation or manipulation."
        )
        return observations

    observations.append("EXIF metadata is present in the image.")

    if extraction.camera_make or extraction.camera_model:
        observations.append("Camera information is present in the image metadata.")
    else:
        observations.append(
            "EXIF is present, but camera make/model information was not found."
        )

    if extraction.software:
        observations.append(
            "Software information is recorded in the metadata and may describe "
            "capture or processing history."
        )

    if extraction.capture_datetime or extraction.digitized_datetime:
        observations.append("Date/time metadata fields were found.")

    if extraction.orientation is not None:
        observations.append("EXIF orientation information is present.")

    if extraction.lens:
        observations.append("Lens information is present in the metadata.")

    if extraction.gps_present:
        observations.append(
            "GPS metadata is present, but coordinates are withheld for privacy."
        )

    if extraction.fields_missing:
        observations.append("Metadata is incomplete relative to common EXIF fields.")

    if extraction.parse_errors:
        observations.append(
            "Some metadata fields could not be parsed cleanly; results may be partial."
        )

    # Always remind that presence/absence is not authenticity proof.
    observations.append(
        "Metadata alone does not establish authenticity or prove manipulation."
    )

    return observations


def metadata_limitations(extraction: MetadataExtraction) -> list[str]:
    """Static and format-aware limitations for the metadata analysis."""
    limitations = [
        "Absence of EXIF metadata is not evidence of AI generation or manipulation.",
        "Camera metadata does not establish authenticity.",
        "Software tags alone do not establish that an image was manipulated.",
        "Exact GPS coordinates are withheld by default for privacy.",
        "Metadata can be stripped, edited, or forged independently of pixel content.",
    ]
    if extraction.format_notes:
        limitations.append(extraction.format_notes)
    return limitations


def build_metadata_analysis(data: bytes, image_format: str) -> AnalysisItem:
    """Run extraction + interpretation and return an AnalysisItem."""
    extraction = extract_metadata(data, image_format)

    if extraction.parse_errors and not extraction.exif_present and not extraction.fields_found:
        status = "failed"
    else:
        status = "completed"

    details = MetadataDetails(
        exif_present=extraction.exif_present,
        camera_make=extraction.camera_make,
        camera_model=extraction.camera_model,
        lens=extraction.lens,
        orientation=extraction.orientation,
        capture_datetime=extraction.capture_datetime,
        digitized_datetime=extraction.digitized_datetime,
        color_space=extraction.color_space,
        exif_version=extraction.exif_version,
        software=extraction.software,
        gps_present=extraction.gps_present,
        gps_fields_present=list(extraction.gps_fields_present),
        fields_found=list(extraction.fields_found),
        fields_missing=list(extraction.fields_missing),
        parse_errors=list(extraction.parse_errors),
        format_notes=extraction.format_notes,
    )

    return AnalysisItem(
        name="metadata",
        status=status,
        observations=interpret_metadata(extraction),
        metrics={
            "exif_present": extraction.exif_present,
            "field_count": len(extraction.fields_found),
            "gps_present": extraction.gps_present,
            "parse_error_count": len(extraction.parse_errors),
        },
        limitations=metadata_limitations(extraction),
        details=details,
    )


def response_contains_gps_coordinates(payload: dict[str, Any]) -> bool:
    """Test helper predicate: detect leaked GPS coordinate values in a payload."""
    banned_keys = {
        "gps_latitude",
        "gps_longitude",
        "latitude",
        "longitude",
        "GPSLatitude",
        "GPSLongitude",
        "coordinates",
    }

    def _walk(node: Any) -> bool:
        if isinstance(node, dict):
            for key, value in node.items():
                if key in banned_keys:
                    return True
                if key in _GPS_COORDINATE_TAGS and value not in (None, "", [], {}):
                    # Field name listed under gps_fields_present is OK; valued dict is not.
                    if not (
                        key in {"GPSLatitude", "GPSLongitude"}
                        and isinstance(value, str)
                        and value.startswith("GPS")
                    ):
                        # If the value looks like a coordinate structure, flag it.
                        if isinstance(value, (list, tuple, dict, float, int)):
                            return True
                if _walk(value):
                    return True
        elif isinstance(node, list):
            return any(_walk(item) for item in node)
        return False

    return _walk(payload)
