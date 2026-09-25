"""Flask app: upload an image and build an anime character sheet."""

from __future__ import annotations

import json
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, url_for
from werkzeug.utils import secure_filename

from .character_builder import build_character_from_image
from anime_ascii import AsciiOptions, convert_path

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

app = Flask(__name__)
app.secret_key = "animecharacters-dev-key"


def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def list_saved_sheets() -> list[dict]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sheets: list[dict] = []
    for path in sorted(OUTPUT_DIR.glob("*_sheet.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        sheets.append(
            {
                "file": path.name,
                "name": data.get("name", path.stem),
                "series_vibe": data.get("series_vibe", ""),
                "mood": data.get("mood", ""),
            }
        )
    return sheets


@app.route("/", methods=["GET"])
def index():
    query = (request.args.get("q") or "").strip().lower()
    saved = list_saved_sheets()
    if query:
        saved = [
            s
            for s in saved
            if query in s["name"].lower()
            or query in s["series_vibe"].lower()
            or query in s["mood"].lower()
        ]
    return render_template(
        "index.html",
        sheet=None,
        ascii_art=None,
        saved_sheets=saved,
        query=query,
    )


@app.route("/build", methods=["POST"])
def build():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    file = request.files.get("image")
    name = request.form.get("name", "Untitled Character")

    if not file or not file.filename:
        flash("Please choose an image file.")
        return redirect(url_for("index"))

    if not allowed_file(file.filename):
        flash("Unsupported file type. Use PNG, JPG, WEBP, or GIF.")
        return redirect(url_for("index"))

    filename = secure_filename(file.filename)
    save_path = UPLOAD_DIR / filename
    file.save(save_path)

    sheet = build_character_from_image(save_path, name=name)
    out_path = OUTPUT_DIR / f"{Path(filename).stem}_sheet.json"
    out_path.write_text(json.dumps(sheet.to_dict(), indent=2), encoding="utf-8")

    ascii_opts = AsciiOptions(
        columns=int(request.form.get("columns") or 72),
        invert=request.form.get("invert") == "on",
        style=request.form.get("style") or "auto",
        ramp=request.form.get("ramp") or "classic",
    )
    ascii_art = convert_path(save_path, ascii_opts)
    ascii_path = OUTPUT_DIR / f"{Path(filename).stem}_ascii.txt"
    ascii_path.write_text(ascii_art + "\n", encoding="utf-8")

    return render_template(
        "index.html",
        sheet=sheet.to_dict(),
        saved_as=out_path.name,
        ascii_art=ascii_art,
        ascii_saved_as=ascii_path.name,
        saved_sheets=list_saved_sheets(),
        query="",
    )


def main() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    app.run(host="127.0.0.1", port=7860, debug=True)


if __name__ == "__main__":
    main()
