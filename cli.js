#!/usr/bin/env node
import inquirer from 'inquirer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Carrega variáveis do .env
dotenv.config();

// Caminhos corrigidos
const serverPath = path.resolve('./server.js');
const botPath = path.resolve('./tinder-bot.js');
const userDataPath = path.resolve('./user_data'); // Pasta de sessão do navegador

// Função para gerenciar a sessão do navegador
async function manageUserData() {
  // Verifica se a pasta `user_data` existe
  if (fs.existsSync(userDataPath)) {
    const { clearSession } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'clearSession',
        message: 'Deseja iniciar uma nova sessão (remover login salvo)?',
        default: false,
      },
    ]);

    if (clearSession) {
      fs.rmSync(userDataPath, { recursive: true, force: true });
      console.log('🧹 Sessão apagada. Você precisará fazer login novamente.\n');
    } else {
      console.log('✅ Sessão existente mantida. Continuando...\n');
    }
  } else {
    console.log('⚠️ Nenhuma sessão existente encontrada. Um novo login será necessário.\n');
  }
}

// Função principal do CLI
async function runCLI() {
  console.log('Bem-vindo(a) ao Tinder Bot!\n');

  // Gerenciar sessão do navegador
  await manageUserData();

  // Carrega variáveis antigas
  let currentKey = process.env.GEMINI_API_KEY || '';
  let currentPrompt = process.env.BOT_PROMPT || 'Você é Bruno, etc...';

  // Pergunta se deseja alterar configurações
  const { changeSettings } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'changeSettings',
      message: 'Deseja alterar as configurações (API Key / Prompt)?',
      default: true,
    },
  ]);

  // Configurações personalizadas
  if (changeSettings) {
    const configAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: 'Digite sua chave de API (PaLM/Gemini/Bison):',
        default: currentKey,
      },
      {
        type: 'editor',
        name: 'botPrompt',
        message: 'Edite o prompt do bot:',
        default: currentPrompt,
      },
    ]);

    // Atualiza as variáveis
    currentKey = configAnswers.apiKey || '';
    currentPrompt = configAnswers.botPrompt || '';

    // Salva no .env
    const newEnvContent = `GEMINI_API_KEY=${currentKey}\nBOT_PROMPT=${JSON.stringify(currentPrompt)}\n`;
    fs.writeFileSync('.env', newEnvContent);
    console.log('Configurações salvas com sucesso!\n');
  }

  // Inicia o servidor
  console.log('Iniciando servidor local...\n');
  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
  });

  // Aguarda o servidor antes de iniciar o bot
  setTimeout(() => {
    console.log('Iniciando Tinder-bot...\n');
    const botProcess = spawn('node', [botPath], {
      stdio: 'inherit',
    });

    // Finaliza o servidor quando o bot for encerrado
    botProcess.on('close', (code) => {
      console.log(`Bot finalizado com código: ${code}`);
      serverProcess.kill();
    });
  }, 3000);
}

runCLI();
