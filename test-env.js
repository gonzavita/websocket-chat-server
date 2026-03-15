const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
console.log('🔍 Путь:', envPath);

if (fs.existsSync(envPath)) {
    console.log('✅ Файл .env найден');
    const content = fs.readFileSync(envPath, 'utf8');
    console.log('📄 Содержимое:');
    console.log(content.split('\n').map((line, i) => `${i+1}: ${JSON.stringify(line)}`).join('\n'));
} else {
    console.log('❌ Файл .env НЕ найден');
}
