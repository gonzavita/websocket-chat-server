const pool = require('./db');

async function test() {
    try {
        const [rows] = await pool.query("SELECT NOW() as time");
        console.log("✅ Подключение к MySQL успешно:", rows[0].time);
    } catch (err) {
        console.error("❌ Ошибка подключения:", err.message);
    }
}

test();
