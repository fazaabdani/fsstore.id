(function () {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function driveImageUrl(value) {
    const link = String(value || "").trim();
    if (!link) return "";
    const fileMatch = link.match(/\/file\/d\/([^/]+)/) || link.match(/[?&]id=([^&]+)/);
    if (fileMatch?.[1]) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileMatch[1])}&sz=w1200`;
    return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(link) ? link : "";
  }

  function fallbackImage(name, className) {
    return `<div class="${className} product-visual" aria-label="${escapeHtml(name)}"><div class="laptop-icon"></div></div>`;
  }

  function productImage(product, className = "product-image") {
    const imageUrl = driveImageUrl(product.link_foto);
    if (!imageUrl) return fallbackImage(product.nama_produk, className);
    return `<div class="${className}" aria-label="${escapeHtml(product.nama_produk)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.nama_produk)}" loading="lazy" referrerpolicy="no-referrer" onerror="const box=this.parentElement;this.remove();const fallback=document.createElement('div');fallback.className='laptop-icon';box.classList.add('product-visual');box.appendChild(fallback);"></div>`;
  }

  const style = document.createElement("style");
  style.textContent = `
    .detail-image img {
      width: 100%;
      height: 100%;
      min-height: 420px;
      object-fit: cover;
    }
  `;
  document.head.appendChild(style);

  if (typeof productCard === "function") {
    productCard = function (product) {
      return `
        <article class="product-card">
          ${productImage(product)}
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
    };
  }

  if (typeof renderDetail === "function") {
    renderDetail = function (slug) {
      const product = products.find(item => item.slug_produk === slug);
      if (!product) {
        location.hash = "#/";
        return;
      }
      document.getElementById("detailContent").innerHTML = `
        ${productImage(product, "detail-image detail-visual")}
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
    };
  }

  if (typeof route === "function") route();
})();
