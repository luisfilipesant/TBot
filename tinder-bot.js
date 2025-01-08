import puppeteer from 'puppeteer';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

// Recria __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    const browserOptions = {
        headless: false,
        userDataDir: path.join(__dirname, 'user_data'),
    };

    const browser = await puppeteer.launch(browserOptions);
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Acessa Tinder
    await page.goto('https://tinder.com');

    // Verifica se está logado
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
    await new Promise(resolve => setTimeout(resolve, 5000)); // Espera 5 segundos

    let autoSwipe = false; // Auto-Swipe desativado por padrão

    // Array de mensagens iniciais
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

    // Função principal de verificação de mensagens
    const checkForNewMessages = async () => {
        while (true) {
            if (autoSwipe) {
                console.log('🔄 Modo Auto-Swipe ativado. Curtindo perfis...');
                await swipeProfiles(page);
            } else {
                console.log('📩 Verificando novas mensagens...');
                await checkMessages(page);
            }

            console.log('⏳ Aguardando 2 minutos para checar novamente...');
            for (let i = 0; i < 120; i++) {
                if (!autoSwipe && i === 105) {
                    console.log('⏳ Voltando para a página de mensagens...');
                    await page.goto('https://tinder.com/app/matches');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    };

    // Função de curtir perfis
    const swipeProfiles = async (page) => {
        await page.goto('https://tinder.com/app/recs');
        await new Promise(resolve => setTimeout(resolve, 4000)); // Espera 4 segundos para a página carregar

        while (autoSwipe) {
            try {
                // Usa o seletor fornecido para encontrar o botão de curtir
                const likeButton = await page.$('#q2098069830 > div > div.App__body.H\\(100\\%\\).Pos\\(r\\).Z\\(0\\) > div > div > div > main > div > div > div > div > div.Pos\\(a\\).B\\(0\\).Iso\\(i\\).W\\(100\\%\\).Start\\(0\\).End\\(0\\).TranslateY\\(55\\%\\) > div > div:nth-child(4) > button');
                if (likeButton) {
                    await likeButton.click();
                    console.log('💚 Perfil curtido!');
                } else {
                    console.log('⚠️ Botão de curtir não encontrado.');
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 4000)); // Pausa de 4 segundos entre likes
            } catch (err) {
                console.log('⚠️ Não há mais perfis para curtir ou ocorreu um erro.');
                break;
            }
        }
    };

    // Função de verificação de mensagens
    const checkMessages = async (page) => {
        const chatLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*="/app/messages/"]'))
                .map(link => link.href);
        });

        console.log(`📩 Chats encontrados: ${chatLinks.length}`);

        for (const chatLink of chatLinks) {
            console.log(`➡️ Abrindo chat: ${chatLink}`);
            await page.goto(chatLink);
            await new Promise(resolve => setTimeout(resolve, 6000));

            const messagesAll = await page.evaluate(() => {
                const msgEls = Array.from(document.querySelectorAll('.msg'));
                return msgEls.map(el => {
                    const content = el.innerText.trim();
                    const isReceived = el.classList.contains('msg--received');
                    return { content, isReceived };
                });
            });

            if (messagesAll.length === 0) {
                console.log('⚠️ Chat vazio. Iniciando conversa...');
                const randomIndex = Math.floor(Math.random() * initialGreetings.length);
                const initMsg = initialGreetings[randomIndex];
                await page.type('textarea', initMsg);
                await page.keyboard.press('Enter');
                console.log(`✅ Mensagem inicial enviada: ${initMsg}`);
                continue;
            }

            const lastMessage = messagesAll[messagesAll.length - 1];
            if (!lastMessage.isReceived) {
                console.log('🟢 Última mensagem foi sua (ou do bot). Pulando o chat.');
                continue;
            }

            console.log(`✉️ Última mensagem recebida: ${lastMessage.content}`);

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

            const lastEight = messagesAll.slice(-8);
            const promptMessages = lastEight.map(msg => ({
                author: msg.isReceived ? "user" : "bot",
                content: msg.content,
            }));

            const promptPayload = {
                prompt: {
                    context: 'Você se chama Bruno, um homem de 30 anos, etc...',
                    messages: promptMessages
                }
            };

            try {
                const response = await axios.post('http://localhost:3000/respond', promptPayload, { headers: { 'Content-Type': 'application/json' } });
                const reply = response.data.reply;
                console.log(`💬 Resposta gerada: ${reply}`);
                await page.type('textarea', reply);
                await page.keyboard.press('Enter');
                console.log('✅ Resposta enviada.');

                db.run('INSERT INTO messages (message) VALUES (?)', [lastMessage.content]);
            } catch (error) {
                console.error('❌ Erro ao conectar com a API:', error);
            }
        }
    };

    // Listener para alternar entre modos
    process.stdin.on('data', (key) => {
        if (key.toString().trim() === 'AA') {
            autoSwipe = !autoSwipe;
            console.log(`🔄 Modo Auto-Swipe ${autoSwipe ? 'ativado' : 'desativado'}.`);
        }
    });

    await checkForNewMessages();

    process.on('SIGINT', async () => {
        console.log('🛑 Bot interrompido. O navegador permanecerá aberto.');
        await browser.disconnect();
    });
})();
