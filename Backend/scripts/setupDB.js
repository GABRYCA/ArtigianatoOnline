import pkg from 'pg';

const {Client} = pkg;
import {config} from 'dotenv';

// .env
config();

// SQL
const createSchemaSql = `
-- Utenti
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    role VARCHAR(10) NOT NULL CHECK (role IN ('artigiano', 'cliente', 'admin')),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    shop_name VARCHAR(150),
    shop_description TEXT,
    address TEXT,
    phone_number VARCHAR(30),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categorie Prodotti
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prodotti
CREATE TABLE IF NOT EXISTS products (
    product_id SERIAL PRIMARY KEY,
    artisan_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
    sku VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ordini
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    shipping_address TEXT NOT NULL,
    billing_address TEXT,
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Elementi Ordine
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit NUMERIC(10, 2) NOT NULL CHECK (price_per_unit >= 0),
    artisan_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT, -- Aggiunto per riferimento diretto
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_order_product UNIQUE (order_id, product_id)
);

-- Pagamenti
CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('credit_card', 'paypal', 'bank_transfer', 'other')),
    transaction_id VARCHAR(255) UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Funzioni --

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Triggers --
-- Nota: I trigger vengono creati solo se la tabella esiste.
-- Usiamo DROP TRIGGER IF EXISTS per renderlo rieseguibile

DROP TRIGGER IF EXISTS set_timestamp_users ON users;
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_categories ON categories;
CREATE TRIGGER set_timestamp_categories
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_products ON products;
CREATE TRIGGER set_timestamp_products
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_orders ON orders;
CREATE TRIGGER set_timestamp_orders
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_payments ON payments;
CREATE TRIGGER set_timestamp_payments
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Riabilita i vincoli se erano stati disabilitati
-- SET session_replication_role = DEFAULT;
`;


async function setupDatabase() {
    const dbName = process.env.DB_NAME;
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT;
    const useSsl = process.env.SSL_ENABLED === 'true' ? {rejectUnauthorized: false} : false;

    // Validazione
    if (!dbName || !dbUser || !dbPassword || !dbHost || !dbPort) {
        console.error('Errore: Assicurati che le variabili d\'ambiente DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, PORT siano impostate nel file .env.');
        process.exit(1);
    }
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
        console.error(`Errore: Il nome del database "${dbName}" contiene caratteri non validi. Usa solo lettere, numeri e underscore.`);
        process.exit(1);
    }

    let maintenanceClient;
    let appDbClient;

    try {
        // Creazione (Partendo da DB postgres)
        console.log(`Fase 1: Tentativo di connessione al server PostgreSQL (db: postgres)`);
        maintenanceClient = new Client({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            database: 'postgres',
            ssl: useSsl
        });
        await maintenanceClient.connect();
        console.log('Connesso al database (postgres).');

        console.log(`Verifica esistenza database "${dbName}"...`);
        const checkResult = await maintenanceClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

        if (checkResult.rowCount === 0) {
            console.log(`Database "${dbName}" non trovato. Creazione in corso...`);
            await maintenanceClient.query(`CREATE DATABASE "${dbName}"`);
            console.log(`Database "${dbName}" creato con successo.`);
        } else {
            console.log(`Il database "${dbName}" esiste già.`);
        }

        console.log('Chiusura connessione al database (postgres).');
        await maintenanceClient.end();
        maintenanceClient = null;

        // Creazione (production)
        console.log(`\nFase 2: Tentativo di connessione al nuovo database "${dbName}"`);
        appDbClient = new Client({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            database: dbName,
            ssl: useSsl
        });
        await appDbClient.connect();
        console.log(`Connesso con successo al database "${dbName}".`);

        console.log('Esecuzione script per creare/aggiornare tabelle, funzioni e trigger...');
        await appDbClient.query(createSchemaSql);
        console.log('Schema del database creato/aggiornato con successo.');


        console.log('\nSetup del database completato con successo!');

    } catch (error) {
        console.error('\n--- ERRORE DURANTE IL SETUP DEL DATABASE ---');
        if (maintenanceClient) {
            console.error('Errore avvenuto durante la Fase 1 (Creazione DB):', error.message);
        } else if (appDbClient) {
            console.error(`Errore avvenuto durante la Fase 2 (Creazione Schema in ${dbName}):`, error.message);
        } else {
            console.error('Errore non specificato durante il setup:', error.message);
        }
        console.error("Dettagli Errore:", error);
        process.exitCode = 1;
    } finally {
        if (maintenanceClient) {
            try {
                await maintenanceClient.end();
                console.log('Connessione di manutenzione residua chiusa.');
            } catch (e) {
                console.error("Errore chiudendo client manutenzione residuo:", e)
            }
        }
        if (appDbClient) {
            try {
                await appDbClient.end();
                console.log(`Connessione al database "${dbName}" chiusa.`);
            } catch (e) {
                console.error(`Errore chiudendo client ${dbName}:`, e)
            }
        }
        console.log('Script terminato.');
    }
}

setupDatabase();