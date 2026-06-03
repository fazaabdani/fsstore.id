const products = window.FSID_PRODUCTS;
const rupiah = value => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const wa = text => `https://wa.me/?text=${encodeURIComponent(text)}`;
const statusClass = status => status === "Habis" ? "off" : status === "Cek Ketersediaan" || status === "Pre-order" ? "warn" : "";
const ids = ["search", "brand", "price", "processor", "ram", "storage", "screen", "need", "status"];
const fields = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

function unique(values) {
  return [...new Set(values.flat().filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
}

function fillSelect(id, values) {
  fields[id].innerHTML += values.map(value => `<option value="${value}">${value}</option>`).join("");
}

function productCard(product) {
  return `
    <article class="product-card">
      <div class="product-image"><img src="${product.foto_utama}" alt="${product.nama_produk}"></div>
      <div class="product-body">
        <div class="product-title"><h3>${product.nama_produk}</h3><span class="brand-pill">${product.brand}</span></div>
        <div class="specs"><span>${product.processor}</span><span>${product.ram}</span><span>${product.storage}</span><span>${product.ukuran_layar}</span></div>
        <span class="status ${statusClass(product.status_ketersediaan)}">${product.status_ketersediaan}</span>
        <div class="price">${rupiah(product.harga)}</div>
        <div class="tags">${product.cocok_untuk.map(item => `<span class="tag">${item}</span>`).join("")}</div>
        <div class="card-actions">
          <a class="btn btn-light" href="#/produk/${product.slug_produk}">Lihat Detail</a>
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
  if (brandRoute) fields.brand.value = brandRoute;
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
    <div class="detail-image"><img src="${product.foto_utama}" alt="${product.nama_produk}"></div>
    <article class="detail-panel">
      <span class="brand-pill">${product.brand}</span>
      <h2>${product.nama_produk}</h2>
      <p>${product.deskripsi_singkat}</p>
      <div class="price">${rupiah(product.harga)}</div>
      <span class="status ${statusClass(product.status_ketersediaan)}">${product.status_ketersediaan}</span>
      <div class="detail-specs">
        <div><small>Processor</small>${product.processor}</div>
        <div><small>RAM</small>${product.ram}</div>
        <div><small>Storage</small>${product.storage}</div>
        <div><small>Layar</small>${product.ukuran_layar} ${product.resolusi_layar}</div>
        <div><small>Grafis</small>${product.grafis}</div>
        <div><small>Sistem operasi</small>${product.sistem_operasi}</div>
        <div><small>Warna</small>${product.warna}</div>
        <div><small>Garansi</small>${product.garansi}</div>
        <div><small>Kelengkapan</small>${product.kelengkapan}</div>
        <div><small>Update</small>${product.tanggal_update}</div>
      </div>
      <h3>Rekomendasi penggunaan</h3>
      <div class="tags">${product.kategori_kebutuhan.map(item => `<span class="tag">${item}</span>`).join("")}</div>
      <h3>Kelebihan produk</h3>
      <ul>${product.kelebihan.map(item => `<li>${item}</li>`).join("")}</ul>
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

fillSelect("brand", unique(products.map(item => item.brand)));
fillSelect("processor", unique(products.map(item => item.processor)));
fillSelect("ram", unique(products.map(item => item.ram)));
fillSelect("storage", unique(products.map(item => item.storage)));
fillSelect("screen", unique(products.map(item => item.ukuran_layar)));
fillSelect("need", unique(products.map(item => item.kategori_kebutuhan)));
fillSelect("status", unique(products.map(item => item.status_ketersediaan)));

ids.forEach(id => fields[id].addEventListener("input", renderCatalog));
document.getElementById("resetFilters").addEventListener("click", () => {
  ids.forEach(id => fields[id].value = "");
  history.replaceState(null, "", "#/");
  renderCatalog();
});
window.addEventListener("hashchange", route);
route();
