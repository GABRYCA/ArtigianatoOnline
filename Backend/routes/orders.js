import express from 'express';
import db from '../db/database.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Ordini
 *   description: API per la gestione degli ordini dei clienti.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         order_item_id:
 *           type: integer
 *         product_id:
 *           type: integer
 *         quantity:
 *           type: integer
 *         price_per_unit:
 *           type: number
 *           format: float
 *         # Campi aggiuntivi da JOIN
 *         product_name:
 *           type: string
 *         product_sku:
 *           type: string
 *         product_image_url:
 *            type: string
 *            format: url
 *         artisan_id:
 *           type: integer
 *         artisan_shop_name:
 *            type: string
 *
 *     Order:
 *       type: object
 *       properties:
 *         order_id:
 *           type: integer
 *         customer_id:
 *           type: integer
 *         order_date:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [pending, paid, processing, shipped, delivered, cancelled, refunded]
 *           description: Stato attuale dell'ordine.
 *           example: processing
 *         total_amount:
 *           type: number
 *           format: float
 *           description: Importo totale dell'ordine.
 *           example: 120.50
 *         shipping_address:
 *           type: string
 *           description: Indirizzo di spedizione completo.
 *           example: "Via Verdi 10, 10100 Torino, TO, Italia"
 *         billing_address:
 *           type: string
 *           nullable: true
 *           description: Indirizzo di fatturazione (se diverso).
 *         shipping_method:
 *           type: string
 *           nullable: true
 *           description: Metodo di spedizione scelto.
 *           example: "Corriere Espresso"
 *         tracking_number:
 *           type: string
 *           nullable: true
 *           description: Numero di tracciamento della spedizione.
 *         notes:
 *           type: string
 *           nullable: true
 *           description: Eventuali note aggiuntive del cliente o admin.
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         # Campi aggiuntivi utili
 *         customer_full_name:
 *              type: string
 *         customer_email:
 *              type: string
 *              format: email
 *         items:
 *           type: array
 *           description: Elenco degli articoli inclusi nell'ordine.
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *
 *     OrderCreateItemInput:
 *        type: object
 *        required:
 *          - product_id
 *          - quantity
 *        properties:
 *          product_id:
 *             type: integer
 *             description: ID del prodotto da ordinare.
 *             example: 15
 *          quantity:
 *             type: integer
 *             minimum: 1
 *             description: Numero di unità del prodotto da ordinare.
 *             example: 2
 *
 *     OrderCreateInput:
 *       type: object
 *       required:
 *         - items
 *         - shipping_address
 *       properties:
 *         items:
 *           type: array
 *           description: Lista dei prodotti e quantità da ordinare.
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/OrderCreateItemInput'
 *         shipping_address:
 *           type: string
 *           description: Indirizzo di spedizione completo.
 *           example: "Via Verdi 10, 10100 Torino, TO, Italia"
 *         billing_address:
 *           type: string
 *           description: Indirizzo di fatturazione (opzionale, se diverso da spedizione).
 *         shipping_method:
 *           type: string
 *           description: Metodo di spedizione desiderato (opzionale).
 *           example: "Corriere Standard"
 *         notes:
 *           type: string
 *           description: Note aggiuntive per l'ordine (opzionale).
 *
 *     OrderUpdateStatusInput:
 *        type: object
 *        required:
 *          - status
 *        properties:
 *          status:
 *             type: string
 *             enum: [pending, paid, processing, shipped, delivered, cancelled, refunded]
 *             description: Nuovo stato dell'ordine.
 *             example: shipped
 *          # Campi opzionali specifici per alcuni stati
 *          tracking_number:
 *             type: string
 *             description: Numero di tracking (rilevante per lo stato 'shipped').
 *             example: "TRACK123XYZ"
 *          notes:
 *             type: string
 *             description: Note aggiuntive relative al cambio di stato.
 *             example: "Spedito con corriere ABC"
 *
 *   parameters:
 *      orderIdParam:
 *          in: path
 *          name: id
 *          required: true
 *          schema:
 *              type: integer
 *          description: ID numerico dell'ordine.
 *          example: 101
 *      # Parametri di query per filtro ordini
 *      orderStatusFilter:
 *         in: query
 *         name: status
 *         schema:
 *             type: string
 *             enum: [pending, paid, processing, shipped, delivered, cancelled, refunded]
 *         description: Filtra gli ordini per stato.
 *      orderStartDateFilter:
 *          in: query
 *          name: startDate
 *          schema:
 *              type: string
 *              format: date
 *          description: Filtra ordini a partire da questa data (YYYY-MM-DD).
 *      orderEndDateFilter:
 *          in: query
 *          name: endDate
 *          schema:
 *              type: string
 *              format: date
 *          description: Filtra ordini fino a questa data (YYYY-MM-DD).
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Crea un nuovo ordine.
 *     tags: [Ordini]
 *     description: Permette a un cliente autenticato di creare un nuovo ordine. Verifica la disponibilità dei prodotti, calcola il totale, crea l'ordine e gli articoli associati, e decrementa lo stock dei prodotti. Il tutto avviene in una transazione.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderCreateInput'
 *     responses:
 *       '201':
 *         description: Ordine creato con successo. Restituisce i dettagli dell'ordine creato.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       '400':
 *         description: Richiesta non valida (es. prodotti non trovati, quantità non disponibile, dati mancanti).
 *       '401':
 *         description: Non autorizzato (token mancante o non valido).
 *       '403':
 *         description: Accesso negato (solo i clienti possono creare ordini).
 *       '500':
 *         description: Errore interno del server (es. fallimento transazione).
 */
