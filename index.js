const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const setupRoutes = require('./routes'); // Atualiza a importação das rotas
const app = express();
const axios = require("axios");
require('dotenv').config();

app.use(bodyParser.json());

// Configuração do banco de dados
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// Conectar ao banco de dados
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.stack);
        return;
    }
    console.log('Connected to MySQL database as id ' + db.threadId);
});

// Inicializar o cliente do WhatsApp com persistência de sessão
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: false,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-extensions",
            '--disable-gpu', 
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            '--disable-dev-shm-usage'
        ],
    }
});

// Exibir o QR code para autenticação
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code to log in.');
});

// Login após escanear o QR code
client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

// Manipular erros de autenticação
client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
});

// Manipular desconexão
client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
});

// Iniciar o cliente do WhatsApp
client.initialize()
    .then(() => {
        console.log('WhatsApp client initializing...');
        app.use('/api', setupRoutes(client)); // Passa o client para as rotas após inicialização
    })
    .catch((err) => console.error('Client initialization failed:', err));

// Iniciar o servidor Express na porta desejada
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
