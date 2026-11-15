/* Katalog FS.ID - data dari Google Sheet toko, tampilan dinamis. */
const categoryOrder = ["Laptop", "PC", "All-in-One", "Printer", "Proyektor", "Scanner"];
const specConfig = {
  Laptop: ["Processor", "RAM", "Storage", "Ukuran layar"],
  PC: ["Processor", "RAM", "Storage", "Monitor"],
  "All-in-One": ["Processor", "RAM", "Storage", "Ukuran layar"],
  Printer: ["Teknologi", "Kecepatan cetak", "Resolusi / konektivitas", "Ukuran kertas"],
  Proyektor: ["Teknologi", "Kontras", "Resolusi / aspek rasio", "Ukuran proyeksi"],
  Scanner: ["Tipe scanner", "Tinta / fitur", "Kapasitas kertas", "Ukuran dokumen"]
};
const filterIds = ["category", "search", "brand", "price", "processor", "ram", "storage", "screen", "need", "status"];
const specFilterIds = ["processor", "ram", "storage", "screen"];
const fields = Object.fromEntries(filterIds.map(id => [id, document.getElementById(id)]));
const sortField = document.getElementById("sort");
const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1TaavUGsH5bmAWPdr2kMgKJCkrfzNoAuOI1OTZnLAsH0/gviz/tq?tqx=out:csv&sheet=Sheet1";
const waNumber = "6285182661773";
const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const wa = text => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
const fallbackImage = "assets/fsid-laptop-display.png";
const PAGE_SIZE = 12;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const icons = {
  heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
  wa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z"/></svg>`,
  share: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>`
};

let sheetLoading = true;
let usingFallback = false;
let products = [];
let fallbackProducts = [];
let visibleCount = PAGE_SIZE;
let viewMode = "grid";
let savedOnly = false;
let saved = new Set();
let lastRoute = "list";
let listScroll = 0;
let spotlightList = [];
let spotlightIndex = 0;
let spotlightTimer = null;
let spotlightPaused = false;

/* ---------- util ---------- */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function displayText(value) {
  return String(value ?? "")
    .replace(/\bRAM\s+RAM\b/gi, "RAM")
    .replace(/SCANCER/gi, "SCANNER")
    .replace(/PIGMANT/gi, "PIGMENT")
    .replace(/SPLIT\s+SCREN/gi, "SPLIT SCREEN")
    .replace(/BISACETAKLANGSUNG\s+DARI\s+HP/gi, "BISA CETAK LANGSUNG DARI HP")
    .replace(/TOUCHSREEN/gi, "TOUCHSCREEN")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function displaySpecValue(label, value) {
  const text = displayText(value);
  const labelText = displayText(label);
  if (labelText && text.toLowerCase().startsWith(`${labelText.toLowerCase()} `)) return text.slice(labelText.length).trim();
  if (labelText.toLowerCase() === "ukuran kertas" && text.toLowerCase().startsWith("ukuran ")) return text.slice("ukuran".length).trim();
  return text;
}

function safeStorage(action, key, value) {
  try {
    if (action === "get") return window.localStorage.getItem(key);
    if (action === "set") window.localStorage.setItem(key, value);
  } catch (error) { /* penyimpanan tidak tersedia, abaikan */ }
  return null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function parsePrice(value) {
  const clean = String(value || "").replace(/[^\d]/g, "");
  const hasDecimalSuffix = /,\d{2}\s*$/.test(String(value || ""));
  return Number((hasDecimalSuffix ? clean.slice(0, -2) : clean) || 0);
}

function slugify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function splitTags(value) {
  return String(value || "").split(",").map(item => item.trim().replace(/^["']+|["']+$/g, "").trim()).filter(Boolean);
}

function splitPhotoLinks(value) {
  const raw = String(value || "");
  const urls = raw.match(/https?:\/\/[^\s,|]+/g);
  if (urls?.length) return urls;
  return raw.split(/\s*(?:\r?\n|\||,)\s*/).map(item => item.trim()).filter(Boolean);
}

function driveImageUrl(value) {
  const link = String(value || "").trim();
  if (!link) return "";
  const fileMatch = link.match(/\/file\/d\/([^/]+)/) || link.match(/[?&]id=([^&]+)/);
  if (fileMatch?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileMatch[1])}&sz=w1200`;
  return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(link) ? link : "";
}

function normalizeCategory(value) {
  const aliases = {
    laptop: "Laptop", notebook: "Laptop", pc: "PC", komputer: "PC",
    "all-in-one": "All-in-One", "all in one": "All-in-One", aio: "All-in-One",
    printer: "Printer", proyektor: "Proyektor", projector: "Proyektor",
    scanner: "Scanner", scancer: "Scanner"
  };
  return aliases[String(value || "").trim().toLowerCase()] || "";
}

function inferCategory(explicitCategory, rawBrand, series) {
  const explicit = normalizeCategory(explicitCategory);
  if (explicit) return explicit;
  const brand = String(rawBrand || "").trim().toUpperCase();
  const text = `${brand} ${series || ""}`.toUpperCase();
  if (/\bPRINTER\b/.test(text)) return "Printer";
  if (/\bSCANNER\b|\bSCANCER\b/.test(text)) return "Scanner";
  if (/\bPROYEKTOR\b|\bPROJECTOR\b/.test(text)) return "Proyektor";
  if (brand === "KOMPUTER" || /\bPC\b/.test(String(series || "").toUpperCase())) return "PC";
  if (/ALL\s*IN\s*ONE|\bAIO\b/.test(text)) return "All-in-One";
  return "Laptop";
}