router.post('/', authenticateToken, authorizeRoles('cliente'), async (req, res) => {
    const customer_id = req.user.userId;
    const {items, shipping_address, billing_address, shipping_method, notes} = req.body;

    // Validazione
    if (!items || items.length === 0 || !shipping_address) {
        return res.status(400).json({message: 'Articoli e indirizzo di spedizione sono obbligatori.'});
    }
    if (!Array.isArray(items) || items.some(item => !item.product_id || !item.quantity || item.quantity <= 0)) {
        return res.status(400).json({message: 'Formato articoli non valido. Fornire array di {product_id, quantity > 0}.'});
    }

    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        let totalAmount = 0;
        const orderItemsData = [];

        // Recupero dettagli prodotti, verifico disponibilità e calcolo il totale
        const productIds = items.map(item => item.product_id);
        const productDetailsResult = await client.query(
            `SELECT product_id, name, price, stock_quantity, artisan_id, is_active
             FROM products
             WHERE product_id = ANY ($1::int[])`,
            [productIds]
        );
        const productDetailsMap = new Map(productDetailsResult.rows.map(p => [p.product_id, p]));

        for (const item of items) {
            const product = productDetailsMap.get(item.product_id);

            if (!product || !product.is_active) {
                throw new Error(`Prodotto con ID ${item.product_id} non trovato o non disponibile.`);
            }
            if (product.stock_quantity < item.quantity) {
                throw new Error(`Quantità non disponibile per il prodotto "${product.name}" (Disponibili: ${product.stock_quantity}, Richiesti: ${item.quantity}).`);
            }

            const itemTotal = product.price * item.quantity;
            totalAmount += itemTotal;

            orderItemsData.push({
                product_id: item.product_id,
                quantity: item.quantity,
                price_per_unit: product.price,
                artisan_id: product.artisan_id
            });
        }

        // Arrotondo a 2 decimali
        totalAmount = Math.round(totalAmount * 100) / 100;

        // Metodo di spedizione
        if (shipping_method) {
            if (shipping_method !== 'standard' && shipping_method !== 'express' && shipping_method !== 'free') {
                return res.status(400).json({message: 'Metodo di spedizione non valido. Deve essere "standard", "express" o "free".'});
            }

            if (shipping_method === 'free' && totalAmount < 100) {
                return res.status(400).json({message: 'Per la spedizione gratuita, l\'ordine deve superare i 100 euro.'});
            }

            if (shipping_method === 'standard') {
                totalAmount += 4.99;
            } else if (shipping_method === 'express') {
                totalAmount += 9.99;
            }

            // Arrotondo
            totalAmount = Math.round(totalAmount * 100) / 100;
        }

        // Creo record
        const orderInsertResult = await client.query(
            `INSERT INTO orders (customer_id, status, total_amount, shipping_address, billing_address, shipping_method,
                                 notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING order_id, order_date, status, total_amount, shipping_address, billing_address, shipping_method, notes, created_at, updated_at`,
            [customer_id, 'pending', totalAmount, shipping_address, billing_address, shipping_method, notes]
        );
        const newOrder = orderInsertResult.rows[0];
        const orderId = newOrder.order_id;

        // Creo i record
        const itemInsertPromises = orderItemsData.map(itemData => {
            return client.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, artisan_id)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING order_item_id, product_id, quantity, price_per_unit`,
                [orderId, itemData.product_id, itemData.quantity, itemData.price_per_unit, itemData.artisan_id]
            );
        });
        const insertedItemsResults = await Promise.all(itemInsertPromises);
        const insertedItems = insertedItemsResults.map(res => res.rows[0]);

        // Aggiorno stock
        const stockUpdatePromises = orderItemsData.map(itemData => {
            return client.query(
                `UPDATE products
                 SET stock_quantity = stock_quantity - $1
                 WHERE product_id = $2`,
                [itemData.quantity, itemData.product_id]
            );
        });
        await Promise.all(stockUpdatePromises);

        await client.query('COMMIT');

        newOrder.items = insertedItems;
        newOrder.customer_id = customer_id;

        res.status(201).json(newOrder);

    } catch (error) {
        await client.query('ROLLBACK');
        const isNotFoundError = error.message.includes('non trovato') || error.message.includes('non disponibile');
        if (!isNotFoundError) console.error("Errore nella creazione dell'ordine:", error);
        res.status(isNotFoundError ? 400 : 500)
            .json({message: error.message || 'Errore del server durante la creazione dell\'ordine.'});
    } finally {
        client.release();
    }
});


/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Ottiene la lista degli ordini.
 *     tags: [Ordini]
 *     description: |
 *       Recupera una lista paginata e filtrabile di ordini.
 *       - I **Clienti** vedono solo i propri ordini.
 *       - Gli **Artigiani** vedono solo gli ordini che contengono almeno un loro prodotto.
 *       - Gli **Admin** vedono tutti gli ordini.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/orderStatusFilter'
 *       - $ref: '#/components/parameters/orderStartDateFilter'
 *       - $ref: '#/components/parameters/orderEndDateFilter'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Numero di pagina.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Numero di ordini per pagina.
 *     responses:
 *       '200':
 *         description: Lista ordini recuperata con successo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                  totalItems:
 *                     type: integer
 *                  totalPages:
 *                     type: integer
 *                  currentPage:
 *                     type: integer
 *                  orders:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Order' # Schema ordine (potrebbe essere ridotto per la lista)
 *       '400':
 *         description: Parametri di query non validi.
 *       '401':
 *         description: Non autorizzato.
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/', authenticateToken, async (req, res) => {
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;
    const {status, startDate, endDate, page = 1, limit = 10} = req.query;

    const offset = (page - 1) * limit;
    let queryParams = [];
    let paramIndex = 1;
    let countParams = [];
    let dataParams = [];

    // Query
    let baseQuery = `FROM orders o LEFT JOIN users u ON o.customer_id = u.user_id `;
    let filters = [];

    // Filtro (ruolo)
    if (requestingUserRole === 'cliente') {
        filters.push(`o.customer_id = $${paramIndex++}`);
        queryParams.push(requestingUserId);
    } else if (requestingUserRole === 'artigiano') {
        baseQuery += ` JOIN (SELECT DISTINCT order_id FROM order_items WHERE artisan_id = $${paramIndex++}) oi_filter ON o.order_id = oi_filter.order_id `;
        queryParams.push(requestingUserId);
    }

    // Filtri
    if (status) {
        filters.push(`o.status = $${paramIndex++}`);
        queryParams.push(status);
    }
    if (startDate) {
        filters.push(`o.order_date >= $${paramIndex++}`);
        queryParams.push(startDate);
    }
    if (endDate) {
        filters.push(`o.order_date < ($${paramIndex++}::date + interval '1 day')`);
        queryParams.push(endDate);
    }

    // WHERE
    let whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Parametri
    countParams = [...queryParams];

    // Query
    let countQuery = `SELECT COUNT(o.order_id) ${baseQuery} ${whereClause}`;

    // Query
    let dataQuery = `
        SELECT o.order_id, o.customer_id, o.order_date, o.status, o.total_amount, o.shipping_address,
               o.billing_address, o.shipping_method, o.tracking_number, o.notes, o.created_at, o.updated_at,
               u.full_name as customer_full_name, u.email as customer_email
        ${baseQuery}
        ${whereClause}
        ORDER BY o.order_date DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    dataParams = [...queryParams, limit, offset];

    try {
        // Count
        const countResult = await db.query(countQuery, countParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        // Query
        const ordersResult = await db.query(dataQuery, dataParams);
        let orders = ordersResult.rows;

        // Articoli ordine (se artigiano)
        if (requestingUserRole === 'artigiano' && orders.length > 0) {
            const orderIds = orders.map(order => order.order_id);

            const itemsQuery = `
                SELECT
                    oi.order_id, -- Necessario per mappare
                    oi.order_item_id,
                    oi.product_id,
                    oi.quantity,
                    oi.price_per_unit,
                    p.name as product_name,
                    p.sku as product_sku,
                    p.image_url as product_image_url
                FROM order_items oi
                JOIN products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ANY($1::int[]) AND oi.artisan_id = $2
                ORDER BY oi.order_item_id`;

            const itemsResult = await db.query(itemsQuery, [orderIds, requestingUserId]);

            // Map articoli
            const itemsByOrderId = itemsResult.rows.reduce((acc, item) => {
                if (!acc[item.order_id]) {
                    acc[item.order_id] = [];
                }

                const { order_id, ...itemData } = item;
                acc[order_id].push(itemData);
                return acc;
            }, {});

            // Items
            orders = orders.map(order => ({
                ...order,
                items: itemsByOrderId[order.order_id] || []
            }));
        }

        res.json({
            totalItems,
            totalPages,
            currentPage: parseInt(page, 10),
            orders: orders
        });

    } catch (error) {
        console.error("Errore nel recuperare gli ordini:", error);
        res.status(500).json({message: 'Errore del server nel recuperare gli ordini.'});
    }
});

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Ottiene i dettagli di un singolo ordine.
 *     tags: [Ordini]
 *     description: |
 *       Recupera i dettagli completi di un ordine, inclusi gli articoli.
 *       - Il **Cliente** può vedere solo i propri ordini.
 *       - L'**Artigiano** può vedere solo gli ordini che contengono almeno un suo prodotto.
 *       - L'**Admin** può vedere qualsiasi ordine.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/orderIdParam'
 *     responses:
 *       '200':
 *         description: Dettagli ordine recuperati con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order' # Include gli items
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (non autorizzato a vedere questo ordine).
 *       '404':
 *         description: Ordine non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/:id', authenticateToken, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;

    if (isNaN(orderId)) {
        return res.status(400).json({message: 'ID ordine non valido.'});
    }

    try {
        // Recupero i dati dell'ordine + info cliente
        const orderQuery = `
            SELECT o.*, u.full_name as customer_full_name, u.email as customer_email
            FROM orders o
                     JOIN users u ON o.customer_id = u.user_id
            WHERE o.order_id = $1`;
        const orderResult = await db.query(orderQuery, [orderId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({message: 'Ordine non trovato.'});
        }
        const order = orderResult.rows[0];

        // Recupero articoli ordine con dettagli prodotto/artigiano
        const itemsQuery = `
            SELECT oi.*,
                   p.name      as product_name,
                   p.sku       as product_sku,
                   p.image_url as product_image_url,
                   u.shop_name as artisan_shop_name
            FROM order_items oi
                     JOIN products p ON oi.product_id = p.product_id
                     JOIN users u ON oi.artisan_id = u.user_id
            WHERE oi.order_id = $1
            ORDER BY oi.order_item_id`;
        const itemsResult = await db.query(itemsQuery, [orderId]);
        order.items = itemsResult.rows;

        // Verifica permessi
        let canView = false;
        if (requestingUserRole === 'admin') {
            canView = true;
        } else if (requestingUserRole === 'cliente' && order.customer_id === requestingUserId) {
            canView = true;
        } else if (requestingUserRole === 'artigiano') {
            if (order.items.some(item => item.artisan_id === requestingUserId)) canView = true;
        }

        if (!canView) return res.status(403).json({message: 'Accesso negato. Non puoi visualizzare questo ordine.'});

        res.json(order);

    } catch (error) {
        console.error(`Errore nel recuperare l'ordine ${orderId}:`, error);
        res.status(500).json({message: 'Errore del server nel recuperare l\'ordine.'});
    }
});

/**
 * @swagger
 * /api/orders/{id}/status:
 *   put:
 *     summary: Aggiorna lo stato di un ordine.
 *     tags: [Ordini]
 *     description: |
 *       Permette di modificare lo stato di un ordine.
 *       - L'**Admin** può impostare stati come: 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded' (con logica di transizione).
 *       - L'**Artigiano** può aggiornare lo stato degli ordini contenenti i propri prodotti a 'processing' (da 'paid') o 'shipped' (da 'processing'), potendo aggiungere il tracking number.
 *       - Il **Cliente** può impostare lo stato a 'cancelled' solo se l'ordine è in stato 'pending' o 'paid'.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/orderIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrderUpdateStatusInput'
 *     responses:
 *       '200':
 *         description: Stato ordine aggiornato con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order' # Restituisce l'ordine aggiornato
 *       '400':
 *         description: Richiesta non valida (es. stato non valido, transizione di stato non permessa).
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (permessi insufficienti, ordine non appartenente all'artigiano o transizione non permessa per questo ruolo).
 *       '404':
 *         description: Ordine non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.put('/:id/status', authenticateToken, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;
    const {status, tracking_number, notes} = req.body;
    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

    if (isNaN(orderId)) {
        return res.status(400).json({message: 'ID ordine non valido.'});
    }
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({message: 'Stato non fornito o non valido.'});
    }

    const client = await db.getClient();

    try {
        // Recupera l'ordine corrente
        const orderResult = await client.query('SELECT order_id, customer_id, status FROM orders WHERE order_id = $1 FOR UPDATE', [orderId]);
        if (orderResult.rows.length === 0) {
            client.release();
            return res.status(404).json({message: 'Ordine non trovato.'});
        }
        const currentOrder = orderResult.rows[0];
        const currentStatus = currentOrder.status;

        // Verifico Permessi e transizione stato
        let canUpdate = false;
        let errorMessage = 'Non autorizzato ad aggiornare lo stato di questo ordine o transizione non permessa.';

        if (requestingUserRole === 'admin') {
            const allowedAdminTransitions = {
                pending: ['paid', 'processing', 'cancelled'],
                paid: ['processing', 'cancelled', 'refunded'],
                processing: ['shipped', 'cancelled'],
                shipped: ['delivered', 'refunded'],
                delivered: ['refunded'],
                cancelled: [],
                refunded: []
            };
            if (allowedAdminTransitions[currentStatus]?.includes(status)) {
                canUpdate = true;
            } else {
                errorMessage = `Admin: Transizione da '${currentStatus}' a '${status}' non permessa.`;
            }
        } else if (requestingUserRole === 'artigiano') {
            const artisanItemsResult = await client.query('SELECT 1 FROM order_items WHERE order_id = $1 AND artisan_id = $2 LIMIT 1', [orderId, requestingUserId]);
            if (artisanItemsResult.rows.length > 0) {
                const allowedArtisanTransitions = {
                    paid: ['processing'],
                    processing: ['shipped']
                };
                if (allowedArtisanTransitions[currentStatus]?.includes(status)) {
                    canUpdate = true;
                } else {
                    errorMessage = `Artigiano: Transizione da '${currentStatus}' a '${status}' non permessa. Consentite: paid -> processing, processing -> shipped.`;
                }
            } else {
                errorMessage = 'Accesso negato. Questo ordine non contiene tuoi prodotti.';
            }
        } else if (requestingUserRole === 'cliente' && currentOrder.customer_id === requestingUserId) {
            if (status === 'cancelled' && ['pending', 'paid'].includes(currentStatus)) {
                canUpdate = true;
            } else {
                errorMessage = `Cliente: Non può cambiare stato da '${currentStatus}' a '${status}'. Può solo cancellare da 'pending' o 'paid'.`;
            }
        }

        if (!canUpdate) {
            client.release();
            return res.status(403).json({message: errorMessage});
        }

        // Query
        const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
        const queryParams = [status];
        let paramIndex = 2;


        if (status === 'shipped' && tracking_number !== undefined) {
            updateFields.push(`tracking_number = $${paramIndex++}`);
            queryParams.push(tracking_number);
        }

        if (notes !== undefined) {
            updateFields.push(`notes = $${paramIndex++}`);
            queryParams.push(notes);
        }
        queryParams.push(orderId);

        // Rimessa in stock, in caso di cancellazione (solo admin o cliente)
        let stockRestoreRequired = false;
        if (status === 'cancelled' && ['pending', 'paid', 'processing'].includes(currentStatus) && ['admin', 'cliente'].includes(requestingUserRole)) {
            stockRestoreRequired = true;
        }

        // Eseguo aggiornamento e ripristino stock (se necessario)
        try {
            await client.query('BEGIN');

            // Aggiorno ordine
            const updateQuery = `UPDATE orders
                                 SET ${updateFields.join(', ')}
                                 WHERE order_id = $${paramIndex} RETURNING *`;
            await client.query(updateQuery, queryParams);

            // Ripristino stock (se necessario)
            if (stockRestoreRequired) {
                const itemsToRestore = await client.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
                const restorePromises = itemsToRestore.rows.map(item =>
                    client.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2', [item.quantity, item.product_id])
                );
                await Promise.all(restorePromises);
            }

            await client.query('COMMIT');

            const finalOrderResult = await db.query(
                `SELECT o.*, u.full_name as customer_full_name, u.email as customer_email
                 FROM orders o
                          JOIN users u ON o.customer_id = u.user_id
                 WHERE o.order_id = $1`, [orderId]
            );
            const finalOrder = finalOrderResult.rows[0];
            const finalItemsResult = await db.query(
                `SELECT oi.*,
                        p.name as product_name,
                        p.sku as product_sku,
                        p.image_url as product_image_url,
                        u.shop_name as artisan_shop_name
                 FROM order_items oi
                          JOIN products p ON oi.product_id = p.product_id
                          JOIN users u ON oi.artisan_id = u.user_id
                 WHERE oi.order_id = $1
                 ORDER BY oi.order_item_id`, [orderId]
            );
            finalOrder.items = finalItemsResult.rows;

            res.json(finalOrder);

        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

    } catch (error) {
        if (!client.released) client.release();
        console.error(`Errore nell'aggiornare lo stato dell'ordine ${orderId}:`, error);
        res.status(500).json({message: 'Errore del server durante l\'aggiornamento dello stato dell\'ordine.'});
    }
});

export default router;