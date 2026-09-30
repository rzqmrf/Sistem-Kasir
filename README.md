# QuickRetail POS - Smart Minimarket & Inventory Management System

Modern, high-speed Point of Sale (POS) and Inventory Management System designed specifically for retail, grocery stores, and minimarkets. Built with **Laravel 12**, **Inertia.js (React)**, **TypeScript**, **Tailwind CSS**, and **SQLite**.

---

## 🌟 Fitur Unggulan (Core Highlights)

### 1. ⚡ High-Speed Cashier Terminal (Layar Kasir POS)
- **Continuous Barcode Scanner:** Input barcode selalu aktif & otomatis fokus. Scan berulang otomatis menambah kuantitas (`qty + 1`).
- **Full Keyboard Navigation:**
  - `F2` : Fokus ke input scan barcode / cari nama produk.
  - `F4` : Buka modal pembayaran (*Checkout*).
  - `F8` : Parkir / Hold transaksi aktif.
  - `F9` : Buka daftar transaksi yang sedang diparkir.
  - `ESC`: Tutup modal aktif.
- **Harga Grosir Bertingkat Otomatis (*Tiered Pricing*):**
  - Misal beli 1-4 pcs = Rp 3.500; Beli $\ge$ 5 pcs = Rp 3.200 (Otomatis hitung hemat grosir di keranjang).
- **Parkir Transaksi (*Hold & Resume Order*):** Simpan transaksi pelanggan jika mereka ingin mengambil barang tambahan, kasir dapat melayani pelanggan berikutnya tanpa jeda.
- **Multi-Payment & Kembalian Cepat:** Tunai (dengan tombol nominal cepat: *Uang Pas*, *+Rp 10.000*, *+Rp 20.000*, *+Rp 50.000*, *+Rp 100.000*), QRIS, Transfer Bank, dan Debit.
- **Cetak Struk Thermal (58mm / 80mm):** Format struk monospace siap cetak ke printer kasir thermal.

### 2. 🔐 Manajemen Shift & Rekonsiliasi Kas Laci (Cash Drawer Audit)
- **Buka Shift:** Wajib input modal kas awal (uang kembalian) sebelum memulai transaksi.
- **Petty Cash (Kas Masuk / Kas Keluar):** Catat pengeluaran darurat (beli plastik kresek, air galon) langsung memotong ekspektasi kas sistem.
- **Tutup Shift & Audit Selisih:** Kasir menghitung uang fisik $\rightarrow$ sistem membandingkan dengan ekspektasi sistem secara real-time dan mencatat status (*Seimbang*, *Lebih Kas*, atau *Defisit*).

### 3. 📦 Manajemen Produk & Stok Inventori
- Katalog produk dengan pencarian cepat nama/barcode/SKU.
- Input HPP (Harga Pokok Penjualan) & Harga Jual.
- Pengaturan tiering harga grosir tanpa batas.
- Riwayat pergerakan stok (*Stock Mutation Trail*) dan penyesuaian stok (*Restock*, *Opname*, *Retur*).
- Indikator peringatan stok menipis (*Low Stock Alert*).

### 4. 📊 Laporan Finansial & Analitik Bisnis
- Ringkasan Omset Penjualan, Total HPP, Laba Kotor (*Gross Profit*), dan Margin Profit (%).
- 10 Produk Paling Laris (*Fast-Moving Products*) dengan kontribusi laba.
- Komposisi metode pembayaran (Tunai vs QRIS vs Transfer).
- Histori audit shift dan log transaksi kasir.

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Prasyarat:
- PHP $\ge$ 8.2
- Composer
- Node.js $\ge$ 18 & NPM

### 2. Jalankan Server:

```bash
cd d:/PROJEK/quickretail-pos

# Menjalankan PHP Web Server
php artisan serve
```

Aplikasi akan berjalan di: **`http://127.0.0.1:8000`**

Untuk mode pengembangan frontend (Hot Module Replacement):
```bash
npm run dev
```

---

## 🔑 Akun Demo Siap Pakai

| Peran | Email | Password |
| :--- | :--- | :--- |
| **Kasir (Demo Cashier)** | `kasir@quickretail.com` | `password123` |
| **Owner / Admin Toko** | `admin@quickretail.com` | `password123` |

*(Di halaman login tersedia tombol klik satu kali untuk langsung mengisi akun demo)*.

---

## 🏗️ Struktur Arsitektur

```
app/
 ├── Http/Controllers/
 │    ├── PosController.php       # Logika transaksi, scan, checkout, hold
 │    ├── ShiftController.php     # Buka/tutup shift & mutasi kas kecil
 │    ├── ProductController.php   # Manajemen produk & harga grosir
 │    └── ReportController.php    # Laba kotor, omset & audit rekonsiliasi
 └── Models/
      ├── Product.php             # Model produk & tier calculation
      ├── ProductPriceTier.php    # Aturan diskon grosir
      ├── Shift.php               # Rekonsiliasi kas laci
      ├── CashMutation.php        # Petty cash in/out
      ├── Sale.php & SaleItem.php # Transaksi & snapshot HPP historis
      └── StockMutation.php       # Mutasi keluar-masuk stok

resources/js/
 ├── Pages/
 │    ├── Pos/Index.tsx           # Layar Terminal Kasir
 │    ├── Products/Index.tsx      # Katalog & Manajemen Stok
 │    ├── Reports/Index.tsx       # Laporan Profit & Audit
 │    └── Auth/Login.tsx          # Login dengan preset demo
 └── Layouts/
      └── AuthenticatedLayout.tsx # POS Dark Theme Nav
```
