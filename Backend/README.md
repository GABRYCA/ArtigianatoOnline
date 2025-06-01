# Backend - Artigianato Online

Backend API per la piattaforma di e-commerce dedicata all'artigianato italiano. Il sistema supporta tre tipologie di utenti (artigiani, clienti, admin) e gestisce prodotti, ordini e pagamenti con un'architettura RESTful robusta e scalabile.

## Indice
- [Architettura](#architettura)
- [Installazione](#installazione)
- [Sviluppo](#sviluppo)
- [Autenticazione e Autorizzazione](#autenticazione-e-autorizzazione)
- [API Endpoints](#api-endpoints)
- [Gestione Errori](#gestione-errori)
- [Testing](#testing)
- [Deployment](#deployment)

## Architettura

Il backend è costruito con **Node.js** e utilizza un'architettura RESTful con:
- **Database**: PostgreSQL per la persistenza dei dati
- **Autenticazione**: JWT (JSON Web Tokens)
- **Autorizzazione**: Controllo degli accessi basato sui ruoli
- **Validazione**: Middleware per la validazione degli input
- **Logging**: Sistema di logging per monitoraggio e debugging

### Struttura del Progetto
```
Backend/
├── db/
│   └── database.js          # Configurazione e connessione PostgreSQL
├── middleware/
│   └── auth.js             # Middleware autenticazione JWT
├── routes/
│   ├── auth.js             # Rotte autenticazione (login/register)
│   ├── categories.js       # Gestione categorie prodotti
│   ├── orders.js           # Gestione ordini e checkout
│   ├── payments.js         # Processamento pagamenti
│   ├── products.js         # CRUD prodotti artigianali
│   └── users.js            # Gestione profili utente
├── scripts/
│   ├── clear.js            # Script pulizia database
│   ├── seed.js             # Popolamento dati di esempio
│   └── setupDB.js          # Creazione schema database
├── tests/
│   ├── auth.test.js        # Test autenticazione
│   ├── categories.test.js  # Test gestione categorie
│   ├── orders.test.js      # Test sistema ordini
│   ├── payments.test.js    # Test pagamenti
│   ├── products.test.js    # Test gestione prodotti
│   ├── users.test.js       # Test gestione utenti
│   └── testUtils.js        # Utilities per testing
├── Dockerfile              # Containerizzazione Docker
├── entrypoint.sh           # Script avvio container
└── index.js                # Entry point applicazione
```

## Installazione

### Prerequisiti
- Node.js (versione 16 o superiore)
- PostgreSQL (versione 12 o superiore)
- npm o yarn

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

## Testing
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

### Comandi Disponibili
- `npm start` - Avvia il server in produzione
- `npm run dev` - Avvia il server in modalità sviluppo
- `npm run test` - Esegue i test disponibili
- `npm run setup-db` - Crea lo schema del database
- `npm run seed` - Popola il database con dati di esempio
- `npm run clear` - Pulisce il database (mantiene solo le tabelle vuote)

### Struttura Middleware
Il sistema utilizza diversi middleware per garantire sicurezza e funzionalità:
- **Autenticazione JWT**: Verifica la validità dei token
- **Autorizzazione ruoli**: Controlla i permessi basati sul ruolo utente
- **Validazione input**: Sanitizza e valida i dati in ingresso
- **CORS**: Gestisce le richieste cross-origin
- **Logging**: Registra tutte le operazioni per debugging

## Autenticazione e Autorizzazione

### Ruoli Utente
Il sistema supporta tre ruoli principali:

1. **Cliente (`cliente`)**
  - Navigazione e ricerca prodotti
  - Creazione e gestione ordini
  - Visualizzazione storico acquisti
  - Gestione profilo personale

2. **Artigiano (`artigiano`)**
  - Gestione catalogo prodotti (CRUD)
  - Visualizzazione ordini ricevuti
  - Aggiornamento stato ordini
  - Gestione profilo e shop

3. **Admin (`admin`)**
  - Accesso completo a tutte le funzionalità
  - Gestione utenti e ruoli
  - Gestione categorie
  - Supervisione ordini e pagamenti

### Flusso di Autenticazione
1. **Registrazione**: `POST /api/auth/register`
  - Validazione dati utente
  - Hash password con bcrypt
  - Creazione account con ruolo specificato

2. **Login**: `POST /api/auth/login`
  - Verifica credenziali
  - Generazione JWT token
  - Invio token + refresh token

3. **Autorizzazione**: Ogni richiesta protetta richiede:
   ```
   Authorization: Bearer <jwt_token>
   ```

4. **Refresh Token**: Rinnovo automatico token scaduti

### Sicurezza Implementata
- **Password Hashing**: bcrypt con salt rounds
- **JWT Signing**: Algoritmo HS256 con secret key
- **Input Sanitization**: Prevenzione SQL injection e XSS
- **CORS Configuration**: Controllo accessi cross-origin

## API Endpoints

### Autenticazione (`/api/auth`)

| Metodo | Endpoint | Descrizione | Payload Richiesto | Risposta |
|--------|----------|-------------|------------------|----------|
| `POST` | `/register` | Registrazione nuovo utente | `{email, password, full_name, role, shop_name?}` | `{token, user, refreshToken}` |
| `POST` | `/login` | Login con credenziali | `{email, password}` | `{token, user, refreshToken}` |
| `POST` | `/refresh` | Rinnovo token JWT | `{refreshToken}` | `{token, refreshToken}` |
| `POST` | `/logout` | Logout (invalidazione token) | - | `{message}` |

### Utenti (`/api/users`)

| Metodo | Endpoint | Descrizione | Accesso | Parametri/Filtri |
|--------|----------|-------------|---------|------------------|
| `GET` | `/` | Lista utenti | Admin | `?page=1&limit=10&role=cliente&search=nome` |
| `GET` | `/:id` | Dettagli utente | Admin, Utente stesso | - |
| `PUT` | `/:id` | Aggiorna profilo | Admin, Utente stesso | `{full_name, phone_number, address, shop_name?, shop_description?}` |
| `PATCH` | `/:id/status` | Attiva/disattiva utente | Admin | `{is_active: boolean}` |
| `DELETE` | `/:id` | Elimina utente (soft delete) | Admin | - |

### Categorie (`/api/categories`)

| Metodo | Endpoint | Descrizione | Accesso | Note |
|--------|----------|-------------|---------|------|
| `GET` | `/` | Lista categorie attive | Pubblico | Supporta struttura gerarchica |
| `GET` | `/:id` | Dettagli categoria | Pubblico | Include prodotti associati |
| `GET` | `/:id/products` | Prodotti per categoria | Pubblico | `?page=1&limit=12&sort=price_asc` |
| `POST` | `/` | Crea categoria | Admin | `{name, description, parent_category_id?}` |
| `PUT` | `/:id` | Aggiorna categoria | Admin | `{name, description, parent_category_id?}` |
| `DELETE` | `/:id` | Disattiva categoria | Admin | Soft delete |

### Prodotti (`/api/products`)

| Metodo | Endpoint | Descrizione | Accesso | Parametri Query |
|--------|----------|-------------|---------|-----------------|
| `GET` | `/` | Lista prodotti attivi | Pubblico | `?category=1&min_price=10&max_price=100&search=ceramica&page=1&limit=12&sort=price_asc` |
| `GET` | `/:id` | Dettagli prodotto | Pubblico | Include informazioni artigiano |
| `GET` | `/artisan/:artisan_id` | Prodotti di un artigiano | Pubblico | `?page=1&limit=12` |
| `POST` | `/` | Crea prodotto | Artigiano | `{name, description, price, category_id, stock_quantity, image_url?, sku?}` |
| `PUT` | `/:id` | Aggiorna prodotto | Admin, Artigiano proprietario | Stessi campi del POST |
| `PATCH` | `/:id/stock` | Aggiorna stock | Admin, Artigiano proprietario | `{stock_quantity}` |
| `PATCH` | `/:id/status` | Attiva/disattiva | Admin, Artigiano proprietario | `{is_active: boolean}` |
| `DELETE` | `/:id` | Elimina prodotto | Admin, Artigiano proprietario | Soft delete |

### Ordini (`/api/orders`)

| Metodo | Endpoint | Descrizione | Accesso | Note |
|--------|----------|-------------|---------|------|
| `GET` | `/` | Lista ordini | Cliente (propri), Admin (tutti), Artigiano (coinvolto) | `?status=pending&page=1&limit=10` |
| `GET` | `/:id` | Dettagli ordine | Cliente (proprio), Admin, Artigiano (coinvolto) | Include items e info pagamento |
| `GET` | `/customer/:customer_id` | Ordini cliente | Admin, Cliente stesso | Storico completo |
| `GET` | `/artisan/:artisan_id` | Ordini per artigiano | Admin, Artigiano stesso | Ordini ricevuti |
| `POST` | `/` | Crea ordine | Cliente | `{items: [{product_id, quantity}], shipping_address, billing_address?, notes?}` |
| `PATCH` | `/:id/status` | Aggiorna stato | Admin, Cliente (solo cancel) | `{status, tracking_number?, notes?}` |
| `DELETE` | `/:id` | Cancella ordine | Admin, Cliente (solo pending) | Solo ordini non pagati |

**Stati ordine supportati**: `pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`, `refunded`

### Pagamenti (`/api/payments`)

| Metodo | Endpoint | Descrizione | Accesso | Note |
|--------|----------|-------------|---------|------|
| `GET` | `/` | Lista pagamenti | Admin | `?status=completed&method=credit_card&page=1` |
| `GET` | `/:id` | Dettagli pagamento | Admin | Include dettagli transazione |
| `GET` | `/order/:order_id` | Pagamento per ordine | Admin, Cliente proprietario | - |
| `POST` | `/` | Registra pagamento | Admin, Sistema | `{order_id, amount, payment_method, transaction_id?, status}` |
| `PATCH` | `/:id/status` | Aggiorna stato pagamento | Admin | `{status, transaction_id?}` |

**Metodi pagamento**: `credit_card`, `paypal`, `bank_transfer`, `other`
**Stati pagamento**: `pending`, `completed`, `failed`, `refunded`

## Gestione Errori

Il sistema implementa una gestione centralizzata degli errori con:

### Codici di Stato HTTP
- `200` - Successo
- `201` - Creato con successo
- `400` - Richiesta non valida
- `401` - Non autorizzato
- `403` - Accesso negato
- `404` - Risorsa non trovata
- `409` - Conflitto (es. email già esistente)
- `422` - Dati non validi
- `500` - Errore interno del server

### Formato Risposta Errore
```json
{
  "success": false,
  "message": "Errore durante l'operazione",
  "error": "Descrizione specifica dell'errore"
}
```

### Logging
- Tutti gli errori vengono loggati con livello appropriato
- Log delle operazioni principali per debugging

## Testing

### Struttura Test
Il progetto include test per:
- **Autenticazione**: Verifica login e registrazione
- **Endpoint API**: Test delle funzionalità principali
- **Database**: Verifica delle operazioni CRUD

### Esecuzione Test
```bash
# Esegui tutti i test
npm run test

# Test singolo modulo
npm run test auth.test.js
```

## Deployment

### Deployment con Docker

Il progetto include una configurazione docker-compose.yml

```dockerfile
services:
  db:
    image: postgres:17.4-alpine
    container_name: postgres_db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "${DB_PORT}:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./postgres-init:/docker-entrypoint-initdb.d
    networks:
      - rete-app-artigianato
    healthcheck:
      test: [ "CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}" ]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./Backend
    container_name: backend_node
    restart: always
    # ports:
    #  - "${BACKEND_PORT}:3000"
    environment:
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME}
      JWT_SECRET: ${JWT_SECRET:-default_jwt_secret}
      PORT: 3000
      NODE_ENV: ${NODE_ENV:-production}
      # SSL_ENABLED: ${SSL_ENABLED:-false}
      # PUBLIC_BACKEND_URL: "http://${HOST_MACHINE_IP}:${BACKEND_PORT}"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - rete-app-artigianato

  frontend:
    build: ./Frontend
    container_name: frontend_nginx
    restart: always
    #ports:
    #  - "${FRONTEND_PORT}:80"
    networks:
      - rete-app-artigianato

  npm:
    image: 'jc21/nginx-proxy-manager:latest'
    container_name: nginx_proxy_manager
    restart: always
    ports:
      - '80:80'
      - '443:443'
      - '81:81'
    volumes:
      - npm-data:/data
      - npm-letsencrypt:/etc/letsencrypt
    networks:
      - rete-app-artigianato
    depends_on:
      - backend
      - frontend

volumes:
  db-data:
  npm-data:
  npm-letsencrypt:

networks:
  rete-app-artigianato:
    driver: bridge
```

Grazie per aver condiviso il tuo `docker-compose.yml`. Basandoci su questo file, posso aiutarti ad aggiornare la sezione del `README.md` con istruzioni dettagliate per il **deployment su una VPS Ubuntu ARM64**, incluso l'utilizzo di **Nginx Proxy Manager per HTTPS automatico**.

Ecco una versione aggiornata della sezione `README.md` che tiene conto del tuo `docker-compose`:

---

### Deployment su Azure (o qualsiasi VPS Linux)

Questa applicazione è pensata per essere deployata facilmente su una **VPS Ubuntu ARM64** (ma funziona anche per una qualsiasi VPS anche se non sia ARM). Usa **Docker Compose** e include un reverse proxy con **Nginx Proxy Manager** per la gestione automatica di HTTPS.

#### ✅ Requisiti

* Una VPS con Ubuntu 20.04 o superiore
* Accesso root o utente sudo
* Un dominio configurato (opzionale ma consigliato per HTTPS automatico)
* Porte 80, 443 e 81 aperte

---

#### 1. Installazione di Docker e Docker Compose

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose git -y
sudo systemctl enable docker
```

---

#### 2. Clona il repository

```bash
git clone https://github.com/tuo-utente/tuo-repo.git
cd tuo-repo
```

---

#### 3. Configura il file `.env`

Crea un file `.env` nella root del progetto con le seguenti variabili:

```ini
DB_USER=tuo_utente_db
DB_PASSWORD=la_tua_password
DB_NAME=nome_database
DB_PORT=5432
JWT_SECRET=una_stringa_segretissima
NODE_ENV=production
```

---

#### 4. Avvia l'infrastruttura

```bash
docker-compose up -d --build
```

---

#### 5. Configura Nginx Proxy Manager

Accedi all'interfaccia web di Nginx Proxy Manager:

```
http://<IP_DELLA_VPS>:81
```

**Credenziali iniziali** (puoi cambiarle al primo accesso):

* **Email:** [admin@example.com](mailto:admin@example.com)
* **Password:** changeme

##### ➕ Aggiungi un nuovo "Proxy Host"

1. Vai su **"Proxy Hosts"** → **"Add Proxy Host"**
2. Inserisci il tuo dominio (es: `api.tuodominio.com`)
3. IP interno e porta: `backend` e `3000`
4. Spunta **"Block Common Exploits"** e **"Websockets support"**
5. Nella scheda SSL:

  * Spunta **"Enable SSL"**
  * Seleziona **"Request a new SSL Certificate"**
  * Spunta **"Force SSL"**

Ripeti la procedura per il frontend (porta 80, container `frontend_nginx`, o come configurato).

---

#### 6. Aggiorna il DNS del tuo dominio

Assicurati che i record A puntino all’**IP pubblico della tua VPS** per i sottodomini configurati (es. `api.tuodominio.com` → `123.123.123.123`).

---

### Note

* Il servizio `db` (PostgreSQL) è reso disponibile solo internamente alla rete Docker.
* Il reverse proxy automatizza il certificato HTTPS con Let's Encrypt.
* Le directory `./postgres-init/` possono contenere script SQL o `.sh` da eseguire all'avvio.

---

### Variabili di Ambiente
Le variabili di ambiente vengono gestite tramite il file di configurazione Docker principale.

### Note
- Il certificato SSL è gestito da Nginx Proxy Manager con Lets Encrypt