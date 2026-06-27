const categoryOrder = ["Laptop", "PC", "All-in-One", "Printer", "Proyektor", "Scanner"];
const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/1TaavUGsH5bmAWPdr2kMgKJCkrfzNoAuOI1OTZnLAsH0/gviz/tq?tqx=out:csv&sheet=Sheet1";
const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
let products = [];
let heroProducts = [];
let heroIndex = 0;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
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
  if (category === "Printer" && brand.toUpperCase().startsWith("PRINTER")) {
    return brand.replace(/^PRINTER\s*/i, "") || words[0] || brand;
  }
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

function splitPhotoLinks(value) {
  const raw = String(value || "");
  const urls = raw.match(/https?:\/\/[^\s,|]+/g);
  return urls?.length ? urls : raw.split(/\s*(?:\r?\n|\||,)\s*/).filter(Boolean);
}

function driveImageUrl(value) {
  const link = String(value || "").trim();
  const fileMatch = link.match(/\/file\/d\/([^/]+)/) || link.match(/[?&]id=([^&]+)/);
  if (fileMatch?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileMatch[1])}&sz=w1200`;
  return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(link) ? link : "";
}

function rowToProduct(row, index, categoryIndex) {
  const rawBrand = row[0]?.trim();
  const series = row[1]?.trim();
  const specs = row.slice(2, 6).map(value => value?.trim() || "");
  const price = parsePrice(row[6]);
  const category = inferCategory(categoryIndex >= 0 ? row[categoryIndex] : "", rawBrand, series);
  if (!rawBrand || !series || !price) return null;
  const brand = resolveBrand(rawBrand, series, category);
  const name = productName(rawBrand, series, category);
  const photos = splitPhotoLinks(row.slice(11, 14).filter(Boolean).join("\n")).map(driveImageUrl).filter(Boolean).slice(0, 3);
  return {
    brand,
    name,
    category,
    specs,
    price,
    image: photos[0] || "",
    slug: slugify(`${name}-${specs.join("-")}-${index}`)
  };
}

function productImage(product) {
  if (!product.image) return `<div class="product-fallback"><span>${escapeHtml(product.category)}</span></div>`;
  return `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false;"><div class="product-fallback" hidden><span>${escapeHtml(product.category)}</span></div>`;
}

function productCard(product) {
  return `
    <article class="featured-card">
      <a class="product-image" href="katalog/index.html#/produk/${escapeHtml(product.slug)}">${productImage(product)}</a>
      <div class="featured-body">
        <div class="product-heading"><span>${escapeHtml(product.category)}</span><small>${escapeHtml(product.brand)}</small></div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.specs.filter(Boolean).join(" - "))}</p>
        <div class="featured-foot">
          <strong>${rupiah(product.price)}</strong>
          <a class="btn btn-light" href="katalog/index.html#/produk/${escapeHtml(product.slug)}">Detail</a>
        </div>
      </div>
    </article>
  `;
}

function balancedProducts(category) {
  if (category) return products.filter(product => product.category === category).slice(0, 6);
  return categoryOrder.map(item => products.find(product => product.category === item)).filter(Boolean);
}

function renderFeatured(category = "") {
  const featured = balancedProducts(category);
  document.getElementById("featuredProducts").innerHTML = featured.map(productCard).join("");
  const viewAll = document.getElementById("viewAllProducts");
  viewAll.href = category ? `katalog/index.html#/kategori/${encodeURIComponent(category)}` : "katalog/index.html#/";
  viewAll.textContent = category ? `Lihat Semua ${category}` : "Lihat Semua Produk";
}

function setHero(index) {
  if (!heroProducts.length) return;
  heroIndex = (index + heroProducts.length) % heroProducts.length;
  const product = heroProducts[heroIndex];
  document.getElementById("heroProductCategory").textContent = product.category;
  document.getElementById("heroProductBrand").textContent = product.brand;
  document.getElementById("heroProductName").textContent = product.name;
  document.getElementById("heroProductSpec").textContent = product.specs.filter(Boolean).join(" - ");
  document.getElementById("heroProductPrice").textContent = rupiah(product.price);
  document.getElementById("heroProductLink").href = `katalog/index.html#/produk/${product.slug}`;
  if (product.image) document.getElementById("heroProductImage").src = product.image;
}

function renderLanding() {
  const categoryCounts = Object.fromEntries(categoryOrder.map(category => [category, products.filter(product => product.category === category).length]));
  document.getElementById("categoryCount").textContent = Object.values(categoryCounts).filter(Boolean).length;
  document.getElementById("productCount").textContent = `${products.length}+`;
  document.querySelectorAll("[data-category-count]").forEach(element => {
    element.textContent = categoryCounts[element.dataset.categoryCount] || 0;
  });

  heroProducts = categoryOrder.map(category => products.find(product => product.category === category && product.image) || products.find(product => product.category === category)).filter(Boolean);
  setHero(0);
  renderFeatured();

  const tickerProducts = products.slice(0, 12);
  const tickerItems = tickerProducts.map(product => `<span>${escapeHtml(product.category)}</span><b>${escapeHtml(product.name)} - ${rupiah(product.price)}</b>`).join("");
  if (tickerItems) document.getElementById("landingTicker").innerHTML = tickerItems + tickerItems;
}

document.querySelector("[data-hero-prev]").addEventListener("click", () => setHero(heroIndex - 1));
document.querySelector("[data-hero-next]").addEventListener("click", () => setHero(heroIndex + 1));
document.querySelectorAll("[data-feature-category]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-feature-category]").forEach(item => item.classList.toggle("active", item === button));
    renderFeatured(button.dataset.featureCategory);
  });
});

fetch(`${sheetCsvUrl}&cache=${Date.now()}`, { cache: "no-store" })
  .then(response => {
    if (!response.ok) throw new Error(`Katalog tidak bisa dimuat (${response.status})`);
    return response.text();
  })
  .then(text => {
    const rows = parseCsv(text);
    const headers = rows[0].map(header => header.trim().toUpperCase());
    const categoryIndex = headers.findIndex(header => ["KATEGORI", "CATEGORY"].includes(header));
    products = rows.slice(1).map((row, index) => rowToProduct(row, index + 1, categoryIndex)).filter(Boolean);
    renderLanding();
    window.setInterval(() => setHero(heroIndex + 1), 6000);
  })
  .catch(error => {
    document.getElementById("featuredProducts").innerHTML = `<div class="loading-products">Produk belum dapat dimuat. Silakan buka katalog atau hubungi admin FS.ID.</div>`;
    console.warn(error);
  });

