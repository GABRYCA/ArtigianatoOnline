# Database - Artigianato Online

> Database PostgreSQL per la piattaforma di e-commerce artigianale, configurato automaticamente via Docker.

## Indice

- [Schema Database](#️schema-database)
- [Struttura Tabelle](#struttura-tabelle)
- [Funzioni e Trigger](#funzioni-e-trigger)

---

## Schema Database

Il database è progettato per supportare un marketplace di prodotti artigianali con le seguenti entità principali:

![Schema DB](img/schema.png)

> **Nota:** Il database viene configurato automaticamente al primo avvio tramite Docker Compose.

---

## Struttura Tabelle

### Tabella `users`
Gestisce tutti gli utenti del sistema (artigiani, clienti, admin).

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `user_id` | SERIAL | Chiave primaria |
| `role` | VARCHAR(10) | Ruolo: 'artigiano', 'cliente', 'admin' |
| `email` | VARCHAR(255) | Email univoca |
| `password_hash` | VARCHAR(255) | Password hashata |
| `full_name` | VARCHAR(150) | Nome completo |
| `shop_name` | VARCHAR(150) | Nome negozio (artigiani) |
| `shop_description` | TEXT | Descrizione negozio |
| `address` | TEXT | Indirizzo |
| `phone_number` | VARCHAR(30) | Numero di telefono |
| `is_active` | BOOLEAN | Account attivo |

### Tabella `categories`
Gestisce le categorie di prodotti con supporto per sottocategorie.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `category_id` | SERIAL | Chiave primaria |
| `name` | VARCHAR(100) | Nome categoria (univoco) |
| `description` | TEXT | Descrizione categoria |
| `parent_category_id` | INTEGER | Riferimento alla categoria padre |

### Tabella `products`
Contiene tutti i prodotti disponibili sulla piattaforma.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `product_id` | SERIAL | Chiave primaria |
| `artisan_id` | INTEGER | Riferimento all'artigiano |
| `category_id` | INTEGER | Riferimento alla categoria |
| `sku` | VARCHAR(100) | Codice prodotto univoco |
| `name` | VARCHAR(255) | Nome prodotto |
| `description` | TEXT | Descrizione dettagliata |
| `price` | NUMERIC(10,2) | Prezzo (≥ 0) |
| `stock_quantity` | INTEGER | Quantità disponibile |
| `image_url` | VARCHAR(500) | URL immagine prodotto |
| `is_active` | BOOLEAN | Prodotto attivo |

### Tabella `orders`
Gestisce gli ordini dei clienti.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `order_id` | SERIAL | Chiave primaria |
| `customer_id` | INTEGER | Riferimento al cliente |
| `order_date` | TIMESTAMP | Data ordine |
| `status` | VARCHAR(20) | Stato: 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded' |
| `total_amount` | NUMERIC(12,2) | Importo totale |
| `shipping_address` | TEXT | Indirizzo di spedizione |
| `billing_address` | TEXT | Indirizzo di fatturazione |
| `shipping_method` | VARCHAR(100) | Metodo di spedizione |
| `tracking_number` | VARCHAR(100) | Numero di tracking |
| `notes` | TEXT | Note aggiuntive |

### Tabella `order_items`
Dettagli degli articoli per ogni ordine.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `order_item_id` | SERIAL | Chiave primaria |
| `order_id` | INTEGER | Riferimento all'ordine |
| `product_id` | INTEGER | Riferimento al prodotto |
| `quantity` | INTEGER | Quantità ordinata (> 0) |
| `price_per_unit` | NUMERIC(10,2) | Prezzo unitario |
| `artisan_id` | INTEGER | Riferimento all'artigiano |

### Tabella `payments`
Gestisce i pagamenti degli ordini.

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `payment_id` | SERIAL | Chiave primaria |
| `order_id` | INTEGER | Riferimento all'ordine (univoco) |
| `payment_date` | TIMESTAMP | Data pagamento |
| `amount` | NUMERIC(12,2) | Importo pagamento |
| `payment_method` | VARCHAR(50) | Metodo: 'credit_card', 'paypal', 'bank_transfer', 'other' |
| `transaction_id` | VARCHAR(255) | ID transazione (univoco) |
| `status` | VARCHAR(20) | Stato: 'pending', 'completed', 'failed', 'refunded' |

---

## Funzioni e Trigger

### Funzione per Timestamp Automatico

```sql
-- Funzione per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Trigger per Aggiornamento Automatico

I seguenti trigger aggiornano automaticamente il campo `updated_at`:

- `set_timestamp_users` - Tabella users
- `set_timestamp_categories` - Tabella categories
- `set_timestamp_products` - Tabella products
- `set_timestamp_orders` - Tabella orders
- `set_timestamp_payments` - Tabella payments

---

## Script Creazione Database

<details>
<summary><strong> Clicca per visualizzare lo script completo</strong></summary>

```sql
-- ================================
-- SCRIPT CREAZIONE DATABASE
-- Artigianato Online
-- ================================

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

</details>