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
  selection.innerHTML = `<strong>${selectedChar.title}</strong><br/><span class="muted">${design.label} · colored</span>`;
  copyBtn.disabled = !currentArt;
  copyHtmlBtn.disabled = !currentHtml;
}

async function loadArt() {
  if (!selectedChar || !selectedDesign) return;
  const entry = selectedChar.designs[selectedDesign];
  const txtUrl = new URL(`../samples/characters/designs/${entry.file}`, import.meta.url);
  const htmlUrl = new URL(
    `../samples/characters/designs/${entry.htmlFile || entry.file.replace(/\.txt$/, ".html")}`,
    import.meta.url,
  );
  const [text, html] = await Promise.all([
    fetch(txtUrl).then((r) => r.text()),
    fetch(htmlUrl).then((r) => (r.ok ? r.text() : "")),
  ]);
  currentArt = text.trimEnd();
  currentHtml = html.trim();
  preview.innerHTML = currentHtml || `<pre>${currentArt.replace(/</g, "&lt;")}</pre>`;
  setSelection();
}

function renderCharacters() {
  charGrid.innerHTML = "";
  for (const ch of catalog.characters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card" + (selectedChar?.id === ch.id ? " selected" : "");
    btn.innerHTML = `
      <span class="badge">#${ch.id}</span>
      <img src="../samples/characters/${ch.image}" alt="${ch.title}" loading="lazy" />
      <p class="title">${ch.title}</p>
      <p class="meta">Tap to preview designs</p>
    `;
    btn.addEventListener("click", async () => {
      selectedChar = ch;
      if (!selectedDesign) selectedDesign = catalog.designs[0].id;
      renderCharacters();
      renderDesigns();
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
        const url = new URL(`../samples/characters/designs/${htmlFile}`, import.meta.url);
        const html = await fetch(url).then((r) => r.text());
        swatch = html;
      } catch {
        /* keep plain preview */
      }
    }

    btn.innerHTML = `
      <div class="swatch">${swatch}</div>
      <p class="title">${design.label}</p>
      <p class="meta">${design.blurb}</p>
    `;
    btn.addEventListener("click", async () => {
      selectedDesign = design.id;
      if (!selectedChar) selectedChar = catalog.characters[0];
      renderCharacters();
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
renderCharacters();
await renderDesigns();
await loadArt();
