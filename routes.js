const { configDotenv } = require('dotenv');
const express = require('express');
const mysql = require('mysql2');
const router = express.Router();
require('dotenv').config();

// Configura o banco de dados
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

let conversations = {}; // Objeto para armazenar o estado das conversas

// Função para calcular a diferença de tempo entre agora e o timestamp da mensagem
const isRecentMessage = (messageTimestamp) => {
    const now = Math.floor(Date.now() / 1000); // Data atual em segundos
    const messageAge = now - messageTimestamp; // Idade da mensagem em segundos
    const maxAge = 1 * 10; // Aceita mensagens de até 10 segundos de idade (10 segundos)
    
    return messageAge <= maxAge; // Retorna true se a mensagem for recente
};

// Função para configurar rotas, que aceita o cliente como parâmetro
const setupRoutes = (client) => {
    client.on('message', async (message) => {
        const from = message.from; // ID do remetente
        const messageBody = message.body.trim().toLowerCase(); // Texto da mensagem
        const messageTimestamp = message.timestamp; // Timestamp da mensagem

        // Verifica se a mensagem veio de um grupo pelo ID
        const isGroup = message.from.endsWith('@g.us');

        // Ignora mensagens de grupos, do próprio bot ou mensagens antigas
        if (isGroup || message.fromMe || !isRecentMessage(messageTimestamp)) {
            console.log('Ignoring message from group, self, or old message.');
            return; // Ignora mensagens de grupos, do próprio bot ou antigas
        }

        // Inicializa a conversa se o usuário for novo
        if (!conversations[from]) {
            conversations[from] = { step: 0 };
        }

        // Função para enviar uma mensagem
        const sendMessage = async (msg) => {
            await client.sendMessage(from, msg);
        };

        // Verifica o estado atual da conversa
        const conversation = conversations[from];

        switch (conversation.step) {
            case 0:
                // Primeira pergunta
                await sendMessage("Bom dia, meu nome é Sabrina, vou te ajudar no seu atendimento. Qual o seu nome?");
                conversation.step = 1;
                break;

            case 1:
                //Inicia o atendimento de forma mais pessoal
                conversation.name = messageBody; // Salva o nome
                await sendMessage(`Prazer em te conhecer, ${conversation.name}. Você teria interesse em qual região de Goiás?`);
                conversation.step = 2;
                break;

            case 2:
                // O cliente responde com a região de interesse
                const region = messageBody; // Salva a região mencionada

                db.query('SELECT tipo, endereco, valor_venda FROM imovelbot WHERE bairro LIKE ?', [`%${region}%`], 
                    async (err, results) => {
                        if (err) {
                            console.error('Erro ao executar a query:', err);
                            await sendMessage('Desculpe, ocorreu um erro ao buscar informações. Tente novamente mais tarde.');
                            return;
                        }

                        if (results.length > 0) {
                            // Supondo que você deseja enviar apenas o primeiro resultado
                            const { tipo, endereco, valor_venda } = results[0];

                            // Certifique-se de que as variáveis têm valores válidos
                            if (tipo && endereco && valor_venda) {
                                // Formata a mensagem a ser enviada com os dados
                                const mensagem = `Modelo de casa: ${tipo}, Endereço: ${endereco}, Preço: ${valor_venda}`;
                                // Envia a mensagem para o usuário
                                await sendMessage(mensagem);
                            } else {
                                // Caso algum valor esteja indefinido
                                await sendMessage('Informações incompletas encontradas.');
                            }
                        } else {
                            // Caso nenhum resultado seja encontrado
                            await sendMessage('Nenhuma propriedade encontrada para a região especificada.');
                        }
                        // Encerra a conversa após o envio da informação
                        delete conversations[from];
                    });
                break;

            default:
                // Reinicia a conversa
                await sendMessage("Por favor, me diga o seu nome para que possamos começar.");
                conversation.step = 1;
                break;
        }
    });

    return router; // Retorna o roteador
};

module.exports = setupRoutes;
