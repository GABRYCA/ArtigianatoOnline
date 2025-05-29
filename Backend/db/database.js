import pkg from 'pg';
const { Pool } = pkg;
import { config } from 'dotenv';

config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
  ssl: process.env.SSL_ENABLED === 'true' ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
  if (err) return console.error(`Errore durante la connessione al database "${process.env.DB_NAME}":`, err.stack);
  console.log(`Connesso con successo al database: "${process.env.DB_NAME}"`);
  release();
});

export default {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};