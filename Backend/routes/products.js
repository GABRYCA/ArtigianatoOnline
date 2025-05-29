import express from 'express';
import db from '../db/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Prodotti
 *   description: API per la gestione dei prodotti dell'e-commerce.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         product_id:
 *           type: integer
 *           description: ID univoco del prodotto.
 *           example: 15
 *         artisan_id:
 *           type: integer
 *           description: ID dell'artigiano che ha creato il prodotto.
 *           example: 3
 *         category_id:
 *           type: integer
 *           nullable: true
 *           description: ID della categoria del prodotto.
 *           example: 5
 *         sku:
 *           type: string
 *           nullable: true
 *           description: Stock Keeping Unit (codice univoco prodotto).
 *           example: "VASO-CER-001"
 *         name:
 *           type: string
 *           description: Nome del prodotto.
 *           example: "Vaso in Ceramica Dipinto a Mano"
 *         description:
 *           type: string
 *           nullable: true
 *           description: Descrizione dettagliata del prodotto.
 *           example: "Vaso realizzato al tornio e decorato con motivi floreali."
 *         price:
 *           type: number
 *           format: float # Usiamo float per rappresentare NUMERIC
 *           description: Prezzo del prodotto.
 *           example: 45.50
 *         stock_quantity:
 *           type: integer
 *           description: Quantità disponibile in magazzino.
 *           example: 10
 *         image_url:
 *           type: string
 *           format: url
 *           nullable: true
 *           description: URL dell'immagine principale del prodotto.
 *           example: "https://example.com/images/vaso-cer-001.jpg"
 *         is_active:
 *           type: boolean
 *           description: Indica se il prodotto è visibile nel catalogo.
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data e ora di creazione.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data e ora dell'ultimo aggiornamento.
 *         # Campi aggiuntivi da JOIN (opzionali ma utili)
 *         category_name:
 *           type: string
 *           nullable: true
 *           description: Nome della categoria (ottenuto tramite JOIN).
 *           example: "Ceramiche"
 *         artisan_shop_name:
 *            type: string
 *            nullable: true
 *            description: Nome del negozio dell'artigiano (ottenuto tramite JOIN).
 *            example: "Ceramiche Artistiche Verdi"
 *
 *     ProductCreate:
 *       type: object
 *       required:
 *         - name
 *         - price
 *         - stock_quantity
 *         # category_id è spesso obbligatorio in pratica
 *         - category_id
 *       properties:
 *         category_id:
 *           type: integer
 *           description: ID della categoria a cui appartiene il prodotto.
 *           example: 5
 *         sku:
 *           type: string
 *           description: SKU univoco (opzionale, potrebbe essere generato o richiesto).
 *           example: "VASO-CER-002"
 *         name:
 *           type: string
 *           description: Nome del prodotto.
 *           example: "Piatto Decorativo"
 *         description:
 *           type: string
 *           description: Descrizione del prodotto.
 *           example: "Piatto in terracotta smaltata."
 *         price:
 *           type: number
 *           format: float
 *           minimum: 0
 *           description: Prezzo del prodotto (non negativo).
 *           example: 25.00
 *         stock_quantity:
 *           type: integer
 *           minimum: 0
 *           description: Quantità iniziale in magazzino (non negativa).
 *           example: 5
 *         image_url:
 *           type: string
 *           format: url
 *           description: URL dell'immagine del prodotto.
 *           example: "https://example.com/images/piatto-001.jpg"
 *
 *     ProductUpdate:
 *       type: object
 *       description: Campi aggiornabili per un prodotto. Almeno un campo deve essere fornito.
 *       properties:
 *         category_id:
 *           type: integer
 *           description: Nuovo ID della categoria.
 *           example: 6
 *         sku:
 *           type: string
 *           description: Nuovo SKU.
 *           example: "VASO-CER-001-MOD"
 *         name:
 *           type: string
 *           description: Nuovo nome del prodotto.
 *           example: "Vaso Grande in Ceramica Dipinto"
 *         description:
 *           type: string
 *           description: Nuova descrizione.
 *           example: "Vaso capiente, ideale per piante da interno."
 *         price:
 *           type: number
 *           format: float
 *           minimum: 0
 *           description: Nuovo prezzo.
 *           example: 49.99
 *         stock_quantity:
 *           type: integer
 *           minimum: 0
 *           description: Nuova quantità in magazzino.
 *           example: 8
 *         image_url:
 *           type: string
 *           format: url
 *           description: Nuovo URL dell'immagine.
 *           example: "https://example.com/images/vaso-grande-01.jpg"
 *         is_active:
 *           type: boolean
 *           description: Nuovo stato di attivazione del prodotto.
 *           example: false
 *
 *   parameters:
 *     productIdParam:
 *       in: path
 *       name: id
 *       required: true
 *       schema:
 *         type: integer
 *         description: ID numerico del prodotto.
 *         example: 15
 *     # Parametri di query per il filtro
 *     categoryIdFilter:
 *        in: query
 *        name: category # Nome del parametro in URL
 *        schema:
 *          type: array # Tipo array
 *          items:
 *            type: integer # Di interi
 *        style: form
 *        explode: true # Indica ?category=1&category=5
 *        description: Filtra i prodotti per uno o più ID categoria. Fornire il parametro ripetuto per ogni ID (es. `?category=1&category=5`).
 *        # example non è molto utile per gli array così, ma lo lasciamo
 *        # example: [1, 5]
 *     minPriceFilter:
 *        in: query
 *        name: minPrice
 *        schema:
 *          type: number
 *          format: float
 *          minimum: 0
 *        description: Filtra i prodotti con prezzo maggiore o uguale a questo valore.
 *        example: 20.0
 *     maxPriceFilter:
 *        in: query
 *        name: maxPrice
 *        schema:
 *          type: number
 *          format: float
 *          minimum: 0
 *        description: Filtra i prodotti con prezzo minore o uguale a questo valore.
 *        example: 100.0
 *     inStockFilter:
 *        in: query
 *        name: inStock
 *        schema:
 *          type: boolean
 *        description: Filtra i prodotti disponibili (stock > 0).
 *        example: true
 *     searchQueryFilter:
 *        in: query
 *        name: q
 *        schema:
 *          type: string
 *        description: Cerca prodotti per nome o descrizione (case-insensitive).
 *        example: "ceramica"
 *     artisanIdFilter:
 *         in: query
 *         name: artisanId
 *         schema:
 *             type: integer
 *         description: Filtra i prodotti per ID artigiano specifico.
 *         example: 3
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Ottiene la lista dei prodotti attivi (catalogo).
 *     tags: [Prodotti]
 *     description: Recupera un elenco paginato e filtrabile di prodotti attivi (visibili nel catalogo pubblico). Non richiede autenticazione.
 *     parameters:
 *       - $ref: '#/components/parameters/categoryIdFilter' # Usa la nuova definizione
 *       - $ref: '#/components/parameters/minPriceFilter'
 *       - $ref: '#/components/parameters/maxPriceFilter'
 *       - $ref: '#/components/parameters/inStockFilter'
 *       - $ref: '#/components/parameters/searchQueryFilter'
 *       - $ref: '#/components/parameters/artisanIdFilter'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numero di pagina per la paginazione.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero di prodotti per pagina.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price_asc, price_desc, name_asc, name_desc, created_at_desc]
 *           default: created_at_desc
 *         description: Criterio di ordinamento dei risultati.
 *     responses:
 *       '200':
 *         description: Lista di prodotti recuperata con successo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                   example: 55
 *                 totalPages:
 *                   type: integer
 *                   example: 6
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 products:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product' # O uno schema ridotto per la lista
 *       '400':
 *         description: Parametri di query non validi.
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/', async (req, res) => {
    const {
        category, minPrice, maxPrice, inStock, q, artisanId,
        page = 1, limit = 10, sortBy = 'created_at_desc'
    } = req.query;

    const offset = (page - 1) * limit;
    let queryParams = [];
    let paramIndex = 1;
    let baseFilterClauses = ['p.is_active = TRUE'];
    let countFilterClauses = ['is_active = TRUE'];

    // Filtri
    const addFilter = (baseClause, countClause, value) => {
        baseFilterClauses.push(baseClause.replace('$?', `$${paramIndex}`));
        countFilterClauses.push(countClause.replace('$?', `$${paramIndex}`));
        queryParams.push(value);
        paramIndex++;
    };

    // Filtro Categoria (singola o multipla)
    if (category) {
        const categoryIds = (Array.isArray(category) ? category : [category])
            .map(id => parseInt(id, 10))
            .filter(id => !isNaN(id));

        if (categoryIds.length > 0) {
            if (categoryIds.length === 1) {
                addFilter('p.category_id = $?', 'category_id = $?', categoryIds[0]);
            } else {
                addFilter('p.category_id = ANY($?::int[])', 'category_id = ANY($?::int[])', categoryIds);
            }
        } else {
            console.warn("ID categorie forniti non validi:", category);
        }
    }

    // Filtro Prezzo Minimo
    if (minPrice !== undefined) {
        const numMinPrice = parseFloat(minPrice);
        if (!isNaN(numMinPrice) && numMinPrice >= 0) {
            addFilter('p.price >= $?', 'price >= $?', numMinPrice);
        } else {
            return res.status(400).json({ message: 'Parametro minPrice non valido.' });
        }
    }

    // Filtro Prezzo Massimo
    if (maxPrice !== undefined) {
        const numMaxPrice = parseFloat(maxPrice);
        if (!isNaN(numMaxPrice) && numMaxPrice >= 0) {
            addFilter('p.price <= $?', 'price <= $?', numMaxPrice);
        } else {
            return res.status(400).json({ message: 'Parametro maxPrice non valido.' });
        }
    }

    // Filtro Disponibilità
    if (inStock === 'true') {
        baseFilterClauses.push('p.stock_quantity > 0');
        countFilterClauses.push('stock_quantity > 0');
    } else if (inStock === 'false') {
        baseFilterClauses.push('p.stock_quantity <= 0');
        countFilterClauses.push('stock_quantity <= 0');
    }

    // Filtro Artigiano
    if (artisanId !== undefined) {
        const numArtisanId = parseInt(artisanId, 10);
        if (!isNaN(numArtisanId)) {
            addFilter('p.artisan_id = $?', 'artisan_id = $?', numArtisanId);
        } else {
            return res.status(400).json({ message: 'Parametro artisanId non valido.' });
        }
    }

    // Filtro Ricerca Testuale (q)
    if (q && typeof q === 'string' && q.trim() !== '') {
        const searchTerm = `%${q.trim()}%`;
        baseFilterClauses.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
        countFilterClauses.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        queryParams.push(searchTerm);
        paramIndex++;
    }

    const whereClauseBase = baseFilterClauses.length > 0 ? `WHERE ${baseFilterClauses.join(' AND ')}` : '';
    const whereClauseCount = countFilterClauses.length > 0 ? `WHERE ${countFilterClauses.join(' AND ')}` : '';

    // Query
    const countQuery = `SELECT COUNT(*) FROM products ${whereClauseCount}`;

    // Query
    let baseQuery = `
        SELECT p.*, c.name as category_name, u.shop_name as artisan_shop_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.category_id
        LEFT JOIN users u ON p.artisan_id = u.user_id
        ${whereClauseBase}
    `;

    // Ordinamento
    let orderByClause = 'ORDER BY ';
    switch (sortBy) {
        case 'price_asc': orderByClause += 'p.price ASC NULLS LAST'; break; // Gestire NULLS se price può essere null
        case 'price_desc': orderByClause += 'p.price DESC NULLS LAST'; break;
        case 'name_asc': orderByClause += 'p.name ASC'; break;
        case 'name_desc': orderByClause += 'p.name DESC'; break;
        case 'created_at_desc':
        default: orderByClause += 'p.created_at DESC'; break;
    }

    // Ordinamento secondario
    if (sortBy !== 'created_at_desc') {
        orderByClause += ', p.created_at DESC';
    }
    baseQuery += ` ${orderByClause}`;

    // Paginazione
    const limitParamIndex = paramIndex++;
    const offsetParamIndex = paramIndex++;
    baseQuery += ` LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
    queryParams.push(limit, offset);

    const countQueryParams = queryParams.slice(0, limitParamIndex - 1);

    try {
        const countResult = await db.query(countQuery, countQueryParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        const productsResult = await db.query(baseQuery, queryParams);

        res.json({
            totalItems,
            totalPages,
            currentPage: parseInt(page, 10),
            products: productsResult.rows
        });
    } catch (error) {
        console.error("Errore nel recuperare i prodotti:", error);
        if (error.code && ['22P02', '22007', '22008'].includes(error.code)) {
            res.status(400).json({ message: 'Parametri di query non validi.' });
        } else {
            res.status(500).json({ message: 'Errore del server nel recuperare i prodotti.' });
        }
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Ottiene i dettagli di un singolo prodotto attivo.
 *     tags: [Prodotti]
 *     description: Recupera le informazioni dettagliate di un prodotto specifico tramite il suo ID, solo se è attivo.
 *     parameters:
 *       - $ref: '#/components/parameters/productIdParam'
 *     responses:
 *       '200':
 *         description: Dettagli prodotto recuperati con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       '404':
 *         description: Prodotto non trovato o non attivo.
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
        return res.status(400).json({ message: 'ID prodotto non valido.' });
    }

    try {
        const query = `
            SELECT p.*, c.name as category_name, u.shop_name as artisan_shop_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            LEFT JOIN users u ON p.artisan_id = u.user_id
            WHERE p.product_id = $1 AND p.is_active = TRUE`;
        const result = await db.query(query, [productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Prodotto non trovato o non disponibile.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore nel recuperare il prodotto ${productId}:`, error);
        res.status(500).json({ message: 'Errore del server nel recuperare il prodotto.' });
    }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Crea un nuovo prodotto.
 *     tags: [Prodotti]
 *     description: Aggiunge un nuovo prodotto al catalogo. Accessibile solo agli utenti con ruolo 'artigiano'. L'ID artigiano viene preso dal token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductCreate'
 *     responses:
 *       '201':
 *         description: Prodotto creato con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product' # Restituisce il prodotto appena creato
 *       '400':
 *         description: Dati di input non validi (es. campi mancanti, prezzo/stock negativi).
 *       '401':
 *         description: Non autorizzato (token mancante o non valido).
 *       '403':
 *         description: Accesso negato (l'utente non è un artigiano).
 *       '500':
 *         description: Errore interno del server.
 */
router.post('/', authenticateToken, authorizeRoles('artigiano'), async (req, res) => {
    const { category_id, sku, name, description, price, stock_quantity, image_url } = req.body;
    const artisan_id = req.user.userId;

    // Validazione
    if (!name || price === undefined || stock_quantity === undefined || category_id === undefined) {
        return res.status(400).json({ message: 'Nome, prezzo, quantità e categoria sono obbligatori.' });
    }
    if (price < 0 || stock_quantity < 0) {
        return res.status(400).json({ message: 'Prezzo e quantità non possono essere negativi.' });
    }

    try {
        const query = `
            INSERT INTO products (artisan_id, category_id, sku, name, description, price, stock_quantity, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`;
        const params = [artisan_id, category_id, sku, name, description, price, stock_quantity, image_url];

        const result = await db.query(query, params);

        const newProduct = result.rows[0];
        const detailsQuery = `
             SELECT c.name as category_name, u.shop_name as artisan_shop_name
             FROM categories c, users u
             WHERE c.category_id = $1 AND u.user_id = $2`;
        const detailsResult = await db.query(detailsQuery, [newProduct.category_id, newProduct.artisan_id]);
        const details = detailsResult.rows[0] || {};

        res.status(201).json({
            ...newProduct,
            category_name: details.category_name,
            artisan_shop_name: details.artisan_shop_name
        });

    } catch (error) {
        const isDuplicateSku = error.code === '23505' && error.constraint === 'products_sku_key';
        const isInvalidCategoryFK = error.code === '23503' && error.constraint === 'products_category_id_fkey';

        if (!isDuplicateSku && !isInvalidCategoryFK) console.error("Errore nella creazione del prodotto:", error);

        if (isDuplicateSku) return res.status(400).json({ message: `Lo SKU "${sku}" è già in uso.` });
        if (isInvalidCategoryFK) {
            return res.status(400).json({ message: 'Categoria non valida.' });
        }
        res.status(500).json({ message: 'Errore del server durante la creazione del prodotto.' });
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Aggiorna un prodotto esistente.
 *     tags: [Prodotti]
 *     description: Modifica i dettagli di un prodotto. Accessibile solo all'artigiano proprietario del prodotto o a un amministratore.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/productIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpdate'
 *     responses:
 *       '200':
 *         description: Prodotto aggiornato con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product' # Restituisce il prodotto aggiornato
 *       '400':
 *         description: Dati di input non validi o ID prodotto non valido.
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (non proprietario e non admin).
 *       '404':
 *         description: Prodotto non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.put('/:id', authenticateToken, authorizeRoles('artigiano', 'admin'), async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;

    if (isNaN(productId)) {
        return res.status(400).json({ message: 'ID prodotto non valido.' });
    }

    const { category_id, sku, name, description, price, stock_quantity, image_url, is_active } = req.body;

    // Verifico se ci sia almeno un campo da aggiornare
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'Nessun dato fornito per l\'aggiornamento.' });
    }

    // Validazione
    if ((price !== undefined && price < 0) || (stock_quantity !== undefined && stock_quantity < 0)) {
        return res.status(400).json({ message: 'Prezzo e quantità non possono essere negativi.' });
    }


    try {
        // Recupero il prodotto
        const productResult = await db.query('SELECT artisan_id FROM products WHERE product_id = $1', [productId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ message: 'Prodotto non trovato.' });
        }
        const productOwnerId = productResult.rows[0].artisan_id;

        // Verifico permessi (solo admin o l'artigiano proprietario possono eseguire)
        if (requestingUserRole !== 'admin' && requestingUserId !== productOwnerId) {
            return res.status(403).json({ message: 'Accesso negato. Non puoi modificare questo prodotto.' });
        }

        // UPDATE
        const fieldsToUpdate = [];
        const queryParams = [];
        let paramIndex = 1;

        const addUpdateField = (fieldName, value) => {
            if (value !== undefined) {
                fieldsToUpdate.push(`${fieldName} = $${paramIndex++}`);
                queryParams.push(value);
            }
        };

        addUpdateField('category_id', category_id);
        addUpdateField('sku', sku);
        addUpdateField('name', name);
        addUpdateField('description', description);
        addUpdateField('price', price);
        addUpdateField('stock_quantity', stock_quantity);
        addUpdateField('image_url', image_url);
        addUpdateField('is_active', is_active);

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ message: 'Nessun dato valido fornito per l\'aggiornamento.' });
        }

        // WHERE
        queryParams.push(productId);

        const updateQuery = `
            UPDATE products
            SET ${fieldsToUpdate.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = $${paramIndex}
            RETURNING *`;

        const updateResult = await db.query(updateQuery, queryParams);

        const updatedProduct = updateResult.rows[0];
        const detailsQuery = `
             SELECT c.name as category_name, u.shop_name as artisan_shop_name
             FROM categories c, users u
             WHERE c.category_id = $1 AND u.user_id = $2`;
        const detailsResult = await db.query(detailsQuery, [updatedProduct.category_id, updatedProduct.artisan_id]);
        const details = detailsResult.rows[0] || {};

        res.json({
            ...updatedProduct,
            category_name: details.category_name,
            artisan_shop_name: details.artisan_shop_name
        });

    } catch (error) {
        const isDuplicateSku = error.code === '23505' && error.constraint === 'products_sku_key';
        const isInvalidCategoryFK = error.code === '23503' && error.constraint === 'products_category_id_fkey';

        if (!isDuplicateSku && !isInvalidCategoryFK) console.error(`Errore nell'aggiornare il prodotto ${productId}:`, error);
        if (isDuplicateSku) return res.status(400).json({ message: `Lo SKU "${sku}" è già in uso.` });
        if (isInvalidCategoryFK) return res.status(400).json({ message: 'Categoria non valida.' });

        res.status(500).json({ message: 'Errore del server durante l\'aggiornamento del prodotto.' });
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Elimina (disattiva) un prodotto.
 *     tags: [Prodotti]
 *     description: Imposta lo stato del prodotto a inattivo (`is_active = false`). Non elimina fisicamente il record. Accessibile solo all'artigiano proprietario o a un amministratore.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/productIdParam'
 *     responses:
 *       '204':
 *         description: Prodotto disattivato con successo (nessun contenuto restituito).
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (non proprietario e non admin).
 *       '404':
 *         description: Prodotto non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.delete('/:id', authenticateToken, authorizeRoles('artigiano', 'admin'), async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;

    if (isNaN(productId)) {
        return res.status(400).json({ message: 'ID prodotto non valido.' });
    }

    try {
        // Recupero il prodotto
        const productResult = await db.query('SELECT artisan_id FROM products WHERE product_id = $1', [productId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ message: 'Prodotto non trovato.' });
        }
        const productOwnerId = productResult.rows[0].artisan_id;

        // Verifico permessi
        if (requestingUserRole !== 'admin' && requestingUserId !== productOwnerId) {
            return res.status(403).json({ message: 'Accesso negato. Non puoi eliminare questo prodotto.' });
        }

        // Eseguo disattivazione
        const deleteResult = await db.query(
            'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE product_id = $1 RETURNING product_id',
            [productId]
        );

        // Verifico UPDATE
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'Prodotto non trovato o errore durante l\'eliminazione.' });
        }

        // DELETE ok
        res.status(204).send();

    } catch (error) {
        console.error(`Errore nell'eliminare (disattivare) il prodotto ${productId}:`, error);
        res.status(500).json({ message: 'Errore del server durante l\'eliminazione del prodotto.' });
    }
});


export default router;