function resolveBrand(rawBrand, series, category) {
  const brand = String(rawBrand || "").trim();
  const words = String(series || "").trim().split(/\s+/);
  if (category === "Printer" && brand.toUpperCase().startsWith("PRINTER")) return brand.replace(/^PRINTER\s*/i, "") || words[0] || brand;
  if (category === "Scanner" && ["SCANNER", "SCANCER"].includes(brand.toUpperCase())) return words[0] || brand;
  if (category === "Proyektor") {
    const knownBrand = words.find(word => ["EPSON", "BENQ"].includes(word.toUpperCase()));
    if (knownBrand) return knownBrand;
  }
  return brand;
}

function productName(rawBrand, series, category) {
  const brand = String(rawBrand || "").trim();
  const productSeries = String(series || "").trim();
  if (category === "Printer") {
    const printerBrand = brand.replace(/^PRINTER\s*/i, "").trim();
    return printerBrand && !productSeries.toUpperCase().includes(printerBrand.toUpperCase()) ? `${printerBrand} ${productSeries}` : productSeries;
  }
  if (["Scanner", "Proyektor"].includes(category)) return productSeries;
  return `${brand} ${productSeries}`.trim();
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("habis")) return "off";
  if (value.includes("cek") || value.includes("pre-order")) return "warn";
  return "";
}

function labelsFor(product) {
  return specConfig[product.kategori] || ["Spesifikasi 1", "Spesifikasi 2", "Spesifikasi 3", "Spesifikasi 4"];
}

function isAvailable(product) {
  return String(product.status_ketersediaan || "").toLowerCase().includes("tersedia");
}

/* ---------- data ---------- */
function normalizeFallbackProduct(product, index) {
  const kategori = inferCategory(product.kategori, product.brand, product.seri || product.nama_produk);
  const specs = product.specs || [product.processor, product.ram, product.storage, product.ukuran_layar];
  const fitur = product.fitur || product.kategori_kebutuhan || product.cocok_untuk || [];
  return { ...product, kategori, specs, fitur, cocok_untuk: fitur.slice(0, 3), order: index };
}

fallbackProducts = (Array.isArray(window.FSID_PRODUCTS) ? window.FSID_PRODUCTS : []).map(normalizeFallbackProduct);

function sheetRowToProduct(row, index, categoryIndex) {
  const rawBrand = row[0]?.trim();
  const series = row[1]?.trim();
  const specs = row.slice(2, 6).map(value => value?.trim() || "");
  const price = parsePrice(row[6]);
  const stock = row[7]?.trim();
  const status = row[8]?.trim() || (Number(stock) > 0 ? "Tersedia" : "Cek Ketersediaan");
  const fitur = splitTags(row[9]);
  const photoLink = row.slice(11, 14).filter(Boolean).join("\n").trim();
  const photoLinks = splitPhotoLinks(photoLink).map(driveImageUrl).filter(Boolean).slice(0, 3);
  const kategori = inferCategory(categoryIndex >= 0 ? row[categoryIndex] : "", rawBrand, series);
  if (!rawBrand || !series || !price) return null;

  const brand = resolveBrand(rawBrand, series, kategori);
  const name = productName(rawBrand, series, kategori);
  const labels = specConfig[kategori];
  const summary = specs.map((value, specIndex) => value ? `${labels[specIndex]} ${displaySpecValue(labels[specIndex], value)}` : "").filter(Boolean).join(", ");
  return {
    id_produk: `FS-SHEET-${String(index).padStart(3, "0")}`,
    nama_produk: name,
    brand,
    seri: series,
    kategori,
    specs,
    processor: specs[0],
    ram: specs[1],
    storage: specs[2],
    ukuran_layar: specs[3],
    harga: price,
    status_ketersediaan: status,
    fitur,
    kategori_kebutuhan: fitur,
    deskripsi_singkat: `${name}. ${summary}.`,
    kelebihan: specs.filter(Boolean),
    cocok_untuk: fitur.slice(0, 3),
    garansi: "Hubungi admin FS.ID",
    tanggal_update: new Date().toISOString().slice(0, 10),
    foto_utama: photoLinks[0] || fallbackImage,
    foto_tambahan: photoLinks,
    foto_dinamis: photoLinks,
    link_foto: photoLink,
    slug_produk: slugify(`${name}-${specs.join("-")}-${index}`),
    order: index
  };
}

async function loadProductsFromSheet() {
  const response = await fetch(`${sheetCsvUrl}&cache=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet tidak bisa dibaca (${response.status})`);
  const rows = parseCsv(await response.text());
  const headers = rows[0].map(header => header.trim().toUpperCase());
  const categoryIndex = headers.findIndex(header => ["KATEGORI", "CATEGORY"].includes(header));
  const sheetProducts = rows.slice(1).map((row, index) => sheetRowToProduct(row, index + 1, categoryIndex)).filter(Boolean);
  if (!sheetProducts.length) throw new Error("Google Sheet belum berisi produk valid");
  products = sheetProducts;
}

/* ---------- favorit ---------- */
function loadSaved() {
  try { saved = new Set(JSON.parse(safeStorage("get", "fsid-saved") || "[]")); } catch (error) { saved = new Set(); }
}
function persistSaved() { safeStorage("set", "fsid-saved", JSON.stringify([...saved])); }
function savedProducts() { return products.filter(product => saved.has(product.slug_produk)); }

function toggleSaved(slug) {
  const product = products.find(item => item.slug_produk === slug);
  if (saved.has(slug)) {
    saved.delete(slug);
    toast("Dihapus dari daftar simpan");
  } else {
    saved.add(slug);
    toast(`${displayText(product?.nama_produk || "Produk")} disimpan`);
  }
  persistSaved();
  syncSavedUi(slug);
}

