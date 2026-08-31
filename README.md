# BelanjaCalc Pro — Kalkulator Pembelian Barang Multi-Satuan

Aplikasi web modern, responsif, dan mudah digunakan untuk menghitung pembelian barang secara presisi dengan dukungan multi-satuan (**Unit/Pcs, Kg, Gram, Liter, Box, Dus, Meter, dsb.**), diskon, pajak, ongkir, serta cetak struk nota belanja dan ekspor Excel/CSV.

---

## 🌟 Fitur Utama

1. **Parameter Satuan Lengkap & Fleksibel**:
   - **Standar**: Unit / Pcs, Kg (Kilogram), Gram (g), Liter (L), Mililiter (ml).
   - **Grosir & Kemasan**: Box / Dus, Pack / Bungkus, Lusin (12 pcs), Kodi (20 pcs), Rim (500 lbr), Sak / Karung, Ikat, Meter.
   - **Kustom**: Bebas ketik satuan sendiri jika ada kebutuhan khusus.
   - **Dukungan Desimal**: Bisa input koma/desimal (misal: `1.5 kg`, `0.25 kg`, `2.75 liter`).

2. **Kalkulasi & Diskon Real-time**:
   - Perhitungan otomatis subtotal per item (Harga Satuan × Jumlah - Diskon Item).
   - Diskon per item (bisa `%` persen atau `Rp` nominal rupiah).
   - Diskon global / tambahan untuk total belanja.
   - Pajak / PPN otomatis (default 11% atau persentase kustom).
   - Ongkos kirim / biaya tambahan.
   - Grand Total akhir dengan fitur **Terbilang** (*misal: "Satu juta dua ratus ribu rupiah"*).

3. **Manajemen Item Belanja**:
   - Edit langsung pada tabel (*inline edit*) untuk nama, jumlah, dan harga tanpa perlu reload.
   - Tombol cepat contoh barang (Beras 5kg, Minyak 2L, Telur 1.5kg, dsb).
   - Tombol duplikat dan hapus item.
   - Ringkasan total macam barang dan rincian total per satuan (contoh: *Total: 6.5 Kg, 5 Unit, 2 Liter*).

4. **Ekspor & Cetak Nota/Invoice**:
   - **Cetak Struk / Nota PDF**: Tampilan nota yang rapi, bersih, dan siap diprint di kertas A4 maupun thermal printer.
   - **Ekspor Excel / CSV**: Format CSV dengan encoding UTF-8 BOM yang otomatis terbaca rapi di Microsoft Excel.
   - **Salin Data JSON**: Memudahkan pencadangan dan integrasi data teknis.

5. **Penyimpanan Lokal (LocalStorage)**:
   - Auto-save draft belanjaan saat browser di-refresh.
   - Riwayat transaksi tersimpan untuk melihat transaksi sebelumnya.
   - Dark Mode / Light Mode toggle yang tersimpan otomatis.

---

## 📂 Struktur File

```
kalkulator-belanja/
├── index.html       # Antarmuka web responsif dengan Tailwind CSS & Lucide Icons
├── style.css        # Gaya kustom, animasi & print stylesheet untuk nota
├── app.js           # Mesin kalkulasi, format Rupiah, local storage, dan export
└── README.md        # Panduan aplikasi
```
