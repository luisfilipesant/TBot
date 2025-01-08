import express from 'express';
import axios from 'axios';

// Inicializa o app Express
const app = express();
app.use(express.json());

// Lê a chave da API a partir das variáveis de ambiente
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Se a chave não estiver definida, encerra o processo
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY não definida. Defina a variável de ambiente e rode novamente.');
  process.exit(1);
}

// Rota para receber mensagens do bot
app.post('/respond', async (req, res) => {
  const { prompt } = req.body;
  console.log('📩 Prompt recebido:', prompt);

  // Pega a última mensagem do usuário
  const userMessage = prompt?.messages?.[0]?.content || 'Olá, tudo bem?';

  // Concatena o contexto com a mensagem do usuário
  const combinedText = `${prompt.context}\n\n${userMessage}`;

  // Monta o corpo da requisição para a API do Gemini
  const geminiRequestBody = {
    contents: [
      {
        parts: [
          { text: combinedText }
        ]
      }
    ]
  };

  try {
    // Faz a requisição para a API do Gemini
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      geminiRequestBody,
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('📤 Resposta da IA (Gemini):', response.data);

    // Extrai a resposta da IA
    const candidates = response.data.candidates || [];
    if (candidates.length === 0) {
      return res.json({ reply: 'Desculpe, não consegui gerar uma resposta.' });
    }

    let reply = '';
    if (candidates[0].content?.parts) {
      reply = candidates[0].content.parts.map(part => part.text).join(' ');
    } else {
      reply = candidates[0].content || 'Desculpe, não consegui gerar uma resposta.';
    }

    // Retorna a resposta para o bot
    res.json({ reply: reply.trim() });

  } catch (error) {
    console.error('❌ Erro ao conectar com a API do Gemini:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Erro ao conectar com a API do Gemini' });
  }
});

// Inicializa o servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