function syncSavedUi(slug) {
  const count = savedProducts().length;
  document.getElementById("savedCount").textContent = count;
  if (slug) {
    const toggle = document.getElementById("savedToggle");
    toggle.classList.remove("bump");
    void toggle.offsetWidth;
    toggle.classList.add("bump");
  }
  document.querySelectorAll(`[data-save="${CSS.escape(slug)}"]`).forEach(button => {
    const active = saved.has(slug);
    button.setAttribute("aria-pressed", String(active));
    if (button.classList.contains("heart")) {
      button.classList.remove("pop");
      void button.offsetWidth;
      button.classList.add("pop");
    }
    const label = button.querySelector("[data-save-label]");
    if (label) label.textContent = active ? "Tersimpan" : "Simpan";
  });
  renderSavedBar();
  if (savedOnly && !location.hash.startsWith("#/produk/")) renderCatalog();
}

function renderSavedBar() {
  const bar = document.getElementById("savedBar");
  const items = savedProducts();
  document.getElementById("savedBarCount").textContent = items.length;
  bar.hidden = !items.length;
  if (items.length) {
    const lines = items.map((item, index) => `${index + 1}. ${displayText(item.nama_produk)} - ${rupiah(item.harga)}`).join("\n");
    document.getElementById("savedWa").href = wa(`Assalamu'alaikum, saya tertarik dengan produk berikut dari katalog FS.ID:\n${lines}\n\nApakah masih tersedia? Mohon info detailnya.`);
  }
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove("show"), 2200);
}

/* ---------- gambar ---------- */
function productImageUrl(product) {
  return product.foto_dinamis?.[0] || driveImageUrl(product.link_foto) || product.foto_utama || fallbackImage;
}

function imageTag(src, alt, { lazy = true, eager = false } = {}) {
  return `<img data-img class="is-loading" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" ${lazy && !eager ? 'loading="lazy"' : ""} decoding="async" referrerpolicy="no-referrer"><div class="image-fallback" hidden><span>FS.ID</span></div>`;
}

document.addEventListener("error", event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.hasAttribute("data-img")) return;
  if (!image.src.endsWith(fallbackImage) && image.dataset.retried !== "1") {
    image.dataset.retried = "1";
    image.src = fallbackImage;
    return;
  }
  image.hidden = true;
  if (image.nextElementSibling) image.nextElementSibling.hidden = false;
}, true);

document.addEventListener("load", event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.hasAttribute("data-img")) image.classList.remove("is-loading");
}, true);

function settleImages(root) {
  root.querySelectorAll("img[data-img]").forEach(image => {
    if (image.complete && image.naturalWidth) image.classList.remove("is-loading");
  });
}

/* ---------- kartu ---------- */
function productSpecs(product, limit = 4) {
  const labels = labelsFor(product);
  return product.specs.slice(0, limit).map((value, index) => value ? `<li><small>${escapeHtml(labels[index])}</small><span>${escapeHtml(displaySpecValue(labels[index], value))}</span></li>` : "").join("");
}

function productCard(product, index = 0) {
  const name = displayText(product.nama_produk);
  const href = `#/produk/${escapeHtml(product.slug_produk)}`;
  const isSaved = saved.has(product.slug_produk);
  return `
    <article class="product-card reveal" style="--d:${Math.min(index % PAGE_SIZE, 11) * 45}ms">
      <a class="card-media" href="${href}" aria-label="Lihat detail ${escapeHtml(name)}">
        ${imageTag(productImageUrl(product), name)}
        <span class="badge-cat">${escapeHtml(displayText(product.kategori))}</span>
      </a>
      <button class="heart" type="button" data-save="${escapeHtml(product.slug_produk)}" aria-pressed="${isSaved}" aria-label="Simpan ${escapeHtml(name)}">${icons.heart}</button>
      <div class="product-body">
        <div class="card-meta"><span class="product-brand">${escapeHtml(displayText(product.brand))}</span><span class="status ${statusClass(product.status_ketersediaan)}">${escapeHtml(displayText(product.status_ketersediaan))}</span></div>
        <h3><a href="${href}">${escapeHtml(name)}</a></h3>
        <ul class="specs">${productSpecs(product)}</ul>
        <div class="card-foot">
          <div class="price-box"><small>Harga</small><div class="price">${rupiah(product.harga)}</div></div>
          <div class="card-actions">
            <a class="btn btn-light" href="${href}">Detail</a>
            <a class="btn btn-whatsapp" href="${wa(`Assalamu'alaikum, saya ingin konsultasi produk ${name}. Apakah ketersediaan dan harganya masih sesuai katalog?`)}" target="_blank" rel="noopener noreferrer" aria-label="Konsultasi ${escapeHtml(name)} lewat WhatsApp">${icons.wa}</a>
          </div>
        </div>
      </div>
    </article>`;
}

function skeletonCards(count = 6) {
  return Array.from({ length: count }, () => `<div class="skeleton-card" aria-hidden="true"><div class="sk-img"></div><div class="sk-body"><div class="sk-line w40"></div><div class="sk-line tall w80"></div><div class="sk-line"></div><div class="sk-line w60"></div><div class="sk-line tall w40"></div></div></div>`).join("");
}

/* ---------- reveal & glow ---------- */
const revealObserver = "IntersectionObserver" in window && !reducedMotion
  ? new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      revealObserver.unobserve(entry.target);
    }
  }), { rootMargin: "0px 0px -6% 0px", threshold: .05 })
  : null;

function observeReveal(root) {
  root.querySelectorAll(".reveal:not(.in)").forEach(element => {
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add("in");
  });
}

document.addEventListener("pointermove", event => {
  const card = event.target.closest?.(".product-card");
  if (!card) return;
  const rect = card.getBoundingClientRect();
  card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
  card.style.setProperty("--my", `${event.clientY - rect.top}px`);
});

/* ---------- filter ---------- */
function unique(values) {
  return [...new Set(values.flat().filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

function fillSelect(id, values, placeholder) {
  const select = fields[id];
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(displayText(value))}</option>`).join("");
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function configureSpecFilters(category) {
  const labels = specConfig[category];
  specFilterIds.forEach((id, index) => {
    const wrapper = document.querySelector(`[data-spec-filter="${index}"]`);
    wrapper.classList.toggle("hidden", !labels);
    if (!labels) return;
    document.querySelector(`[data-spec-label="${index}"]`).textContent = labels[index];
  });
}

