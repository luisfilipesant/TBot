import sqlite3Pkg from 'sqlite3';

// O 'verbose()' é um método do módulo 'sqlite3'
const sqlite3 = sqlite3Pkg.verbose();

// Conectar ao banco de dados
const db = new sqlite3.Database('./tinder-bot.db');

// Criar a tabela de mensagens se não existir
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_name TEXT,
            message TEXT
        );
    `);
});

// Export default para que possa ser importado com `import db from './database.js'`
export default db;
