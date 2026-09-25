const catalogUrl = new URL("./catalog.json", import.meta.url);

const charGrid = document.getElementById("char-grid");
const designGrid = document.getElementById("design-grid");
const preview = document.getElementById("preview");
const selection = document.getElementById("selection");
const copyBtn = document.getElementById("copy-btn");

let catalog = null;
let selectedChar = null;
let selectedDesign = null;
let currentArt = "";

function setSelection() {
  if (!selectedChar || !selectedDesign) {
    selection.innerHTML = `<span class="muted">Nothing selected</span>`;
    copyBtn.disabled = true;
    return;
  }
  const design = catalog.designs.find((d) => d.id === selectedDesign);
  selection.innerHTML = `<strong>${selectedChar.title}</strong><br/><span class="muted">${design.label}</span>`;
  copyBtn.disabled = !currentArt;
}

async function loadArt() {
  if (!selectedChar || !selectedDesign) return;
  const file = selectedChar.designs[selectedDesign].file;
  const url = new URL(`../samples/characters/designs/${file}`, import.meta.url);
  const text = await fetch(url).then((r) => r.text());
  currentArt = text.trimEnd();
  preview.textContent = currentArt;
  setSelection();
}

function renderCharacters() {
  charGrid.innerHTML = "";
  for (const ch of catalog.characters) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card" + (selectedChar?.id === ch.id ? " selected" : "");
    btn.innerHTML = `
      <img src="../samples/characters/${ch.image}" alt="${ch.title}" loading="lazy" />
      <p class="title">${ch.title}</p>
      <p class="meta">#${ch.id}</p>
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

function renderDesigns() {
  designGrid.innerHTML = "";
  for (const design of catalog.designs) {
    const previewText =
      selectedChar?.designs?.[design.id]?.preview ||
      catalog.characters[0]?.designs?.[design.id]?.preview ||
      "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "card design-card" + (selectedDesign === design.id ? " selected" : "");
    btn.innerHTML = `
      <div class="swatch"><pre>${previewText.replace(/</g, "&lt;")}</pre></div>
      <p class="title">${design.label}</p>
      <p class="meta">${design.blurb}</p>
    `;
    btn.addEventListener("click", async () => {
      selectedDesign = design.id;
      if (!selectedChar) selectedChar = catalog.characters[0];
      renderCharacters();
      renderDesigns();
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
    copyBtn.textContent = "Copy ASCII";
  }, 1200);
});

catalog = await fetch(catalogUrl).then((r) => r.json());
selectedChar = catalog.characters.find((c) => c.name === "pikachu") || catalog.characters[0];
selectedDesign = catalog.designs[0].id;
renderCharacters();
renderDesigns();
await loadArt();