function hydrateFilters() {
  const category = fields.category.value;
  fillSelect("category", categoryOrder.filter(item => products.some(product => product.kategori === item)), "Semua kategori");
  fields.category.value = category;
  const scoped = category ? products.filter(product => product.kategori === category) : products;
  fillSelect("brand", unique(scoped.map(item => item.brand)), "Semua brand");
  fillSelect("need", unique(scoped.map(item => item.fitur)), "Semua fitur");
  fillSelect("status", unique(scoped.map(item => item.status_ketersediaan)), "Semua status");
  configureSpecFilters(category);
  specFilterIds.forEach((id, index) => {
    if (category) fillSelect(id, unique(scoped.map(item => item.specs[index])), `Semua ${specConfig[category][index].toLowerCase()}`);
    else fields[id].value = "";
  });
}

function matches(product) {
  const tokens = fields.search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const priceRange = fields.price.value ? fields.price.value.split("-").map(Number) : null;
  const searchable = [product.nama_produk, product.brand, product.seri, product.kategori, product.specs, product.fitur].flat().join(" ").toLowerCase();
  return tokens.every(token => searchable.includes(token)) &&
    (!fields.category.value || product.kategori === fields.category.value) &&
    (!fields.brand.value || product.brand === fields.brand.value) &&
    (!fields.processor.value || product.specs[0] === fields.processor.value) &&
    (!fields.ram.value || product.specs[1] === fields.ram.value) &&
    (!fields.storage.value || product.specs[2] === fields.storage.value) &&
    (!fields.screen.value || product.specs[3] === fields.screen.value) &&
    (!fields.need.value || product.fitur.includes(fields.need.value)) &&
    (!fields.status.value || product.status_ketersediaan === fields.status.value) &&
    (!priceRange || (product.harga >= priceRange[0] && product.harga <= priceRange[1])) &&
    (!savedOnly || saved.has(product.slug_produk));
}

function sortProducts(list) {
  const sorted = [...list];
  const mode = sortField.value;
  if (mode === "price-asc") sorted.sort((a, b) => a.harga - b.harga);
  else if (mode === "price-desc") sorted.sort((a, b) => b.harga - a.harga);
  else if (mode === "name") sorted.sort((a, b) => displayText(a.nama_produk).localeCompare(displayText(b.nama_produk), "id"));
  else sorted.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted;
}

function clearFilters(keepCategory = false) {
  filterIds.forEach(id => {
    if (keepCategory && id === "category") return;
    fields[id].value = "";
  });
  savedOnly = false;
  syncSavedToggle();
}

function syncSavedToggle() {
  document.getElementById("savedToggle").setAttribute("aria-pressed", String(savedOnly));
}

function activeFilterEntries() {
  const entries = [];
  const labelFor = id => id === "price" ? fields.price.selectedOptions[0]?.textContent : displayText(fields[id].value);
  ["category", "brand", "price", "processor", "ram", "storage", "screen", "need", "status"].forEach(id => {
    if (fields[id].value) entries.push({ id, text: labelFor(id) });
  });
  if (fields.search.value.trim()) entries.push({ id: "search", text: `“${fields.search.value.trim()}”` });
  if (savedOnly) entries.push({ id: "saved", text: "Hanya tersimpan" });
  return entries;
}

function renderActiveFilters(entries) {
  const container = document.getElementById("activeFilters");
  container.innerHTML = entries.length
    ? entries.map(entry => `<button class="filter-chip" type="button" data-remove-filter="${entry.id}" aria-label="Hapus filter ${escapeHtml(entry.text)}">${escapeHtml(entry.text)} <i aria-hidden="true">&times;</i></button>`).join("") + (entries.length > 1 ? `<button class="filter-chip clear" type="button" data-remove-filter="all">Hapus semua</button>` : "")
    : "";
  const badge = document.getElementById("filterBadge");
  const sheetCount = entries.filter(entry => !["search", "saved"].includes(entry.id)).length;
  badge.hidden = !sheetCount;
  badge.textContent = sheetCount;
}

