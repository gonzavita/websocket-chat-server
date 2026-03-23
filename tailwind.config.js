cat > tailwind.config.js << 'EOL'
module.exports = {
  content: [
    "/var/www/service-taxi31.ru/html/chat.html",
    "/var/www/service-taxi31.ru/html/js/*.js"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOL
