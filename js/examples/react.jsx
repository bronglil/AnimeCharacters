/**
 * React usage sketch — drop into a Vite/React app after:
 *   npm install anime-ascii
 *
 * CSS (once, in main entry):
 *   import "anime-ascii/ascii.css";
 * Prefer ArrayBuffer / Uint8Array in the browser:
 *   convertBufferColored(new Uint8Array(await file.arrayBuffer()), { look })
 */
import { useEffect, useState } from "react";
import { convertBufferColored } from "anime-ascii";

/**
 * @param {{ file: File | null, look?: "ascii" | "dense" }} props
 */
export function AsciiPreview({ file, look = "ascii" }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setHtml("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const rich = await convertBufferColored(bytes, {
          look,
          quality: "high",
          style: "fill",
        });
        if (!cancelled) {
          setError("");
          setHtml(rich.html);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, look]);

  if (error) return <p role="alert">{error}</p>;
  if (!html) return <p>Pick an image…</p>;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