/* ---------- render katalog ---------- */
function updateTabs() {
  const category = fields.category.value;
  document.querySelectorAll("[data-category-tab]").forEach(tab => {
    const active = tab.dataset.categoryTab === category;
    tab.classList.toggle("active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
    const counter = tab.querySelector("[data-tab-count]");
    if (counter && products.length) counter.textContent = tab.dataset.categoryTab ? products.filter(item => item.kategori === tab.dataset.categoryTab).length : products.length;
  });
  const activeTab = document.querySelector("[data-category-tab].active");
  const tabBar = document.getElementById("categoryTabs");
  if (activeTab && tabBar) tabBar.scrollTo({ left: Math.max(0, activeTab.offsetLeft - (tabBar.clientWidth - activeTab.offsetWidth) / 2), behavior: reducedMotion ? "auto" : "smooth" });
}

function syncQuickChips() {
  document.querySelectorAll("[data-quick-price]").forEach(chip => chip.classList.toggle("active", chip.dataset.quickPrice === fields.price.value));
}

function renderCatalog({ resetPage = true } = {}) {
  if (resetPage) visibleCount = PAGE_SIZE;
  configureSpecFilters(fields.category.value);
  updateTabs();
  syncQuickChips();
  const grid = document.getElementById("productGrid");
  const loadMore = document.getElementById("loadMore");
  grid.classList.toggle("is-list", viewMode === "list");

  if (sheetLoading) {
    setText("resultCount", "Menyiapkan katalog...");
    grid.setAttribute("aria-busy", "true");
    grid.innerHTML = skeletonCards(6);
    loadMore.hidden = true;
    return;
  }

  const filtered = sortProducts(products.filter(matches));
  const entries = activeFilterEntries();
  renderActiveFilters(entries);
  setText("applyCount", filtered.length);
  const scope = savedOnly ? " tersimpan" : fields.category.value ? ` ${fields.category.value}` : "";
  setText("resultCount", filtered.length ? `${filtered.length} produk${scope}` : "Tidak ada produk yang cocok");

  const visible = filtered.slice(0, visibleCount);
  grid.setAttribute("aria-busy", "false");
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><strong>${savedOnly ? "Belum ada produk tersimpan" : "Produk belum ditemukan"}</strong><p>${savedOnly ? "Ketuk ikon hati pada produk untuk menyimpannya di sini." : "Coba ubah atau hapus sebagian filter, atau tanyakan langsung ke admin FS.ID."}</p><div class="btn-row"><button class="btn btn-light" type="button" data-remove-filter="all">Hapus filter</button><a class="btn btn-whatsapp" href="${wa("Assalamu'alaikum, saya ingin dibantu mencari produk yang sesuai kebutuhan saya.")}" target="_blank" rel="noopener noreferrer">Tanya admin</a></div></div>`;
    loadMore.hidden = true;
    return;
  }
  grid.innerHTML = visible.map((product, index) => productCard(product, index)).join("");
  settleImages(grid);
  observeReveal(grid);
  const remaining = filtered.length - visible.length;
  loadMore.hidden = remaining <= 0;
  loadMore.textContent = `Tampilkan ${Math.min(PAGE_SIZE, remaining)} produk lagi (${remaining} tersisa)`;
}

function appendMore() {
  const filtered = sortProducts(products.filter(matches));
  const start = visibleCount;
  visibleCount += PAGE_SIZE;
  const grid = document.getElementById("productGrid");
  const chunk = filtered.slice(start, visibleCount);
  grid.insertAdjacentHTML("beforeend", chunk.map((product, index) => productCard(product, index)).join(""));
  settleImages(grid);
  observeReveal(grid);
  const remaining = filtered.length - Math.min(visibleCount, filtered.length);
  const loadMore = document.getElementById("loadMore");
  loadMore.hidden = remaining <= 0;
  loadMore.textContent = `Tampilkan ${Math.min(PAGE_SIZE, remaining)} produk lagi (${remaining} tersisa)`;
}

