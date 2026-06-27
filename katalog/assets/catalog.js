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
const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1TaavUGsH5bmAWPdr2kMgKJCkrfzNoAuOI1OTZnLAsH0/gviz/tq?tqx=out:csv&sheet=Sheet1";
const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const wa = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
let sheetLoading = true;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
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
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
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
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim().replace(/^["']+|["']+$/g, "").trim())
    .filter(Boolean);
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
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = {
    laptop: "Laptop",
    notebook: "Laptop",
    pc: "PC",
    komputer: "PC",
    "all-in-one": "All-in-One",
    "all in one": "All-in-One",
    aio: "All-in-One",
    printer: "Printer",
    proyektor: "Proyektor",
    projector: "Proyektor",
    scanner: "Scanner",
    scancer: "Scanner"
  };
  return aliases[normalized] || "";
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
  if (category === "Printer" && brand.toUpperCase().startsWith("PRINTER")) {
    return brand.replace(/^PRINTER\s*/i, "") || words[0] || brand;
  }
  if (category === "Scanner" && ["SCANNER", "SCANCER"].includes(brand.toUpperCase())) {
    return words[0] || brand;
  }
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

function normalizeFallbackProduct(product) {
  const kategori = inferCategory(product.kategori, product.brand, product.seri || product.nama_produk);
  const specs = product.specs || [product.processor, product.ram, product.storage, product.ukuran_layar];
  const fitur = product.fitur || product.kategori_kebutuhan || product.cocok_untuk || [];
  return { ...product, kategori, specs, fitur, cocok_untuk: fitur.slice(0, 3) };
}

let products = (Array.isArray(window.FSID_PRODUCTS) ? window.FSID_PRODUCTS : []).map(normalizeFallbackProduct);

function productImage(product, className = "product-image product-visual") {
  const imageUrl = product.foto_dinamis?.[0] || driveImageUrl(product.link_foto);
  if (!imageUrl) {
    return `<div class="${className}" aria-label="${escapeHtml(product.nama_produk)}"><div class="laptop-icon"></div></div>`;
  }
  return `<div class="${className}" aria-label="${escapeHtml(product.nama_produk)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.nama_produk)}" loading="lazy" referrerpolicy="no-referrer" onerror="const box=this.parentElement;this.remove();const fallback=document.createElement('div');fallback.className='laptop-icon';box.classList.add('product-visual');box.appendChild(fallback);"></div>`;
}

function productGallery(product) {
  const images = product.foto_dinamis?.length ? product.foto_dinamis.slice(0, 3) : [];
  if (!images.length) return productImage(product, "detail-image detail-visual");
  const slides = images.map((image, index) => `
    <figure class="gallery-slide">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(`${product.nama_produk} foto ${index + 1}`)}" loading="${index === 0 ? "eager" : "lazy"}" referrerpolicy="no-referrer">
    </figure>
  `).join("");
  const dots = images.map((_, index) => `<button class="gallery-dot${index === 0 ? " active" : ""}" type="button" aria-label="Lihat foto ${index + 1}" data-slide="${index}"></button>`).join("");
  return `
    <div class="detail-gallery" data-gallery>
      <div class="gallery-track">${slides}</div>
      ${images.length > 1 ? `
        <button class="gallery-nav gallery-prev" type="button" aria-label="Foto sebelumnya" data-gallery-prev>&lt;</button>
        <button class="gallery-nav gallery-next" type="button" aria-label="Foto berikutnya" data-gallery-next>&gt;</button>
        <div class="gallery-dots">${dots}</div>
      ` : ""}
    </div>
  `;
}

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
  const summary = specs.map((value, specIndex) => value ? `${labels[specIndex]} ${value}` : "").filter(Boolean).join(", ");
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
    foto_utama: photoLinks[0] || "assets/fsid-laptop-display.png",
    foto_tambahan: photoLinks,
    foto_dinamis: photoLinks,
    link_foto: photoLink,
    slug_produk: slugify(`${name}-${specs.join("-")}-${index}`)
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

function unique(values) {
  return [...new Set(values.flat().filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

function fillSelect(id, values, placeholder) {
  const select = fields[id];
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
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

function updateCatalogChrome() {
  const categories = unique(products.map(item => item.kategori));
  const featured = products.find(item => String(item.status_ketersediaan).toLowerCase().includes("tersedia")) || products[0];
  setText("categoryCount", categories.length);
  setText("totalProducts", `${products.length}+`);
  setText("sheetStatus", "Live");
  if (featured) {
    setText("featureBrand", `${featured.kategori} / ${featured.brand || "FS.ID"}`);
    setText("featureName", featured.nama_produk || "Produk FS.ID");
    setText("featureSpec", featured.specs.filter(Boolean).join(" - "));
    setText("featurePrice", rupiah(featured.harga || 0));
    setText("featureStatus", featured.status_ketersediaan || "Cek produk");
  }
  const ticker = document.getElementById("tickerTrack");
  if (ticker) {
    const items = products.slice(0, 12).map(product => `<span>${escapeHtml(product.kategori)}</span><b>${escapeHtml(product.nama_produk)} - ${rupiah(product.harga || 0)}</b>`).join("");
    ticker.innerHTML = items + items;
  }
}

function productSpecs(product, detail = false) {
  const labels = labelsFor(product);
  return product.specs.map((value, index) => value ? `
    <${detail ? "div" : "span"}><small>${escapeHtml(labels[index])}</small>${escapeHtml(value)}</${detail ? "div" : "span"}>
  ` : "").join("");
}

function productCard(product) {
  const tags = product.cocok_untuk.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join("");
  return `
    <article class="product-card">
      ${productImage(product)}
      <div class="product-body">
        <div class="product-title"><h3>${escapeHtml(product.nama_produk)}</h3><span class="category-pill">${escapeHtml(product.kategori)}</span></div>
        <div class="product-brand">${escapeHtml(product.brand)}</div>
        <div class="specs">${productSpecs(product)}</div>
        <span class="status ${statusClass(product.status_ketersediaan)}">${escapeHtml(product.status_ketersediaan)}</span>
        <div class="price">${rupiah(product.harga)}</div>
        ${tags ? `<div class="tags">${tags}</div>` : ""}
        <div class="card-actions">
          <a class="btn btn-light" href="#/produk/${escapeHtml(product.slug_produk)}">Lihat Detail</a>
          <a class="btn btn-whatsapp" href="${wa(`Assalamu'alaikum, saya mau konsultasi produk ${product.nama_produk}. Apakah ketersediaan dan harganya masih sesuai katalog?`)}" target="_blank" rel="noreferrer">Konsultasi</a>
        </div>
      </div>
    </article>
  `;
}

function matches(product) {
  const query = fields.search.value.trim().toLowerCase();
  const priceRange = fields.price.value ? fields.price.value.split("-").map(Number) : null;
  const searchable = [product.nama_produk, product.brand, product.seri, product.kategori, product.specs, product.fitur].flat().join(" ").toLowerCase();
  return (!query || searchable.includes(query)) &&
    (!fields.category.value || product.kategori === fields.category.value) &&
    (!fields.brand.value || product.brand === fields.brand.value) &&
    (!fields.processor.value || product.specs[0] === fields.processor.value) &&
    (!fields.ram.value || product.specs[1] === fields.ram.value) &&
    (!fields.storage.value || product.specs[2] === fields.storage.value) &&
    (!fields.screen.value || product.specs[3] === fields.screen.value) &&
    (!fields.need.value || product.fitur.includes(fields.need.value)) &&
    (!fields.status.value || product.status_ketersediaan === fields.status.value) &&
    (!priceRange || (product.harga >= priceRange[0] && product.harga <= priceRange[1]));
}

function updateCategoryTabs() {
  document.querySelectorAll("[data-category-tab]").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.categoryTab === fields.category.value);
  });
  const activeTab = document.querySelector("[data-category-tab].active");
  const tabBar = activeTab?.parentElement;
  if (activeTab && tabBar) {
    tabBar.scrollLeft = Math.max(0, activeTab.offsetLeft - (tabBar.clientWidth - activeTab.offsetWidth) / 2);
  }
}

function applyCategoryRoute() {
  const routeCategory = decodeURIComponent(location.hash.match(/^#\/kategori\/(.+)$/)?.[1] || "");
  if (routeCategory) fields.category.value = normalizeCategory(routeCategory) || routeCategory;
}

function renderCatalog() {
  applyCategoryRoute();
  configureSpecFilters(fields.category.value);
  updateCategoryTabs();
  const filtered = products.filter(matches);
  const suffix = fields.category.value ? ` dalam kategori ${fields.category.value}` : "";
  document.getElementById("resultCount").textContent = `${filtered.length} produk ditemukan${suffix}`;
  document.getElementById("productGrid").innerHTML = filtered.map(productCard).join("") || `<div class="detail-panel"><strong>Produk belum ditemukan.</strong><p>Ubah filter atau konsultasikan kebutuhan panjenengan dengan admin FS.ID.</p></div>`;
}

function renderDetail(slug) {
  const product = products.find(item => item.slug_produk === slug);
  if (!product) {
    if (sheetLoading) {
      document.getElementById("detailContent").innerHTML = `<div class="detail-panel"><strong>Memuat detail produk...</strong><p>Data foto dan produk sedang diambil dari Google Sheet.</p></div>`;
      document.getElementById("relatedProducts").innerHTML = "";
      return;
    }
    location.hash = "#/";
    return;
  }
  const tags = product.fitur.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join("");
  document.getElementById("detailContent").innerHTML = `
    ${productGallery(product)}
    <article class="detail-panel">
      <div class="detail-badges"><span class="category-pill">${escapeHtml(product.kategori)}</span><span class="brand-pill">${escapeHtml(product.brand)}</span></div>
      <h2>${escapeHtml(product.nama_produk)}</h2>
      <p>${escapeHtml(product.deskripsi_singkat)}</p>
      <div class="price">${rupiah(product.harga)}</div>
      <span class="status ${statusClass(product.status_ketersediaan)}">${escapeHtml(product.status_ketersediaan)}</span>
      <div class="detail-specs">
        ${productSpecs(product, true)}
        <div><small>Garansi</small>${escapeHtml(product.garansi)}</div>
        <div><small>Update</small>${escapeHtml(product.tanggal_update)}</div>
      </div>
      ${tags ? `<h3>Fitur tambahan</h3><div class="tags">${tags}</div>` : ""}
      <h3>Ringkasan spesifikasi</h3>
      <ul>${product.kelebihan.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${product.link_foto ? `<a class="btn btn-light" href="${escapeHtml(product.link_foto.split("\n")[0])}" target="_blank" rel="noreferrer">Lihat Foto Produk</a>` : ""}
      <a class="btn btn-whatsapp" href="${wa(`Assalamu'alaikum, saya mau konsultasi produk ${product.nama_produk}. Apakah ketersediaan dan harganya masih sesuai katalog?`)}" target="_blank" rel="noreferrer">Konsultasi WhatsApp</a>
    </article>
  `;
  initGallery();
  const related = products
    .filter(item => item.kategori === product.kategori && item.slug_produk !== product.slug_produk)
    .concat(products.filter(item => item.brand === product.brand && item.kategori !== product.kategori))
    .concat(products.filter(item => item.slug_produk !== product.slug_produk && item.kategori !== product.kategori && item.brand !== product.brand))
    .slice(0, 3);
  document.getElementById("relatedProducts").innerHTML = related.map(productCard).join("");
}

function initGallery() {
  const gallery = document.querySelector("[data-gallery]");
  if (!gallery) return;
  const track = gallery.querySelector(".gallery-track");
  const dots = [...gallery.querySelectorAll(".gallery-dot")];
  let active = 0;
  const show = index => {
    const total = dots.length || track.children.length;
    active = (index + total) % total;
    track.style.transform = `translateX(-${active * 100}%)`;
    dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === active));
  };
  gallery.querySelector("[data-gallery-prev]")?.addEventListener("click", () => show(active - 1));
  gallery.querySelector("[data-gallery-next]")?.addEventListener("click", () => show(active + 1));
  dots.forEach(dot => dot.addEventListener("click", () => show(Number(dot.dataset.slide || 0))));
}

function route() {
  const detailSlug = location.hash.match(/^#\/produk\/(.+)$/)?.[1];
  document.getElementById("catalogView").classList.toggle("hidden", Boolean(detailSlug));
  document.getElementById("detailView").classList.toggle("hidden", !detailSlug);
  if (detailSlug) renderDetail(detailSlug);
  else renderCatalog();
}

function clearFilters(keepCategory = false) {
  filterIds.forEach(id => {
    if (keepCategory && id === "category") return;
    fields[id].value = "";
  });
}

filterIds.filter(id => id !== "category").forEach(id => fields[id].addEventListener("input", renderCatalog));
fields.category.addEventListener("change", () => {
  const category = fields.category.value;
  ["brand", "processor", "ram", "storage", "screen", "need"].forEach(id => fields[id].value = "");
  hydrateFilters();
  history.replaceState(null, "", category ? `#/kategori/${encodeURIComponent(category)}` : "#/");
  renderCatalog();
});
document.querySelectorAll("[data-category-tab]").forEach(tab => {
  tab.addEventListener("click", () => {
    clearFilters();
    fields.category.value = tab.dataset.categoryTab;
    hydrateFilters();
  });
});
document.querySelectorAll('a[href="#/"]').forEach(link => {
  link.addEventListener("click", () => {
    clearFilters();
    hydrateFilters();
    window.setTimeout(renderCatalog, 0);
  });
});
document.getElementById("resetFilters").addEventListener("click", () => {
  clearFilters();
  hydrateFilters();
  history.replaceState(null, "", "#/");
  renderCatalog();
});
window.addEventListener("hashchange", () => {
  applyCategoryRoute();
  hydrateFilters();
  route();
});

hydrateFilters();
updateCatalogChrome();
route();

loadProductsFromSheet()
  .then(() => {
    sheetLoading = false;
    applyCategoryRoute();
    hydrateFilters();
    updateCatalogChrome();
    route();
  })
  .catch(error => {
    sheetLoading = false;
    setText("sheetStatus", "Fallback");
    console.warn(error);
  });

