# Backend - Artigianato Online

Ecco una documentazione completa degli endpoint API disponibili nel backend.

## Indice
- [Installazione](#installazione)
- [Sviluppo](#sviluppo)
- [API Endpoints](#api-endpoints)
    - [Autenticazione](#autenticazione)
    - [Utenti](#utenti)
    - [Categorie](#categorie)
    - [Prodotti](#prodotti)
    - [Ordini](#ordini)
    - [Pagamenti](#pagamenti)
- [Database](#database)

## Installazione
Installare dipendenze:
```bash
npm install
```

Avvio:
```bash
npm start
```

Rinominare il file `.env.example` in `.env` e configurare le variabili di ambiente necessarie.

NOTA: Tramite `docker compose up -d` o `docker-compose up -d` e `sudo` ove necessario (dal deployment branch) l'installazione non è necessaria. Per testing e development locale si può usare il file `.env` per configurare le variabili di ambiente e i comandi menzionati.

### Creazione Database:
Installare dipendenze:
```bash
npm install
```

Avviare script:
```bash
node run setup-db
```

### Inizializzazione Database con valori di base
Installare dipendenze:
```bash
npm install
```

Avvio seed:
```bash
npm run seed
```
NB: Eseguire una sola e singola volta, altrimenti si potrebbero creare duplicati e/o errori.


## Sviluppo
Installare dipendenze:
```bash
npm install
```

Avvio server in development:
```bash
npm run dev
```

### Testing
Installare dipendenze:
```bash
npm install
```

```bash
npm run test
```

### Reset Database
Ripulire il database (lasciare solamente le tabelle vuote):
```bash
npm install
```

```bash
npm run clear
```

## API Endpoints

### Autenticazione
| Metodo | Endpoint | Descrizione | Accesso  |
|--------|----------|-------------|----------|
| `POST` | `/api/auth/register` | Registrazione nuovo utente | Pubblico |
| `POST` | `/api/auth/login` | Login con credenziali | Pubblico |

### Utenti
| Metodo | Endpoint | Descrizione | Accesso |
|--------|----------|-------------|---------|
| `GET` | `/api/users` | Lista di tutti gli utenti | Admin |
| `GET` | `/api/users/:id` | Dettagli di un utente specifico | Admin o utente stesso |
| `PUT` | `/api/users/:id` | Aggiorna profilo utente | Admin o utente stesso |

### Categorie
| Metodo | Endpoint | Descrizione | Accesso |
|--------|----------|-------------|---------|
| `GET` | `/api/categories` | Lista categorie | Pubblico |
| `GET` | `/api/categories/:id` | Dettagli categoria | Pubblico |
| `POST` | `/api/categories` | Crea nuova categoria | Admin |
| `PUT` | `/api/categories/:id` | Aggiorna categoria | Admin |
| `DELETE` | `/api/categories/:id` | Disattiva categoria | Admin |

### Prodotti
| Metodo | Endpoint | Descrizione | Accesso |
|--------|----------|-------------|---------|
| `GET` | `/api/products` | Lista prodotti attivi con filtri | Pubblico |
| `GET` | `/api/products/:id` | Dettagli singolo prodotto | Pubblico |
| `POST` | `/api/products` | Crea nuovo prodotto | Artigiano |
| `PUT` | `/api/products/:id` | Aggiorna prodotto | Admin o Artigiano proprietario |
| `DELETE` | `/api/products/:id` | Disattiva prodotto | Admin o Artigiano proprietario |

### Ordini
| Metodo | Endpoint | Descrizione | Accesso |
|--------|----------|-------------|---------|
| `GET` | `/api/orders` | Lista ordini | Cliente (propri), Admin (tutti), Artigiano (propri) |
| `GET` | `/api/orders/:id` | Dettagli ordine | Cliente (propri), Admin (tutti), Artigiano (coinvolto) |
| `POST` | `/api/orders` | Crea nuovo ordine | Cliente |
| `PATCH` | `/api/orders/:id/status` | Aggiorna stato ordine | Cliente (solo cancel), Admin (tutti gli stati) |

### Pagamenti
| Metodo | Endpoint | Descrizione | Accesso |
|--------|----------|-------------|---------|
| `GET` | `/api/payments` | Lista pagamenti con filtri | Admin |
| `GET` | `/api/payments/:id` | Dettagli singolo pagamento | Admin |
| `GET` | `/api/payments/order/:order_id` | Pagamento di un ordine specifico | Admin o Cliente proprietario |
| `POST` | `/api/payments` | Registra pagamento per ordine | Admin |


# Database

PostgreSQL:
```SQL
-- Tabelle --

-- Utenti
CREATE TABLE users (
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
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prodotti
CREATE TABLE products (
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
CREATE TABLE orders (
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
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit NUMERIC(10, 2) NOT NULL CHECK (price_per_unit >= 0),
    artisan_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_order_product UNIQUE (order_id, product_id)
);

-- Pagamenti
CREATE TABLE payments (
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

-- Triggers per aggiornare updated_at
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_categories
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_products
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_orders
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_payments
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
```