"""Flask app: upload an image and build an anime character sheet."""

from __future__ import annotations

import json
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, url_for
from werkzeug.utils import secure_filename

from .character_builder import build_character_from_image

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

app = Flask(__name__)
app.secret_key = "animecharacters-dev-key"


def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html", sheet=None)


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

    return render_template("index.html", sheet=sheet.to_dict(), saved_as=out_path.name)


def main() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    app.run(host="127.0.0.1", port=7860, debug=True)


if __name__ == "__main__":
    main()
