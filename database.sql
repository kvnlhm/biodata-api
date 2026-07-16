-- SQL script untuk membuat tabel biodata dan tabel users
-- Jalankan bagian CREATE TABLE users di database Aiven Anda

CREATE TABLE IF NOT EXISTS biodata (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    agama VARCHAR(50) NOT NULL,
    usia INT NOT NULL,
    tanggal_lahir DATE NOT NULL
);

-- Tabel baru untuk menyimpan data akun login pengguna
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);
