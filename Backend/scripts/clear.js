// Backend/scripts/clear.js
import db from '../db/database.js';
import { config } from 'dotenv';

// .env
config();

const tablesToClear = [
    'payments',
    'order_items',
    'orders',
    'products',
    'categories',
    'users'
];

async function clearDatabase() {
    console.log(`Connesso al database "${process.env.DB_NAME}" per la pulizia...`);

    try {
        console.log('Inizio transazione.');

        const truncateQuery = `TRUNCATE ${tablesToClear.join(', ')} RESTART IDENTITY CASCADE;`;

        console.log(`Esecuzione query: ${truncateQuery}`);

        await db.query(truncateQuery);

        console.log(`Tabelle ${tablesToClear.join(', ')} svuotate con successo.`);


        console.log('Transazione completata con successo (COMMIT). Database pulito.');

    } catch (error) {
        console.error('Errore durante la pulizia del database, rollback della transazione:', error);
        throw error;
    } finally {
        console.log('Client chiuso.');
    }
}

clearDatabase().catch(error => {
    console.error("Impossibile completare la pulizia del database:", error);
    process.exit(1);
});