const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log('📁 Загруженные переменные:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ задан' : '❌ не задан');
console.log('DB_NAME:', process.env.DB_NAME);

const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    charset: 'utf8mb4'
});

// Проверка подключения
async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ Подключение к MySQL успешно');
        connection.release();
    } catch (err) {
        console.error('❌ Ошибка подключения к MySQL:', err.message);
    }
}

testConnection();

module.exports = db;
