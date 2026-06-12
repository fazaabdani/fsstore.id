let products = Array.isArray(window.FSID_PRODUCTS) ? window.FSID_PRODUCTS : [];
const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1TaavUGsH5bmAWPdr2kMgKJCkrfzNoAuOI1OTZnLAsH0/gviz/tq?tqx=out:csv&sheet=Sheet1";
const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const wa = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
const statusClass = status => status === "Habis" ? "off" : status === "Cek Ketersediaan" || status === "Pre-order" ? "warn" : "";
const ids = ["search", "brand", "price", "processor", "ram", "storage", "screen", "need", "status"];
const fields = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

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
    .map(item => item.trim())
    .filter(Boolean);
}

function sheetRowToProduct(row, index) {
  const brand = row[0]?.trim();
  const series = row[1]?.trim();
  const processor = row[2]?.trim();
  const ram = row[3]?.trim();
  const storage = row[4]?.trim();
  const display = row[5]?.trim();
  const price = parsePrice(row[6]);
  const stock = row[7]?.trim();
  const status = row[8]?.trim() || (Number(stock) > 0 ? "Tersedia" : "Cek Ketersediaan");
  const features = splitTags(row[9]);
  const location = row[10]?.trim();
  const photoLink = row[11]?.trim();

  if (!brand || !series || !price) return null;

  const name = `${brand} ${series}`;
  const screenResolution = ["WUXGA", "FHD", "HD"].find(item => display?.toUpperCase().includes(item)) || "";
  const tags = [...features, location, "Laptop baru"].filter(Boolean);
  const strengths = [
    processor,
    ram,
    storage,
    display,
    stock ? `Stok ${stock} unit` : ""
  ].filter(Boolean);

  return {
    id_produk: `FS-SHEET-${String(index).padStart(3, "0")}`,
    nama_produk: name,
    brand,
    seri: series,
    processor,
    ram,
    storage,
    ukuran_layar: display,
    resolusi_layar: screenResolution,
    grafis: "-",
    sistem_operasi: "-",
    warna: "-",
    garansi: "Hubungi admin FS.ID",
    kelengkapan: "Unit dan kelengkapan sesuai stok toko",
    harga: price,
    status_ketersediaan: status,
    stok: stock,
    lokasi: location,
    kategori_kebutuhan: tags,
    deskripsi_singkat: `${name} dengan ${processor}, ${ram}, ${storage}, dan layar ${display}.`,
    kelebihan: strengths,
    cocok_untuk: tags.slice(0, 3),
    foto_utama: "assets/fsid-laptop-display.png",
    foto_tambahan: ["assets/fsid-laptop-display.png"],
    link_foto: photoLink,
    slug_produk: slugify(`${name}-${processor}-${ram}-${storage}-${index}`),
    link_whatsapp: "",
    tanggal_update: new Date().toISOString().slice(0, 10)
  };
}

async function loadProductsFromSheet() {
  const response = await fetch(`${sheetCsvUrl}&cache=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Google Sheet tidak bisa dibaca (${response.status})`);
  const rows = parseCsv(await response.text()).slice(1);
  const sheetProducts = rows.map(sheetRowToProduct).filter(Boolean);
  if (!sheetProducts.length) throw new Error("Google Sheet belum berisi produk valid");
  products = sheetProducts;
}

