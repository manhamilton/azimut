# Azimut Utara — Web App

Aplikasi web responsif berbasis HTML, CSS, dan JavaScript yang menggunakan `AZIMUT UTARA EXP.xlsx` sebagai referensi rumus.

## Fitur
- Kalkulator Azimut Utara Sejati dan azimut kiblat.
- Input tanggal, jam, zona waktu, latitude, longitude, dan nama lokasi.
- GPS browser (memerlukan izin dan HTTPS atau localhost).
- Kompas visual berbasis azimut numerik; akses sensor orientasi dicoba jika browser/perangkat mendukung.
- Riwayat lokal di browser (`localStorage`).
- Ekspor CSV/JSON dan cetak ke PDF melalui dialog cetak.
- Peta OpenStreetMap + garis menuju Ka'bah (memerlukan internet).
- Service worker dasar untuk caching aset lokal.

## Menjalankan
1. Ekstrak ZIP.
2. Untuk tes sederhana, jalankan server lokal dari folder ini, misalnya `python -m http.server 8000`, lalu buka `http://localhost:8000`. (GPS biasanya diizinkan pada localhost.)
3. Untuk akses publik/GPS, deploy ke GitHub Pages atau hosting HTTPS.
4. Untuk APK, gunakan pembungkus WebView seperti Capacitor atau Trusted Web Activity. Untuk sensor/GPS yang konsisten di APK, uji izin Android dan konfigurasi origin.

## Formula dan validasi
Workbook sampel (15 Oktober 2026, 15:55:00, zona +7, latitude -6.884469, longitude 107.557319) menyimpan:
- Azimut kiblat sekitar **295.173456°**.
- Azimut Utara Sejati sekitar **96.221170°**.

Implementasi azimut kiblat memakai initial bearing great-circle:
`atan2(sin(Δλ), cos(φ) tan(φK) − sin(φ) cos(Δλ))`, dinormalisasi ke 0–360°. Ini memperbaiki kelemahan `ATAN(numerator/denominator)` di Excel yang tidak mempertahankan kuadran untuk semua koordinat.

Azimut Utara Sejati mereplikasi pendekatan spreadsheet untuk Julian Day, Equation of Time, deklinasi, sudut waktu, cotangent, dan pemilihan cabang. Itu bukan algoritma astronomi presisi tinggi universal; hasilnya dapat menjadi tidak stabil dekat singularitas (misalnya sekitar transit). Gunakan sumber astronomi independen dan instrumen terkalibrasi untuk pengukuran resmi.

## Catatan penting
- Kompas visual menunjukkan azimut relatif terhadap utara sejati. Heading sensor ponsel biasanya magnetik atau bergantung implementasi; aplikasi ini **tidak** mengoreksi deklinasi magnetik secara otomatis. Jangan menganggap arah visual sebagai instrumen survey terkalibrasi.
- Riwayat disimpan di browser/perangkat dan tidak tersinkron ke akun lain.
- Peta, Leaflet, dan tile OpenStreetMap membutuhkan internet. Kalkulasi inti berjalan lokal.
- Ini prototipe yang bisa diuji, bukan alat ukur tersertifikasi.
