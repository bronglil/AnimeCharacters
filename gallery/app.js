const catalogUrl = new URL("./catalog.json", import.meta.url);

const charGrid = document.getElementById("char-grid");
const designGrid = document.getElementById("design-grid");
const preview = document.getElementById("preview");
const selection = document.getElementById("selection");
const copyBtn = document.getElementById("copy-btn");
const copyHtmlBtn = document.getElementById("copy-html-btn");

let catalog = null;
let selectedChar = null;
let selectedDesign = null;
let currentArt = "";
let currentHtml = "";

function setSelection() {
  if (!selectedChar || !selectedDesign) {
    selection.innerHTML = `<span class="muted">Nothing selected</span>`;
    copyBtn.disabled = true;
    copyHtmlBtn.disabled = true;
    return;
  }
  const design = catalog.designs.find((d) => d.id === selectedDesign);
  selection.innerHTML = `<strong>${selectedChar.title}</strong><br/><span class="muted">${design.label} · colored ASCII</span>`;
  copyBtn.disabled = !currentArt;
  copyHtmlBtn.disabled = !currentHtml;
}

async function fetchDesignHtml(htmlFile) {
  if (!htmlFile) return "";
  const url = new URL(`../samples/characters/designs/${htmlFile}`, import.meta.url);
  const res = await fetch(url);
  return res.ok ? (await res.text()).trim() : "";
}

async function loadArt() {
  if (!selectedChar || !selectedDesign) return;
  const entry = selectedChar.designs[selectedDesign];
  const txtUrl = new URL(`../samples/characters/designs/${entry.file}`, import.meta.url);
  const [text, html] = await Promise.all([
    fetch(txtUrl).then((r) => r.text()),
    fetchDesignHtml(entry.htmlFile || entry.file.replace(/\.txt$/, ".html")),
  ]);
  currentArt = text.trimEnd();
  currentHtml = html;
  preview.innerHTML = currentHtml || `<pre>${currentArt.replace(/</g, "&lt;")}</pre>`;
  setSelection();
}

async function renderCharacters() {
  charGrid.innerHTML = "";
  const defaultDesignId = selectedDesign || catalog.designs[0].id;
  for (const ch of catalog.characters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card char-card" + (selectedChar?.id === ch.id ? " selected" : "");

    const thumbFile =
      ch.designs[defaultDesignId]?.htmlFile ||
      ch.designs[catalog.designs[0].id]?.htmlFile;
    let thumb = `<pre class="thumb-fallback">${(ch.designs[defaultDesignId]?.preview || "").replace(/</g, "&lt;")}</pre>`;
    if (thumbFile) {
      try {
        const html = await fetchDesignHtml(thumbFile);
        if (html) thumb = html;
      } catch {
        /* keep plain preview */
      }
    }

    btn.innerHTML = `
      <span class="badge">#${ch.id}</span>
      <div class="char-thumb">${thumb}</div>
      <p class="title">${ch.title}</p>
      <p class="meta">Colored ASCII · tap to preview</p>
    `;
    btn.addEventListener("click", async () => {
      selectedChar = ch;
      if (!selectedDesign) selectedDesign = catalog.designs[0].id;
      await renderCharacters();
      await renderDesigns();
      await loadArt();
    });
    charGrid.appendChild(btn);
  }
}

async function renderDesigns() {
  designGrid.innerHTML = "";
  for (const design of catalog.designs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "card design-card" + (selectedDesign === design.id ? " selected" : "");

    const htmlFile =
      selectedChar?.designs?.[design.id]?.htmlFile ||
      catalog.characters[0]?.designs?.[design.id]?.htmlFile;
    let swatch = `<pre>${(selectedChar?.designs?.[design.id]?.preview || "").replace(/</g, "&lt;")}</pre>`;
    if (htmlFile) {
      try {
        const html = await fetchDesignHtml(htmlFile);
        if (html) swatch = html;
      } catch {
        /* keep plain preview */
      }
    }

    const dense = design.id === "dense-mosaic";
    btn.innerHTML = `
      <div class="swatch${dense ? " swatch-dense" : ""}">${swatch}</div>
      <p class="title">${design.label}</p>
      <p class="meta">${design.blurb}</p>
    `;
    btn.addEventListener("click", async () => {
      selectedDesign = design.id;
      if (!selectedChar) selectedChar = catalog.characters[0];
      await renderCharacters();
      await renderDesigns();
      await loadArt();
    });
    designGrid.appendChild(btn);
  }
}

copyBtn.addEventListener("click", async () => {
  if (!currentArt) return;
  await navigator.clipboard.writeText(currentArt + "\n");
  copyBtn.textContent = "Copied";
  setTimeout(() => {
    copyBtn.textContent = "Copy plain";
  }, 1200);
});

copyHtmlBtn.addEventListener("click", async () => {
  if (!currentHtml) return;
  await navigator.clipboard.writeText(currentHtml + "\n");
  copyHtmlBtn.textContent = "Copied";
  setTimeout(() => {
    copyHtmlBtn.textContent = "Copy HTML";
  }, 1200);
});

catalog = await fetch(catalogUrl).then((r) => r.json());
selectedChar = catalog.characters.find((c) => c.name === "pikachu") || catalog.characters[0];
selectedDesign = catalog.designs[0].id;
await renderCharacters();
await renderDesigns();
await loadArt();
