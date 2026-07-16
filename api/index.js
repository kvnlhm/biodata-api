// api/index.js - REST API Utama menggunakan Node.js & Express (Vercel Serverless)

const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

// Middleware agar Express dapat menerima dan membaca request body berformat JSON
app.use(express.json());

// Middleware CORS (Cross-Origin Resource Sharing)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Konfigurasi Koneksi Database MySQL Aiven dengan SSL
// Membaca dari Environment Variables (process.env) agar aman saat dipush ke GitHub!
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16481,
    user: process.env.DB_USER || 'avnadmin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb',
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ----------------------------------------------------
// READ (Tampil Semua & Cari Data)
// GET /api/biodata atau GET /api/biodata?search=keyword
// ----------------------------------------------------
app.get('/api/biodata', async (req, res) => {
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

// ----------------------------------------------------
// CREATE (Simpan Data Baru)
// POST /api/biodata dengan body JSON
// ----------------------------------------------------
app.post('/api/biodata', async (req, res) => {
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

// ----------------------------------------------------
// UPDATE (Perbarui Data)
// PUT /api/biodata dengan body JSON
// ----------------------------------------------------
app.put('/api/biodata', async (req, res) => {
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

// ----------------------------------------------------
// DELETE (Hapus Data)
// DELETE /api/biodata?id=X
// ----------------------------------------------------
app.delete('/api/biodata', async (req, res) => {
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