/* ---------- hero / sorotan ---------- */
function countUp(element, target, suffix = "") {
  if (reducedMotion || !Number.isFinite(target)) {
    element.textContent = `${target}${suffix}`;
    return;
  }
  const start = performance.now();
  const duration = 900;
  const tick = now => {
    const progress = Math.min(1, (now - start) / duration);
    element.textContent = `${Math.round(target * (1 - Math.pow(1 - progress, 3)))}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

let statsAnimated = false;
function updateCatalogChrome() {
  const categories = unique(products.map(item => item.kategori));
  const available = products.filter(isAvailable).length;
  setText("sheetStatus", sheetLoading ? "memuat" : usingFallback ? "data cadangan" : "live");
  if (products.length && !statsAnimated) {
    statsAnimated = true;
    countUp(document.getElementById("categoryCount"), categories.length);
    countUp(document.getElementById("totalProducts"), products.length, "+");
    countUp(document.getElementById("availableCount"), available);
  } else if (products.length) {
    setText("categoryCount", categories.length);
    setText("totalProducts", `${products.length}+`);
    setText("availableCount", available);
  }

  spotlightList = categoryOrder
    .map(category => products.find(item => item.kategori === category && (item.foto_dinamis?.length || 0) > 0 && isAvailable(item)) || products.find(item => item.kategori === category))
    .filter(Boolean);
  if (spotlightList.length) showSpotlight(0, false);

  const ticker = document.getElementById("tickerTrack");
  if (ticker) {
    const items = products.slice(0, 14).map(product => `<span>${escapeHtml(displayText(product.kategori))}</span><b>${escapeHtml(displayText(product.nama_produk))} - ${rupiah(product.harga || 0)}</b>`).join("");
    if (items) ticker.innerHTML = items + items;
  }
}

function showSpotlight(index, animate = true) {
  if (!spotlightList.length) return;
  spotlightIndex = (index + spotlightList.length) % spotlightList.length;
  const product = spotlightList[spotlightIndex];
  const card = document.getElementById("spotLink");
  setText("featureBrand", `${displayText(product.kategori)} / ${displayText(product.brand || "FS.ID")}`);
  setText("featureName", displayText(product.nama_produk));
  setText("featureSpec", product.specs.filter(Boolean).map(displayText).join(" - "));
  setText("featurePrice", rupiah(product.harga || 0));
  const status = document.getElementById("featureStatus");
  status.textContent = displayText(product.status_ketersediaan || "Cek produk");
  status.className = `status ${statusClass(product.status_ketersediaan)}`;
  card.href = `#/produk/${product.slug_produk}`;
  document.getElementById("spotMedia").innerHTML = imageTag(productImageUrl(product), displayText(product.nama_produk), { eager: true });
  if (animate && !reducedMotion) {
    card.classList.remove("swap");
    void card.offsetWidth;
    card.classList.add("swap");
  }
  restartSpotlightTimer();
}

function restartSpotlightTimer() {
  window.clearTimeout(spotlightTimer);
  const bar = document.getElementById("spotProgress");
  bar.style.transition = "none";
  bar.style.width = "0";
  if (reducedMotion || spotlightList.length < 2) return;
  void bar.offsetWidth;
  if (spotlightPaused) return;
  bar.style.transition = "width 6s linear";
  bar.style.width = "100%";
  spotlightTimer = window.setTimeout(() => showSpotlight(spotlightIndex + 1), 6000);
}

function setCatalogStatus(message = "", showRetry = false, isError = false) {
  const status = document.getElementById("catalogStatus");
  status.className = `catalog-status${isError ? " is-error" : ""}${message ? " is-visible" : ""}`;
  status.innerHTML = message ? `<span>${escapeHtml(message)}</span>${showRetry ? `<button class="btn btn-light" id="retrySheet" type="button">Coba lagi</button>` : ""}` : "";
  if (showRetry) document.getElementById("retrySheet").addEventListener("click", loadCatalog);
}

function setCatalogControlsDisabled(disabled) {
  filterIds.forEach(id => { fields[id].disabled = disabled; });
  document.getElementById("resetFilters").disabled = disabled;
  sortField.disabled = disabled;
}

/* ---------- detail ---------- */
function detailGallery(product) {
  const images = product.foto_dinamis?.length ? product.foto_dinamis.slice(0, 5) : [productImageUrl(product)];
  const name = displayText(product.nama_produk);
  const slides = images.map((image, index) => `<figure class="gallery-slide">${imageTag(image, `${name} foto ${index + 1}`, { eager: index === 0 })}</figure>`).join("");
  const thumbs = images.length > 1 ? `<div class="gallery-thumbs">${images.map((image, index) => `<button type="button" class="${index === 0 ? "active" : ""}" data-slide="${index}" aria-label="Lihat foto ${index + 1}"><img src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join("")}</div>` : "";
  return `
    <div class="detail-gallery" data-gallery>
      <div class="gallery-stage">
        <div class="gallery-track">${slides}</div>
        ${images.length > 1 ? `<button class="gallery-nav gallery-prev" type="button" aria-label="Foto sebelumnya" data-gallery-prev>&larr;</button><button class="gallery-nav gallery-next" type="button" aria-label="Foto berikutnya" data-gallery-next>&rarr;</button><span class="gallery-counter" data-gallery-counter>1 / ${images.length}</span>` : ""}
      </div>
      ${thumbs}
    </div>`;
}

function initGallery() {
  const gallery = document.querySelector("[data-gallery]");
  if (!gallery) return;
  const track = gallery.querySelector(".gallery-track");
  const stage = gallery.querySelector(".gallery-stage");
  const thumbs = [...gallery.querySelectorAll(".gallery-thumbs button")];
  const total = track.children.length;
  const counter = gallery.querySelector("[data-gallery-counter]");
  let active = 0;
  const show = index => {
    active = (index + total) % total;
    track.style.transform = `translateX(-${active * 100}%)`;
    thumbs.forEach((thumb, thumbIndex) => thumb.classList.toggle("active", thumbIndex === active));
    if (counter) counter.textContent = `${active + 1} / ${total}`;
  };
  gallery.querySelector("[data-gallery-prev]")?.addEventListener("click", () => show(active - 1));
  gallery.querySelector("[data-gallery-next]")?.addEventListener("click", () => show(active + 1));
  thumbs.forEach(thumb => thumb.addEventListener("click", () => show(Number(thumb.dataset.slide || 0))));
  let startX = null;
  stage.addEventListener("pointerdown", event => { startX = event.clientX; });
  stage.addEventListener("pointerup", event => {
    if (startX === null) return;
    const delta = event.clientX - startX;
    startX = null;
    if (Math.abs(delta) > 45 && total > 1) show(active + (delta < 0 ? 1 : -1));
  });
  stage.addEventListener("pointercancel", () => { startX = null; });
  gallery.show = show;
  gallery.active = () => active;
}

function renderDetail(slug) {
  const product = products.find(item => item.slug_produk === slug);
  const content = document.getElementById("detailContent");
  if (!product) {
    if (sheetLoading) {
      content.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><strong>Memuat detail produk...</strong><p>Data produk sedang diambil dari katalog toko.</p></div>`;
      document.getElementById("relatedProducts").innerHTML = "";
      document.getElementById("mobileCta").innerHTML = "";
      return;
    }
    location.hash = "#/";
    return;
  }
  const name = displayText(product.nama_produk);
  const labels = labelsFor(product);
  const message = `Assalamu'alaikum, saya ingin konsultasi produk ${name}. Apakah ketersediaan dan harganya masih sesuai katalog?`;
  const isSaved = saved.has(product.slug_produk);
  const specRows = product.specs.map((value, index) => value ? `<div class="spec-row"><dt>${escapeHtml(labels[index])}</dt><dd>${escapeHtml(displaySpecValue(labels[index], value))}</dd></div>` : "").join("");
  const tags = product.fitur.map(item => `<span class="tag">${escapeHtml(displayText(item))}</span>`).join("");
  document.title = `${name} - Katalog FS.ID`;
  setText("crumbName", name);
  const crumb = document.getElementById("crumbCategory");
  crumb.textContent = displayText(product.kategori);
  crumb.href = `#/kategori/${encodeURIComponent(product.kategori)}`;

  content.innerHTML = `
    ${detailGallery(product)}
    <article class="detail-panel">
      <div class="detail-badges"><span class="pill pill-gold">${escapeHtml(displayText(product.kategori))}</span><span class="pill pill-line">${escapeHtml(displayText(product.brand))}</span><span class="status ${statusClass(product.status_ketersediaan)}">${escapeHtml(displayText(product.status_ketersediaan))}</span></div>
      <h1>${escapeHtml(name)}</h1>
      <p class="detail-lead">${escapeHtml(displayText(product.deskripsi_singkat))}</p>
      <div class="detail-price"><div class="price">${rupiah(product.harga)}</div></div>
      <div class="detail-actions">
        <a class="btn btn-whatsapp" href="${wa(message)}" target="_blank" rel="noopener noreferrer">${icons.wa} Konsultasi via WhatsApp</a>
        <button class="btn btn-light heart-btn" type="button" data-save="${escapeHtml(product.slug_produk)}" aria-pressed="${isSaved}">${icons.heart}<span data-save-label>${isSaved ? "Tersimpan" : "Simpan"}</span></button>
        <button class="btn btn-light" type="button" data-share="${escapeHtml(name)}">${icons.share}<span>Bagikan</span></button>
      </div>
      <dl class="spec-table">${specRows}<div class="spec-row"><dt>Garansi</dt><dd>${escapeHtml(displayText(product.garansi))}</dd></div></dl>
      ${tags ? `<h3>Fitur tambahan</h3><div class="tags">${tags}</div>` : ""}
      <p class="detail-note">Harga dan stok dapat berubah sewaktu-waktu. Konfirmasi dulu lewat WhatsApp supaya kedatangan Anda ke toko tidak sia-sia.</p>
    </article>`;
  document.getElementById("mobileCta").innerHTML = `<div class="price-box"><small>Harga</small><div class="price">${rupiah(product.harga)}</div></div><button class="icon-btn heart-btn" type="button" data-save="${escapeHtml(product.slug_produk)}" aria-pressed="${isSaved}" aria-label="Simpan produk">${icons.heart}</button><a class="btn btn-whatsapp" href="${wa(message)}" target="_blank" rel="noopener noreferrer">${icons.wa} Konsultasi</a>`;
  initGallery();
  settleImages(content);

  const related = products
    .filter(item => item.kategori === product.kategori && item.slug_produk !== product.slug_produk)
    .concat(products.filter(item => item.brand === product.brand && item.kategori !== product.kategori))
    .concat(products.filter(item => item.slug_produk !== product.slug_produk && item.kategori !== product.kategori && item.brand !== product.brand))
    .slice(0, 3);
  const relatedBox = document.getElementById("relatedProducts");
  relatedBox.innerHTML = related.map((item, index) => productCard(item, index)).join("");
  settleImages(relatedBox);
  observeReveal(relatedBox);
}

