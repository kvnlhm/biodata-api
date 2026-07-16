// api/index.js - REST API Utama dengan Fitur Registrasi & Login (JWT & Bcrypt)

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// Secret Key untuk enkripsi Token JWT (bisa diatur di environment variable Vercel)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// Middleware CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Koneksi Database MySQL Aiven
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16481,
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    dateStrings: true,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// =========================================================================
// MIDDLEWARE: VERIFIKASI TOKEN JWT (Mengamankan Rute Biodata)
// =========================================================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Mengambil token dari format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Akses ditolak: Anda harus login terlebih dahulu!'
        });
    }

    // Memverifikasi apakah token valid dan belum kedaluwarsa
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Akses ditolak: Sesi Anda habis atau token tidak valid!'
            });
        }
        req.user = decoded; // Menyimpan data identitas user yang didecode ke objek request
        next(); // Melanjutkan ke rute utama
    });
};

// =========================================================================
// RUTE AUTHENTICATION (REGISTRASI & LOGIN)
// =========================================================================

// 1. REGISTRASI PENGGUNA BARU (POST /api/auth/register)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username dan password wajib diisi!' });
        }

        // Cek apakah username sudah terdaftar di database
        const [existingUser] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'Username sudah digunakan!' });
        }

        // Hashing password agar aman di database
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Simpan user baru ke database
        const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
        await pool.query(sql, [username, hashedPassword]);

        res.status(201).json({
            success: true,
            message: 'Pendaftaran berhasil! Silakan login.'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Registrasi gagal: ' + error.message });
    }
});

// 2. LOGIN PENGGUNA (POST /api/auth/login)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username dan password wajib diisi!' });
        }

        // Cari user berdasarkan username
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Username atau password salah!' });
        }

        const user = users[0];

        // Bandingkan password input dengan password hash yang ada di database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Username atau password salah!' });
        }

        // Jika berhasil, buat Token JWT (berlaku selama 7 hari)
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            message: 'Login berhasil!',
            token: token // Mengirimkan token ke aplikasi Android
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login gagal: ' + error.message });
    }
});

// =========================================================================
// RUTE BIODATA (SEKARANG DIPROTEKSI OLEH authenticateToken)
// =========================================================================

// GET all or search (Protected)
app.get('/api/biodata', authenticateToken, async (req, res) => {
    try {
        const { search } = req.query;
        let sql = 'SELECT * FROM biodata ORDER BY id DESC';
        let params = [];

        if (search) {
            sql = 'SELECT * FROM biodata WHERE nama LIKE ? OR agama LIKE ? ORDER BY id DESC';
            params = [`%${search}%`, `%${search}%`];
        }

        const [rows] = await pool.query(sql, params);
        res.status(200).json({
            success: true,
            data: rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data: ' + error.message
        });
    }
});

// POST insert (Protected)
app.post('/api/biodata', authenticateToken, async (req, res) => {
    try {
        const { nama, agama, usia, tanggal_lahir } = req.body;

        if (!nama || !agama || usia === undefined || !tanggal_lahir) {
            return res.status(400).json({
                success: false,
                message: 'Input data tidak lengkap atau tidak valid!'
            });
        }

        const sql = 'INSERT INTO biodata (nama, agama, usia, tanggal_lahir) VALUES (?, ?, ?, ?)';
        const [result] = await pool.query(sql, [nama, agama, Number(usia), tanggal_lahir]);

        res.status(201).json({
            success: true,
            message: 'Data berhasil disimpan!',
            id: result.insertId
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal menyimpan data: ' + error.message
        });
    }
});

// PUT update (Protected)
app.put('/api/biodata', authenticateToken, async (req, res) => {
    try {
        const { id, nama, agama, usia, tanggal_lahir } = req.body;

        if (!id || !nama || !agama || usia === undefined || !tanggal_lahir) {
            return res.status(400).json({
                success: false,
                message: 'Data pembaruan tidak lengkap!'
            });
        }

        const sql = 'UPDATE biodata SET nama = ?, agama = ?, usia = ?, tanggal_lahir = ? WHERE id = ?';
        await pool.query(sql, [nama, agama, Number(usia), tanggal_lahir, Number(id)]);

        res.status(200).json({
            success: true,
            message: 'Data berhasil diperbarui!'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui data: ' + error.message
        });
    }
});

// DELETE (Protected)
app.delete('/api/biodata', authenticateToken, async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID data tidak ditentukan!'
            });
        }

        const sql = 'DELETE FROM biodata WHERE id = ?';
        await pool.query(sql, [Number(id)]);

        res.status(200).json({
            success: true,
            message: 'Data berhasil dihapus!'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus data: ' + error.message
        });
    }
});

module.exports = app;
