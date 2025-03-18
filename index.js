require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do OpenAI
const configuration = new Configuration({
  apiKey: "REMOVED",
});
const openai = new OpenAIApi(configuration);

// Middleware para restringir IPs
app.use((req, res, next) => {
  const allowedIps = ['::1','201.0.21.143', '45.224.161.116'];
  let clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // Corrigir o formato do IP quando estiver em formato IPv6
  if (clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();  // No caso de múltiplos IPs intermediários
  }
  
  // Se for IPv6, tratar a versão com ::ffff:
  clientIp = clientIp.replace('::ffff:', '');
  
  console.log('IP cliente:', clientIp); // Para depuração
  
  if (!allowedIps.includes(clientIp)) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  next();  // Permitir acesso se o IP for permitido
});

// Rota para enviar mensagem e receber resposta
app.post('/api/chat', async (req, res) => {
  try {
    const { conversationId, userMessage } = req.body;
    let newConversationId = conversationId;

    // Se não existir conversationId, cria um novo e insere o prompt de sistema
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

    // Inserir mensagem do usuário
    await pool.query(
      `INSERT INTO conversas (conversation_id, role, message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [newConversationId, 'user', userMessage]
    );

    // Buscar todo o histórico dessa conversa
    const [rows] = await pool.query(
      `SELECT role, message FROM conversas WHERE conversation_id = ? ORDER BY id ASC`,
      [newConversationId]
    );

    // Converter para o formato esperado pela OpenAI
    const messages = rows.map(row => ({
      role: row.role,
      content: row.message,
    }));

    // Chamar a API da OpenAI
    const response = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages
    });

    // Extrair resposta do assistente
    const assistantMessage = response.data.choices[0].message.content;

    // Salvar resposta no banco
    await pool.query(
      `INSERT INTO conversas (conversation_id, role, message, created_at)
       VALUES (?, ?, ?, NOW())`,
      [newConversationId, 'assistant', assistantMessage]
    );

    // Retornar para o front-end
    res.json({
      conversationId: newConversationId,
      assistantMessage
    });
  } catch (error) {
    // Logar o erro para ver no console o que está acontecendo
    console.error('Erro na rota /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
