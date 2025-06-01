import express from 'express';
import db from '../db/database.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Pagamenti
 *   description: API per la registrazione e visualizzazione dei pagamenti degli ordini.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         payment_id:
 *           type: integer
 *         order_id:
 *           type: integer
 *         payment_date:
 *           type: string
 *           format: date-time
 *         amount:
 *           type: number
 *           format: float
 *         payment_method:
 *           type: string
 *           enum: [credit_card, paypal, bank_transfer, other]
 *           example: paypal
 *         transaction_id:
 *           type: string
 *           nullable: true
 *           description: ID univoco della transazione fornito dal provider di pagamento.
 *           example: "PAYID-L2XYZABC123"
 *         status:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *           example: completed
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         # Campi aggiuntivi utili (opzionali)
 *         order_status:
 *            type: string
 *            description: Stato corrente dell'ordine associato.
 *            example: paid
 *
 *     PaymentCreateInput:
 *       type: object
 *       required:
 *         - order_id
 *         - amount
 *         - payment_method
 *         - status
 *       properties:
 *         order_id:
 *           type: integer
 *           description: ID dell'ordine a cui associare il pagamento.
 *           example: 101
 *         amount:
 *           type: number
 *           format: float
 *           minimum: 0
 *           description: Importo del pagamento. Dovrebbe corrispondere al totale dell'ordine.
 *           example: 120.50
 *         payment_method:
 *           type: string
 *           enum: [credit_card, paypal, bank_transfer, other]
 *           description: Metodo di pagamento utilizzato.
 *           example: paypal
 *         transaction_id:
 *           type: string
 *           description: ID della transazione esterna (opzionale ma fortemente consigliato).
 *           example: "PAYID-L2XYZABC123"
 *         status:
 *           type: string
 *           enum: [pending, completed, failed, refunded] # Solitamente si registra 'completed' o 'failed'
 *           description: Esito del pagamento.
 *           example: completed
 *         payment_date:
 *            type: string
 *            format: date-time
 *            description: Data e ora del pagamento (opzionale, default a CURRENT_TIMESTAMP).
 *
 *   parameters:
 *      paymentIdParam:
 *          in: path
 *          name: id
 *          required: true
 *          schema:
 *              type: integer
 *          description: ID numerico del pagamento.
 *          example: 55
 *      paymentOrderIdParam:
 *          in: path
 *          name: order_id
 *          required: true
 *          schema:
 *              type: integer
 *          description: ID numerico dell'ordine per cui cercare il pagamento.
 *          example: 101
 *      # Filtri per GET /payments
 *      paymentStatusFilter:
 *          in: query
 *          name: status
 *          schema:
 *              type: string
 *              enum: [pending, completed, failed, refunded]
 *          description: Filtra i pagamenti per stato.
 *      paymentMethodFilter:
 *          in: query
 *          name: method
 *          schema:
 *              type: string
 *              enum: [credit_card, paypal, bank_transfer, other]
 *          description: Filtra i pagamenti per metodo.
 *      paymentStartDateFilter:
 *          in: query
 *          name: startDate
 *          schema:
 *              type: string
 *              format: date
 *          description: Filtra pagamenti a partire da questa data (YYYY-MM-DD).
 *      paymentEndDateFilter:
 *          in: query
 *          name: endDate
 *          schema:
 *              type: string
 *              format: date
 *          description: Filtra pagamenti fino a questa data (YYYY-MM-DD).
 *
 */

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Registra un nuovo pagamento per un ordine.
 *     tags: [Pagamenti]
 *     description: |
 *       Crea un nuovo record di pagamento associato a un ordine.
 *       Se il pagamento ha stato 'completed', aggiorna anche lo stato dell'ordine a 'paid'.
 *       Accessibile ai clienti per i propri ordini e agli amministratori per qualsiasi ordine.
 *       Utilizza una transazione per garantire la coerenza tra le tabelle `payments` e `orders`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentCreateInput'
 *     responses:
 *       '201':
 *         description: Pagamento registrato con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       '400':
 *         description: Dati non validi (es. ordine non trovato, importo non corrispondente, stato ordine non idoneo).
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (non sei il proprietario dell'ordine).
 *       '409':
 *          description: Conflitto (es. pagamento già esistente per l'ordine o transaction_id duplicato).
 *       '500':
 *         description: Errore interno del server.
 */
router.post('/', authenticateToken, async (req, res) => {
    const {order_id, amount, payment_method, transaction_id, status, payment_date} = req.body;
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;
    const validStatuses = ['pending', 'completed', 'failed', 'refunded'];
    const validMethods = ['credit_card', 'paypal', 'bank_transfer', 'other'];

    // Validazione base
    if (order_id === undefined || amount === undefined || !payment_method || !status) {
        return res.status(400).json({message: 'order_id, amount, payment_method e status sono obbligatori.'});
    }
    if (amount < 0) {
        return res.status(400).json({message: 'L\'importo non può essere negativo.'});
    }
    if (!validMethods.includes(payment_method)) {
        return res.status(400).json({message: 'Metodo di pagamento non valido.'});
    }
    if (!validStatuses.includes(status)) {
        return res.status(400).json({message: 'Stato del pagamento non valido.'});
    }

    const client = await db.getClient();

    try {
        await client.query('BEGIN');        // Verifica l'ordine e i permessi di accesso
        const orderResult = await client.query(
            'SELECT order_id, customer_id, total_amount, status FROM orders WHERE order_id = $1 FOR UPDATE', // Lock della riga ordine
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            throw new Error(`Ordine con ID ${order_id} non trovato.`);
        }
        const order = orderResult.rows[0];

        // Verifica che l'utente sia autorizzato a pagare questo ordine
        // Gli admin possono pagare qualsiasi ordine, i clienti solo i propri
        if (requestingUserRole !== 'admin' && order.customer_id !== requestingUserId) {
            throw new Error(`Non sei autorizzato a effettuare il pagamento per questo ordine.`);
        }

        // Verifico coerenza importo
        if (parseFloat(order.total_amount) !== parseFloat(amount)) {
            // console.warn(`Attenzione: importo pagamento (${amount}) diverso da totale ordine ${order_id} (${order.total_amount})`);
            throw new Error(`L'importo del pagamento (${amount}) non corrisponde al totale dell'ordine (${order.total_amount}).`);
        }

        // Verifico se l'ordine sia in uno stato idoneo per ricevere un pagamento
        if (!['pending'].includes(order.status) && status === 'completed') {
            throw new Error(`Non è possibile registrare un pagamento completato per un ordine nello stato '${order.status}'.`);
        }

        // Inserisco il pagamento
        const paymentInsertResult = await client.query(
            `INSERT INTO payments (order_id, payment_date, amount, payment_method, transaction_id, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [order_id, payment_date || new Date(), amount, payment_method, transaction_id, status]
        );
        const newPayment = paymentInsertResult.rows[0];

        // Aggiorno lo stato
        if (status === 'completed') {
            await client.query(
                `UPDATE orders
                 SET status = 'paid',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE order_id = $1`,
                [order_id]
            );
            // console.log(`Ordine ${order_id} aggiornato a stato 'paid'.`);
        }

        await client.query('COMMIT');

        newPayment.order_status = (status === 'completed') ? 'paid' : order.status;

        res.status(201).json(newPayment);

    } catch (error) {
        await client.query('ROLLBACK');

        let statusCode = 500;
        let errorMessage = 'Errore del server durante la registrazione del pagamento.';
        let logError = true;

        if (error.code === '23505') {
            statusCode = 409;
            logError = false;
            if (error.constraint === 'payments_order_id_key') {
                errorMessage = `Esiste già un pagamento registrato per l'ordine ${order_id}.`;
            } else if (error.constraint === 'payments_transaction_id_key') {
                errorMessage = `L'ID transazione "${transaction_id}" è già stato registrato.`;
            } else {
                errorMessage = `Violazione di un vincolo di unicità: ${error.constraint}`;
                logError = true;
            }
        } else if (error.code === '23503' && error.constraint === 'payments_order_id_fkey') {
            statusCode = 400;
            errorMessage = `Ordine con ID ${order_id} non trovato.`;
            logError = false;
        } else if (error.message.includes('Ordine con ID') && error.message.includes('non trovato')) {
            statusCode = 400;
            errorMessage = error.message;
            logError = false;
        } else if (error.message.includes('non corrisponde al totale dell\'ordine')) {
            statusCode = 400;
            errorMessage = error.message;
            logError = false;
        } else if (error.message.includes('Non è possibile registrare') && error.message.includes('nello stato')) {
            statusCode = 400;
            errorMessage = error.message;
            logError = false;
        } else if (error.message.includes('Non sei autorizzato a effettuare il pagamento')) {
            statusCode = 403;
            errorMessage = error.message;
            logError = false;
        }

        if (logError) console.error("Errore (non gestito specificamente) nella registrazione del pagamento:", error);

        res.status(statusCode).json({message: errorMessage});
    } finally {
        client.release();
    }
});


/**
 * @swagger
 * /api/payments/order/{order_id}:
 *   get:
 *     summary: Ottiene i dettagli del pagamento per un ordine specifico.
 *     tags: [Pagamenti]
 *     description: |
 *       Recupera le informazioni del pagamento associato a un dato ID ordine.
 *       Accessibile all'admin e al cliente proprietario dell'ordine.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/paymentOrderIdParam'
 *     responses:
 *       '200':
 *         description: Dettagli pagamento recuperati con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (non admin e non proprietario ordine).
 *       '404':
 *         description: Pagamento non trovato per l'ordine specificato.
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/order/:order_id', authenticateToken, async (req, res) => {
    const orderId = parseInt(req.params.order_id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;

    if (isNaN(orderId)) {
        return res.status(400).json({message: 'ID ordine non valido.'});
    }

    try {
        // Recupero il pagamento e l'ID cliente dell'ordine associato
        const query = `
            SELECT p.*, o.customer_id, o.status as order_status
            FROM payments p
                     JOIN orders o ON p.order_id = o.order_id
            WHERE p.order_id = $1`;
        const result = await db.query(query, [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({message: `Nessun pagamento trovato per l'ordine ${orderId}.`});
        }
        const payment = result.rows[0];

        // Verifica permessi: Admin o Cliente proprietario dell'ordine
        if (requestingUserRole !== 'admin' && payment.customer_id !== requestingUserId) {
            return res.status(403).json({message: 'Accesso negato. Non puoi visualizzare questo pagamento.'});
        }

        res.json(payment);

    } catch (error) {
        console.error(`Errore nel recuperare il pagamento per l'ordine ${orderId}:`, error);
        res.status(500).json({message: 'Errore del server nel recuperare il pagamento.'});
    }
});

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Ottiene i dettagli di un pagamento specifico tramite ID pagamento.
 *     tags: [Pagamenti]
 *     description: Recupera le informazioni di un pagamento tramite il suo `payment_id`. Accessibile solo agli amministratori.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/paymentIdParam'
 *     responses:
 *       '200':
 *         description: Dettagli pagamento recuperati con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (non admin).
 *       '404':
 *         description: Pagamento non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const paymentId = parseInt(req.params.id, 10);

    if (isNaN(paymentId)) {
        return res.status(400).json({message: 'ID pagamento non valido.'});
    }

    try {
        const query = `
            SELECT p.*, o.status as order_status
            FROM payments p
                     JOIN orders o ON p.order_id = o.order_id
            WHERE p.payment_id = $1`;
        const result = await db.query(query, [paymentId]);

        if (result.rows.length === 0) {
            return res.status(404).json({message: 'Pagamento non trovato.'});
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore nel recuperare il pagamento ${paymentId}:`, error);
        res.status(500).json({message: 'Errore del server nel recuperare il pagamento.'});
    }
});

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Ottiene la lista di tutti i pagamenti.
 *     tags: [Pagamenti]
 *     description: Recupera un elenco paginato e filtrabile di tutti i pagamenti registrati. Accessibile solo agli amministratori.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/paymentStatusFilter'
 *       - $ref: '#/components/parameters/paymentMethodFilter'
 *       - $ref: '#/components/parameters/paymentStartDateFilter'
 *       - $ref: '#/components/parameters/paymentEndDateFilter'
 *       - in: query
 *         name: orderId # Filtro aggiuntivo per cercare pagamenti di un ordine specifico
 *         schema:
 *             type: integer
 *         description: Filtra per ID ordine specifico.
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
 *         description: Numero di pagamenti per pagina.
 *     responses:
 *       '200':
 *         description: Lista pagamenti recuperata con successo.
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
 *                  payments:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Payment'
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato (non admin).
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const {status, method, startDate, endDate, orderId, page = 1, limit = 10} = req.query;

    const offset = (page - 1) * limit;
    let queryParams = [];
    let paramIndex = 1;
    let filters = [];

    // Filtri
    if (status) {
        filters.push(`p.status = $${paramIndex++}`);
        queryParams.push(status);
    }
    if (method) {
        filters.push(`p.payment_method = $${paramIndex++}`);
        queryParams.push(method);
    }
    if (startDate) {
        filters.push(`p.payment_date >= $${paramIndex++}`);
        queryParams.push(startDate);
    }
    if (endDate) {
        filters.push(`p.payment_date < ($${paramIndex++}::date + interval '1 day')`);
        queryParams.push(endDate);
    }
    if (orderId) {
        filters.push(`p.order_id = $${paramIndex++}`);
        queryParams.push(orderId);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    try {
        const countQuery = `SELECT COUNT(*)
                            FROM payments p ${whereClause}`;
        const countResult = await db.query(countQuery, queryParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limit);

        const dataQuery = `
            SELECT p.*, o.status as order_status
            FROM payments p
                     JOIN orders o ON p.order_id = o.order_id
                ${whereClause}
            ORDER BY p.payment_date DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        queryParams.push(limit, offset);

        const paymentsResult = await db.query(dataQuery, queryParams);

        res.json({
            totalItems,
            totalPages,
            currentPage: parseInt(page, 10),
            payments: paymentsResult.rows
        });

    } catch (error) {
        console.error("Errore nel recuperare i pagamenti:", error);
        res.status(500).json({message: 'Errore del server nel recuperare i pagamenti.'});
    }
});


export default router;