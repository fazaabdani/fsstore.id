# fsstore.id

Website landing page dan katalog produk FS.ID.

- Domain utama: `fsstore.id`
- Katalog sementara: `fsstore.id/katalog`
- Brand publik: FS.ID
- Dikelola oleh PT Nexabyte Indonesia

## GitHub Pages

Repo ini sudah berisi file `CNAME` untuk custom domain `fsstore.id`.

Aktifkan GitHub Pages dari:

`Settings` -> `Pages` -> `Build and deployment` -> Source: `Deploy from a branch` -> Branch: `main` -> Folder: `/root`.

## DNS domain

Di DNS provider domain, arahkan:

- Apex/root `fsstore.id` ke GitHub Pages dengan A record:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- `www` sebagai CNAME ke `fazaabdani.github.io`.

Catatan: `katalog.fsstore.id` biasanya butuh setup terpisah atau rewrite dari DNS/hosting karena GitHub Pages satu repo hanya memakai satu custom domain utama. Untuk sementara katalog tersedia di `fsstore.id/katalog`.
