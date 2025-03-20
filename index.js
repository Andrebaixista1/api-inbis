// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

const app = express();
app.use(cors());
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

app.post('/api/chat', async (req, res) => {
  try {
    const { conversationId, userMessage } = req.body;
    let newConversationId = conversationId;

    if (!newConversationId) {
      newConversationId = Date.now().toString();
      await pool.query(
        `INSERT INTO conversas (conversation_id, role, message, created_at)
         VALUES (?, ?, ?, NOW())`,
        [
          newConversationId,
          'system',
          'Eu sou a Inbis AI, uma inteligencia focada em programação, desenvolvida por André Felipe baseado no SysAnd v5.2, sou a versão Inbis 1.0, o nome Inbis vem do texto Is New Black, "Is the new black" é uma expressão em inglês que significa que algo está tão na moda que pode ser considerado um novo padrão. Vou usar sempre emojis pra deixar a conversa descontraída, textos resumidos e focados em programação.'
        ]
      );
    }

    await pool.query(
      `INSERT INTO conversas (conversation_id, role, message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [newConversationId, 'user', userMessage]
    );

    const [rows] = await pool.query(
      `SELECT role, message FROM conversas WHERE conversation_id = ? ORDER BY id ASC`,
      [newConversationId]
    );

    const messages = rows.map(row => ({
      role: row.role,
      content: row.message
    }));

    const response = await openai.createChatCompletion({
      model: 'gpt-4-turbo',
      messages
    });

    const assistantMessage = response.data.choices[0].message.content;

    await pool.query(
      `INSERT INTO conversas (conversation_id, role, message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [newConversationId, 'assistant', assistantMessage]
    );

    res.json({
      conversationId: newConversationId,
      assistantMessage
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/macica', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt não informado.' });
    }
    const response = await axios.post('https://api-macica.vercel.app/query', { prompt });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;