/* ---------- routing ---------- */
function parseRoute() {
  const hash = location.hash;
  const detail = hash.match(/^#\/produk\/(.+)$/);
  if (detail) return { type: "detail", slug: decodeURIComponent(detail[1]) };
  const category = hash.match(/^#\/kategori\/(.+)$/);
  if (category) return { type: "list", category: normalizeCategory(decodeURIComponent(category[1])) || decodeURIComponent(category[1]) };
  const brand = hash.match(/^#\/brand\/(.+)$/);
  if (brand) return { type: "list", brand: decodeURIComponent(brand[1]) };
  return { type: "list" };
}

function applyRoute() {
  const route = parseRoute();
  const catalogView = document.getElementById("catalogView");
  const detailView = document.getElementById("detailView");
  catalogView.classList.toggle("hidden", route.type === "detail");
  detailView.classList.toggle("hidden", route.type !== "detail");
  closeFilterSheet();

  if (route.type === "detail") {
    if (lastRoute === "list") listScroll = window.scrollY;
    renderDetail(route.slug);
    if (lastRoute !== "detail") window.scrollTo(0, 0);
    lastRoute = "detail";
    return;
  }

  document.title = "Katalog Produk FS.ID";
  const cameFromDetail = lastRoute === "detail";
  if (route.category || route.brand) {
    clearFilters();
    if (route.category) fields.category.value = route.category;
    hydrateFilters();
    if (route.brand) {
      const option = [...fields.brand.options].find(item => item.value.toLowerCase() === route.brand.toLowerCase());
      fields.brand.value = option?.value || "";
    }
  } else if (!cameFromDetail) {
    clearFilters();
    hydrateFilters();
  }
  renderCatalog();
  lastRoute = "list";
  if (cameFromDetail) window.requestAnimationFrame(() => window.scrollTo(0, listScroll));
}

function refreshCatalogView() {
  hydrateFilters();
  updateCatalogChrome();
  const route = parseRoute();
  if (route.type === "detail") {
    renderDetail(route.slug);
    return;
  }
  if (route.category && !fields.category.value) fields.category.value = route.category;
  hydrateFilters();
  renderCatalog();
}

/* ---------- bottom sheet filter (mobile) ---------- */
function openFilterSheet() {
  document.getElementById("filterPanel").classList.add("open");
  const backdrop = document.getElementById("filterBackdrop");
  backdrop.hidden = false;
  document.body.classList.add("sheet-open");
  document.getElementById("filterClose").focus();
}

function closeFilterSheet() {
  const panel = document.getElementById("filterPanel");
  if (!panel.classList.contains("open")) return;
  panel.classList.remove("open");
  document.getElementById("filterBackdrop").hidden = true;
  document.body.classList.remove("sheet-open");
}

/* ---------- event ---------- */
let searchTimer = null;
fields.search.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(renderCatalog, 140);
});
document.getElementById("heroSearch").addEventListener("submit", event => {
  event.preventDefault();
  renderCatalog();
  document.getElementById("catalogZone").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  fields.search.blur();
});
filterIds.filter(id => !["category", "search"].includes(id)).forEach(id => fields[id].addEventListener("input", () => renderCatalog()));
fields.category.addEventListener("change", () => {
  const category = fields.category.value;
  ["brand", "processor", "ram", "storage", "screen", "need"].forEach(id => { fields[id].value = ""; });
  hydrateFilters();
  history.replaceState(null, "", category ? `#/kategori/${encodeURIComponent(category)}` : "#/");
  renderCatalog();
});
sortField.addEventListener("input", () => renderCatalog());

function scrollToResults() {
  const zone = document.getElementById("catalogZone");
  if (zone.offsetParent === null) return;
  const top = zone.getBoundingClientRect().top + window.scrollY - 118;
  if (window.scrollY < top - 40) window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
}

document.querySelectorAll("[data-category-tab]").forEach(tab => {
  tab.addEventListener("click", event => {
    event.preventDefault();
    const target = tab.dataset.categoryTab ? `#/kategori/${encodeURIComponent(tab.dataset.categoryTab)}` : "#/";
    const current = location.hash || "#/";
    if (current === target && lastRoute === "list") {
      clearFilters();
      fields.category.value = tab.dataset.categoryTab;
      hydrateFilters();
      renderCatalog();
    } else {
      location.hash = target;
    }
    window.setTimeout(scrollToResults, 60);
  });
});

document.querySelectorAll("[data-quick-price]").forEach(chip => {
  chip.addEventListener("click", () => {
    fields.price.value = fields.price.value === chip.dataset.quickPrice ? "" : chip.dataset.quickPrice;
    renderCatalog();
    document.getElementById("catalogZone").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  });
});

document.getElementById("resetFilters").addEventListener("click", () => {
  clearFilters();
  hydrateFilters();
  history.replaceState(null, "", "#/");
  renderCatalog();
});
document.getElementById("filterOpen").addEventListener("click", openFilterSheet);
document.getElementById("filterClose").addEventListener("click", closeFilterSheet);
document.getElementById("filterApply").addEventListener("click", closeFilterSheet);
document.getElementById("filterBackdrop").addEventListener("click", closeFilterSheet);
document.getElementById("loadMore").addEventListener("click", appendMore);

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    viewMode = button.dataset.view;
    safeStorage("set", "fsid-view", viewMode);
    document.querySelectorAll("[data-view]").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderCatalog({ resetPage: false });
  });
});

