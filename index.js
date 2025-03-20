require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Pool para o histórico de conversas (chat)
const poolChat = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


// Configuração do OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Rota para o chat (utiliza o poolChat)
app.post('/api/chat', async (req, res) => {
  try {
    const { conversationId, userMessage } = req.body;
    let newConversationId = conversationId;
    
    if (!newConversationId) {
      newConversationId = Date.now().toString();
      await poolChat.query(
        `INSERT INTO conversas (conversation_id, role, message, created_at)
         VALUES (?, 'system', ?, NOW())`,
        [
          newConversationId,
          `Você é a Inbis AI, uma inteligência focada em programação, 
          desenvolvida por André Felipe baseado no SysAnd v5.2, versão Inbis 1.0. O nome Inbis vem do texto 'Is New Black'. 
          Vou usar sempre emojis para deixar a conversa descontraída, textos resumidos e focados em programação. 
          Sempre responda com o código completo quando for solicitado, utilizando quebras de linha para separar parágrafos e títulos.`
        ]
      );
    }
    
    await poolChat.query(
      `INSERT INTO conversas (conversation_id, role, message, created_at)
       VALUES (?, 'user', ?, NOW())`,
      [newConversationId, userMessage]
    );
    
    const [rows] = await poolChat.query(
      `SELECT role, message FROM conversas
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [newConversationId]
    );
    
    const messages = rows.map(row => ({
      role: row.role,
      content: row.message
    }));
    
    const response = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages
    });
    const assistantMessage = response.data.choices[0].message.content;
    
    await poolChat.query(
      `INSERT INTO conversas (conversation_id, role, message, created_at)
       VALUES (?, 'assistant', ?, NOW())`,
      [newConversationId, assistantMessage]
    );
    
    res.json({
      conversationId: newConversationId,
      assistantMessage
    });
  } catch (error) {
    console.error("Erro na rota /api/chat:", error);
    res.status(500).json({ error: error.message });
  }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