function unique(values) {
  return [...new Set(values.flat().filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

function fillSelect(id, values) {
  const firstOption = fields[id].querySelector("option")?.outerHTML || "";
  fields[id].innerHTML = firstOption + values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
}

function productCard(product) {
  return `
    <article class="product-card">
      <div class="product-image product-visual" aria-label="${escapeHtml(product.nama_produk)}"><div class="laptop-icon"></div></div>
      <div class="product-body">
        <div class="product-title"><h3>${escapeHtml(product.nama_produk)}</h3><span class="brand-pill">${escapeHtml(product.brand)}</span></div>
        <div class="specs"><span>${escapeHtml(product.processor)}</span><span>${escapeHtml(product.ram)}</span><span>${escapeHtml(product.storage)}</span><span>${escapeHtml(product.ukuran_layar)}</span></div>
        <span class="status ${statusClass(product.status_ketersediaan)}">${escapeHtml(product.status_ketersediaan)}</span>
        <div class="price">${rupiah(product.harga)}</div>
        <div class="tags">${product.cocok_untuk.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
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
  return (!query || [product.nama_produk, product.brand, product.seri, product.processor].join(" ").toLowerCase().includes(query)) &&
    (!fields.brand.value || product.brand === fields.brand.value) &&
    (!fields.processor.value || product.processor === fields.processor.value) &&
    (!fields.ram.value || product.ram === fields.ram.value) &&
    (!fields.storage.value || product.storage === fields.storage.value) &&
    (!fields.screen.value || product.ukuran_layar === fields.screen.value) &&
    (!fields.need.value || product.kategori_kebutuhan.includes(fields.need.value)) &&
    (!fields.status.value || product.status_ketersediaan === fields.status.value) &&
    (!priceRange || (product.harga >= priceRange[0] && product.harga <= priceRange[1]));
}

function renderCatalog() {
  const brandRoute = decodeURIComponent(location.hash.match(/^#\/brand\/(.+)$/)?.[1] || "");
  if (brandRoute) {
    const option = [...fields.brand.options].find(item => item.value.toLowerCase() === brandRoute.toLowerCase());
    fields.brand.value = option?.value || brandRoute;
  }
  const filtered = products.filter(matches);
  document.getElementById("resultCount").textContent = `${filtered.length} produk ditemukan`;
  document.getElementById("productGrid").innerHTML = filtered.map(productCard).join("") || `<div class="detail-panel"><strong>Produk belum ditemukan.</strong><p>Ubah filter atau konsultasikan kebutuhan panjenengan dengan admin FS.ID.</p></div>`;
}

function renderDetail(slug) {
  const product = products.find(item => item.slug_produk === slug);
  if (!product) {
    location.hash = "#/";
    return;
  }
  document.getElementById("detailContent").innerHTML = `
    <div class="detail-image product-visual detail-visual" aria-label="${escapeHtml(product.nama_produk)}"><div class="laptop-scene"><div class="display display-main"></div><div class="display display-side"></div><div class="keyboard-deck"></div></div></div>
    <article class="detail-panel">
      <span class="brand-pill">${escapeHtml(product.brand)}</span>
      <h2>${escapeHtml(product.nama_produk)}</h2>
      <p>${escapeHtml(product.deskripsi_singkat)}</p>
      <div class="price">${rupiah(product.harga)}</div>
      <span class="status ${statusClass(product.status_ketersediaan)}">${escapeHtml(product.status_ketersediaan)}</span>
      <div class="detail-specs">
        <div><small>Processor</small>${escapeHtml(product.processor)}</div>
        <div><small>RAM</small>${escapeHtml(product.ram)}</div>
        <div><small>Storage</small>${escapeHtml(product.storage)}</div>
        <div><small>Layar</small>${escapeHtml(`${product.ukuran_layar} ${product.resolusi_layar}`)}</div>
        <div><small>Grafis</small>${escapeHtml(product.grafis)}</div>
        <div><small>Sistem operasi</small>${escapeHtml(product.sistem_operasi)}</div>
        <div><small>Lokasi</small>${escapeHtml(product.lokasi || "-")}</div>
        <div><small>Stok</small>${escapeHtml(product.stok || "-")}</div>
        <div><small>Garansi</small>${escapeHtml(product.garansi)}</div>
        <div><small>Update</small>${escapeHtml(product.tanggal_update)}</div>
      </div>
      <h3>Rekomendasi penggunaan</h3>
      <div class="tags">${product.kategori_kebutuhan.map(item => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>
      <h3>Kelebihan produk</h3>
      <ul>${product.kelebihan.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${product.link_foto ? `<a class="btn btn-light" href="${escapeHtml(product.link_foto)}" target="_blank" rel="noreferrer">Lihat Foto Produk</a>` : ""}
      <a class="btn btn-whatsapp" href="${wa(`Assalamu'alaikum, saya mau konsultasi produk ${product.nama_produk}. Apakah ketersediaan dan harganya masih sesuai katalog?`)}" target="_blank" rel="noreferrer">Konsultasi WhatsApp</a>
    </article>
  `;
  const related = products.filter(item => item.brand === product.brand && item.slug_produk !== product.slug_produk).concat(products.filter(item => item.brand !== product.brand)).slice(0, 3);
  document.getElementById("relatedProducts").innerHTML = related.map(productCard).join("");
}

function route() {
  const detailSlug = location.hash.match(/^#\/produk\/(.+)$/)?.[1];
  document.getElementById("catalogView").classList.toggle("hidden", Boolean(detailSlug));
  document.getElementById("detailView").classList.toggle("hidden", !detailSlug);
  if (detailSlug) renderDetail(detailSlug);
  else renderCatalog();
}

function hydrateFilters() {
  fillSelect("brand", unique(products.map(item => item.brand)));
  fillSelect("processor", unique(products.map(item => item.processor)));
  fillSelect("ram", unique(products.map(item => item.ram)));
  fillSelect("storage", unique(products.map(item => item.storage)));
  fillSelect("screen", unique(products.map(item => item.ukuran_layar)));
  fillSelect("need", unique(products.map(item => item.kategori_kebutuhan)));
  fillSelect("status", unique(products.map(item => item.status_ketersediaan)));
}

ids.forEach(id => fields[id].addEventListener("input", renderCatalog));
document.getElementById("resetFilters").addEventListener("click", () => {
  ids.forEach(id => fields[id].value = "");
  history.replaceState(null, "", "#/");
  renderCatalog();
});
window.addEventListener("hashchange", route);
hydrateFilters();
route();

loadProductsFromSheet()
  .then(() => {
    hydrateFilters();
    route();
  })
  .catch(error => {
    console.warn(error);
  });
