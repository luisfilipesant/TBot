import puppeteer from 'puppeteer';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js'; // Se seu database.js também for ESM. 
                               // Se não, ver abaixo**

// Para recriar __dirname no ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    const browserOptions = {
        headless: false,
        userDataDir: path.join(__dirname, 'user_data'),
    };

    // Inicia o Puppeteer
    const browser = await puppeteer.launch(browserOptions);
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Acessa Tinder
    await page.goto('https://tinder.com');

    // Verifica se já está logado
    try {
        await page.waitForSelector('a[href="/app/recs"]', { timeout: 10000 });
        console.log('✅ Sessão ativa. Pronto para continuar!');
    } catch (err) {
        console.log('🔐 Sessão não ativa. Faça login manualmente.');
        return;
    }

    // Vai para a página de matches
    console.log('➡️ Redirecionando para a página de matches...');
    await page.goto('https://tinder.com/app/matches');

    // Array de mensagens iniciais (18 variações):
    const initialGreetings = [
        "Oi, tudo bem? Achei seu perfil encantador!",
        "E aí, tudo bom? Vi seu perfil e me interessei bastante.",
        "Olá! Como vai esse dia? Adoraria te conhecer melhor.",
        "Oi, tudo bem? Seu perfil me chamou muita atenção.",
        "Heeey, tudo tranquilo? Me conta mais sobre você!",
        "Oi, linda! Tudo certinho por aí? Adoro gente que topa um bom papo.",
        "Oi, tudo bem? Gosto de gente bem-humorada, você parece ser!",
        "Oi! Tudo legal? Achei seu estilo super bacana.",
        "Olá, tudo bem? Sou Bruno e achei interessante te conhecer.",
        "Oi, tudo bem? Me animei vendo seu perfil, topa conversar?",
        "Oi, tudo certo? Estou curioso para saber mais sobre você!",
        "Olá, tudo bem? Me impressionei com seu perfil.",
        "Oi, tudo tranquilo? Vi que temos algumas coisas em comum.",
        "Oi, tudo bem? Parece que temos gostos parecidos.",
        "Olá! Como anda esse dia? Tenho a sensação de que podemos nos dar bem.",
        "Oi, tudo bem? Fiquei bem interessado na sua vibe.",
        "E aí, tudo certo? Adoro conhecer gente nova e você me parece incrível.",
        "Oi, tudo bem? Curti seu estilo, vamos trocar umas ideias?"
    ];

    // Função que verifica mensagens não respondidas continuamente
    const checkForNewMessages = async () => {
        while (true) {
            // Coleta links de chats
            const chatLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[href*="/app/messages/"]'))
                    .map(link => link.href);
            });

            console.log(`📩 Chats encontrados: ${chatLinks.length}`);

            for (const chatLink of chatLinks) {
                console.log(`➡️ Abrindo chat: ${chatLink}`);
                await page.goto(chatLink);

                // Espera até 6s para carregar
                await new Promise(resolve => setTimeout(resolve, 6000));

                // Coleta todas as mensagens
                const messagesAll = await page.evaluate(() => {
                    const msgEls = Array.from(document.querySelectorAll('.msg'));
                    return msgEls.map(el => {
                        const content = el.innerText.trim();
                        const isReceived = el.classList.contains('msg--received');
                        return { content, isReceived };
                    });
                });

                // Se não houver mensagens, manda mensagem inicial
                if (messagesAll.length === 0) {
                    console.log('⚠️ Chat vazio. Iniciando conversa...');

                    // Saudação aleatória
                    const randomIndex = Math.floor(Math.random() * initialGreetings.length);
                    const initMsg = initialGreetings[randomIndex];

                    try {
                        await page.waitForSelector('textarea', { timeout: 5000 });
                        await page.type('textarea', initMsg);
                        await page.keyboard.press('Enter');
                        console.log(`✅ Mensagem inicial enviada: ${initMsg}`);
                    } catch (err) {
                        console.log('❌ Não foi possível encontrar o textarea. Pulando este chat.');
                    }
                    continue;
                }

                // Verifica a última mensagem (se foi recebida ou enviada)
                const lastMessage = messagesAll[messagesAll.length - 1];
                if (!lastMessage.isReceived) {
                    console.log('🟢 Última mensagem foi sua (ou do bot). Pulando o chat.');
                    continue;
                }

                console.log(`✉️ Última mensagem recebida: ${lastMessage.content}`);

                // Verifica se já respondemos essa mensagem
                const isAlreadyResponded = await new Promise((resolve, reject) => {
                    db.get(
                        'SELECT * FROM messages WHERE message = ?',
                        [lastMessage.content],
                        (err, row) => {
                            if (err) reject(err);
                            resolve(!!row);
                        }
                    );
                });

                if (isAlreadyResponded) {
                    console.log('🟢 Mensagem já respondida anteriormente. Pulando o chat.');
                    continue;
                }

                // Pega as últimas 8 mensagens
                const lastEight = messagesAll.slice(-8);

                // Monta o array de messages
                const promptMessages = lastEight.map(msg => ({
                    author: msg.isReceived ? "user" : "bot",
                    content: msg.content,
                }));

                // Monta o corpo do /respond
                const promptPayload = {
                    prompt: {
                        context: `
                            Você se chama Bruno, um homem de 30 anos,
                            mora no Prado (Belo Horizonte),
                            trabalha como contador,
                            é bem-humorado, romântico e mora sozinho.
                            evite perguntar "oi tudo bem?" ou "como você está?"

                            Gosta de vários estilos musicais, mas não de funk.
                            Adora viajar, principalmente para o Nordeste.

                            Sempre se refira a si mesmo no masculino.
                            Trate a outra pessoa (a usuária) sempre no feminino.

                            Faça respostas curtas e naturais, sem falar demais.
                            Busque ser humano e autêntico, com viés de flerte.
                            Se não souber o que responder, invente algo para conquistá-la
                            de maneira agradável e respeitosa.

                            evite usar emojis demais, use em situações muito específicas.
                            evite pedir o número de telefone ou marcar encontros.
                            evite falar que eu moro no prado ou em BH ou em Minas.
                            se a pessoa falar que é do RS ou qualquer cidade de lá, fale que eu sou de lá também.
                            tente sempre que a pessoa fale onde ela mora primeiro, para descobrir se é de BH ou não.
                            se a pessoa falar que é de BH, fale que eu sou de lá também, no Prado e etc.
                            meu instagram é: brunodiegolins.
                            tente render as conversas, mas sem perguntar o tempo todo.
                            Considere cuidadosamente todo o histórico de mensagens (onde author: 'bot' é você e author: 'user' é ela) para dar uma resposta coerente e consistente com o que foi dito anteriormente.
                            analise as mensagens anteriores para entender o contexto e responder de forma coerente.
                        `,
                        messages: promptMessages
                    }
                };

                try {
                    // Chama o servidor local (server.js) que fala com a IA
                    const response = await axios.post(
                        'http://localhost:3000/respond',
                        promptPayload,
                        { headers: { 'Content-Type': 'application/json' } }
                    );

                    const reply = response.data.reply;
                    console.log(`💬 Resposta gerada: ${reply}`);

                    // Tenta encontrar o textarea e digitar a resposta
                    try {
                        await page.waitForSelector('textarea', { timeout: 5000 });
                        await page.type('textarea', reply);
                        await page.keyboard.press('Enter');
                        console.log('✅ Resposta enviada.');
                    } catch (err) {
                        console.log('❌ Não foi possível encontrar o textarea ao responder. Pulando este chat.');
                        continue;
                    }

                    // Salva no DB local que esta mensagem foi respondida
                    db.run('INSERT INTO messages (message) VALUES (?)', [lastMessage.content]);

                } catch (error) {
                    console.error('❌ Erro ao conectar com a API:', error);
                }
            }

            // Ao finalizar todos os chats, aguarda 5 min e recomeça
            console.log('⏳ Nenhuma nova mensagem (ou todas respondidas). Aguardando 5 minutos...');
            await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        }
    };

    await checkForNewMessages();

    // Se der CTRL+C, deixa o navegador aberto
    process.on('SIGINT', async () => {
        console.log('🛑 Bot interrompido. O navegador permanecerá aberto.');
        await browser.disconnect();
    });
})();
