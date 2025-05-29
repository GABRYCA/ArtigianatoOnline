CREATE TABLE IF NOT EXISTS users
(
    user_id          SERIAL PRIMARY KEY,
    role             VARCHAR(10)  NOT NULL CHECK (role IN ('artigiano', 'cliente', 'admin')),
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255) NOT NULL,
    full_name        VARCHAR(150),
    shop_name        VARCHAR(150),
    shop_description TEXT,
    address          TEXT,
    phone_number     VARCHAR(30),
    is_active        BOOLEAN                  DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories
(
    category_id        SERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL UNIQUE,
    description        TEXT,
    parent_category_id INTEGER      REFERENCES categories (category_id) ON DELETE SET NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products
(
    product_id     SERIAL PRIMARY KEY,
    artisan_id     INTEGER        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    category_id    INTEGER        REFERENCES categories (category_id) ON DELETE SET NULL,
    sku            VARCHAR(100) UNIQUE,
    name           VARCHAR(255)   NOT NULL,
    description    TEXT,
    price          NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER        NOT NULL  DEFAULT 0 CHECK (stock_quantity >= 0),
    image_url      VARCHAR(500),
    is_active      BOOLEAN                  DEFAULT TRUE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders
(
    order_id         SERIAL PRIMARY KEY,
    customer_id      INTEGER        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT,
    order_date       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status           VARCHAR(20)    NOT NULL CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered',
                                                               'cancelled', 'refunded')),
    total_amount     NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    shipping_address TEXT           NOT NULL,
    billing_address  TEXT,
    shipping_method  VARCHAR(100),
    tracking_number  VARCHAR(100),
    notes            TEXT,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items
(
    order_item_id  SERIAL PRIMARY KEY,
    order_id       INTEGER        NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
    product_id     INTEGER        NOT NULL REFERENCES products (product_id) ON DELETE RESTRICT,
    quantity       INTEGER        NOT NULL CHECK (quantity > 0),
    price_per_unit NUMERIC(10, 2) NOT NULL CHECK (price_per_unit >= 0),
    artisan_id     INTEGER        NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT, -- Aggiunto per riferimento diretto
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_order_product UNIQUE (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS payments
(
    payment_id     SERIAL PRIMARY KEY,
    order_id       INTEGER        NOT NULL UNIQUE REFERENCES orders (order_id) ON DELETE CASCADE,
    payment_date   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    amount         NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(50)    NOT NULL CHECK (payment_method IN ('credit_card', 'paypal', 'bank_transfer', 'other')),
    transaction_id VARCHAR(255) UNIQUE,
    status         VARCHAR(20)    NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Triggers
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_users') THEN
            CREATE TRIGGER set_timestamp_users
                BEFORE UPDATE
                ON users
                FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_categories') THEN
            CREATE TRIGGER set_timestamp_categories
                BEFORE UPDATE
                ON categories
                FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_products') THEN
            CREATE TRIGGER set_timestamp_products
                BEFORE UPDATE
                ON products
                FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_orders') THEN
            CREATE TRIGGER set_timestamp_orders
                BEFORE UPDATE
                ON orders
                FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_payments') THEN
            CREATE TRIGGER set_timestamp_payments
                BEFORE UPDATE
                ON payments
                FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        END IF;
    END
$$;

\echo '****** Schema database artigianato_db creato con successo ******'