document.getElementById("savedToggle").addEventListener("click", () => {
  if (location.hash.startsWith("#/produk/")) location.hash = "#/";
  savedOnly = !savedOnly;
  syncSavedToggle();
  renderCatalog();
  if (savedOnly) document.getElementById("catalogZone").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
});

document.getElementById("spotPrev").addEventListener("click", () => showSpotlight(spotlightIndex - 1));
document.getElementById("spotNext").addEventListener("click", () => showSpotlight(spotlightIndex + 1));
const spotlightBox = document.querySelector(".spotlight");
spotlightBox.addEventListener("pointerenter", () => { spotlightPaused = true; restartSpotlightTimer(); });
spotlightBox.addEventListener("pointerleave", () => { spotlightPaused = false; restartSpotlightTimer(); });

document.addEventListener("click", event => {
  const saveButton = event.target.closest("[data-save]");
  if (saveButton) {
    event.preventDefault();
    toggleSaved(saveButton.dataset.save);
    return;
  }
  const removeButton = event.target.closest("[data-remove-filter]");
  if (removeButton) {
    const id = removeButton.dataset.removeFilter;
    if (id === "all") {
      clearFilters();
      hydrateFilters();
      history.replaceState(null, "", "#/");
    } else if (id === "saved") {
      savedOnly = false;
      syncSavedToggle();
    } else {
      fields[id].value = "";
      if (id === "category") {
        ["brand", "processor", "ram", "storage", "screen", "need"].forEach(field => { fields[field].value = ""; });
        history.replaceState(null, "", "#/");
      }
      hydrateFilters();
    }
    renderCatalog();
    return;
  }
  const shareButton = event.target.closest("[data-share]");
  if (shareButton) {
    const data = { title: `${shareButton.dataset.share} - FS.ID`, url: location.href };
    if (navigator.share) navigator.share(data).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(() => toast("Tautan produk disalin"), () => toast("Salin tautan dari bilah alamat"));
    else toast("Salin tautan dari bilah alamat");
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeFilterSheet();
  if (!location.hash.startsWith("#/produk/")) return;
  const gallery = document.querySelector("[data-gallery]");
  if (!gallery?.show || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if (event.key === "ArrowLeft") gallery.show(gallery.active() - 1);
  if (event.key === "ArrowRight") gallery.show(gallery.active() + 1);
});

window.addEventListener("hashchange", applyRoute);

/* ---------- mulai ---------- */
function loadCatalog() {
  sheetLoading = true;
  usingFallback = false;
  products = [];
  setCatalogControlsDisabled(true);
  setCatalogStatus("Mengambil data produk terbaru dari toko...", false, false);
  refreshCatalogView();

  return loadProductsFromSheet()
    .then(() => {
      sheetLoading = false;
      usingFallback = false;
      setCatalogControlsDisabled(false);
      setCatalogStatus();
      refreshCatalogView();
      syncSavedUi("");
      if (parseRoute().category) window.setTimeout(scrollToResults, 120);
    })
    .catch(error => {
      sheetLoading = false;
      usingFallback = true;
      products = fallbackProducts;
      setCatalogControlsDisabled(false);
      setCatalogStatus("Data live belum dapat dimuat. Menampilkan data cadangan yang tersedia.", true, true);
      refreshCatalogView();
      syncSavedUi("");
      console.warn(error);
    });
}

loadSaved();
const storedView = safeStorage("get", "fsid-view");
if (storedView === "list" || storedView === "grid") {
  viewMode = storedView;
  document.querySelectorAll("[data-view]").forEach(item => {
    const active = item.dataset.view === viewMode;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
}
document.getElementById("savedCount").textContent = saved.size;
(() => {
  const route = parseRoute();
  if (route.type === "list" && route.category) fields.category.value = route.category;
  lastRoute = route.type;
  document.getElementById("catalogView").classList.toggle("hidden", route.type === "detail");
  document.getElementById("detailView").classList.toggle("hidden", route.type !== "detail");
})();
loadCatalog();
