import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Utenti
 *   description: Gestione degli utenti (visualizzazione e aggiornamento profili).
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         user_id:
 *           type: integer
 *           description: ID univoco dell'utente.
 *           example: 1
 *         email:
 *           type: string
 *           format: email
 *           description: Email dell'utente.
 *           example: mario.rossi@email.com
 *         role:
 *           type: string
 *           enum: [cliente, artigiano, admin]
 *           description: Ruolo dell'utente.
 *           example: artigiano
 *         full_name:
 *           type: string
 *           description: Nome completo dell'utente.
 *           example: Mario Rossi
 *         shop_name:
 *           type: string
 *           nullable: true
 *           description: Nome del negozio (solo per artigiani).
 *           example: Creazioni Artigianali Rossi
 *         shop_description:
 *           type: string
 *           nullable: true
 *           description: Descrizione del negozio (solo per artigiani).
 *           example: Prodotti unici fatti a mano.
 *         address:
 *           type: string
 *           nullable: true
 *           description: Indirizzo dell'utente/negozio.
 *           example: Via Roma 1, 10100 Torino
 *         phone_number:
 *           type: string
 *           nullable: true
 *           description: Numero di telefono.
 *           example: "+39 333 1234567"
 *         is_active:
 *           type: boolean
 *           description: Indica se l'account utente è attivo.
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data e ora di creazione dell'utente.
 *           example: "2023-10-27T10:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data e ora dell'ultimo aggiornamento dell'utente.
 *           example: "2023-10-27T11:30:00Z"
 *     UserUpdate:
 *       type: object
 *       properties:
 *         full_name:
 *           type: string
 *           description: Nuovo nome completo dell'utente.
 *           example: Mario Bianchi
 *         shop_name:
 *           type: string
 *           description: Nuovo nome del negozio (solo per artigiani).
 *           example: Bottega Creativa Bianchi
 *         shop_description:
 *           type: string
 *           description: Nuova descrizione del negozio (solo per artigiani).
 *           example: Oggetti unici in legno.
 *         address:
 *           type: string
 *           description: Nuovo indirizzo.
 *           example: Corso Italia 5, 20100 Milano
 *         phone_number:
 *           type: string
 *           description: Nuovo numero di telefono.
 *           example: "+39 333 9876543"
 *     CambioPassword:
 *       type: object
 *       required:
 *         - password_attuale
 *         - nuova_password
 *       properties:
 *         password_attuale:
 *           type: string
 *           format: password
 *           description: Password attuale dell'utente per conferma.
 *           example: passwordVecchia123
 *         nuova_password:
 *           type: string
 *           format: password
 *           description: Nuova password dell'utente (minimo 8 caratteri consigliati).
 *           example: passwordNuova456
 *     # ErrorResponse schema è già definito in auth.js, Swagger lo riutilizzerà
 *
 *   securitySchemes:
 *      bearerAuth: # Assicurati che sia definito qui o globalmente in index.js
 *          type: http
 *          scheme: bearer
 *          bearerFormat: JWT
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Ottiene la lista di tutti gli utenti.
 *     tags: [Utenti]
 *     description: Recupera un elenco di tutti gli utenti registrati nel sistema. Accessibile solo agli amministratori.
 *     security:
 *       - bearerAuth: [] # Indica che questo endpoint richiede il token JWT
 *     responses:
 *       '200':
 *         description: Lista di utenti recuperata con successo.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 # Seleziona solo alcuni campi per la lista generale
 *                 type: object
 *                 properties:
 *                   user_id:
 *                     type: integer
 *                     example: 1
 *                   email:
 *                     type: string
 *                     example: mario.rossi@email.com
 *                   role:
 *                     type: string
 *                     example: artigiano
 *                   full_name:
 *                     type: string
 *                     example: Mario Rossi
 *                   shop_name:
 *                     type: string
 *                     nullable: true
 *                     example: Creazioni Artigianali Rossi
 *                   is_active:
 *                     type: boolean
 *                     example: true
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2023-10-27T10:00:00Z"
 *       '401':
 *         description: Non autorizzato (token mancante o non valido).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: Accesso negato (l'utente non è admin).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Errore interno del server.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await db.query(
            'SELECT user_id, email, role, full_name, shop_name, is_active, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Errore nel recuperare la lista utenti:", error);
        res.status(500).json({message: 'Errore del server nel recuperare gli utenti.'});
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Ottiene i dettagli di un utente specifico.
 *     tags: [Utenti]
 *     description: Recupera le informazioni dettagliate di un utente tramite il suo ID. Accessibile solo all'utente stesso o a un amministratore.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           description: ID numerico dell'utente da recuperare.
 *           example: 5
 *     responses:
 *       '200':
 *         description: Dettagli utente recuperati con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User' # Usa lo schema User completo
 *       '401':
 *         description: Non autorizzato (token mancante o non valido).
 *       '403':
 *         description: Accesso negato (utente non autorizzato a vedere questo profilo).
 *       '404':
 *         description: Utente non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/:id', authenticateToken, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;

    // ID
    if (isNaN(targetUserId)) {
        return res.status(400).json({message: 'ID utente non valido.'});
    }

    // Verifica permessi (posso modificare il mio profile ma non quello degli altri, a meno che io non sia admin)
    if (requestingUserRole !== 'admin' && requestingUserId !== targetUserId) {
        return res.status(403).json({message: 'Accesso negato. Non puoi visualizzare questo profilo.'});
    }

    try {
        // Recupero dettagli utente
        const result = await db.query(
            'SELECT user_id, email, role, full_name, shop_name, shop_description, address, phone_number, is_active, created_at, updated_at FROM users WHERE user_id = $1',
            [targetUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({message: 'Utente non trovato.'});
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore nel recuperare l'utente ${targetUserId}:`, error);
        res.status(500).json({message: 'Errore del server nel recuperare l\'utente.'});
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Aggiorna i dati di un utente specifico.
 *     tags: [Utenti]
 *     description: Modifica le informazioni del profilo di un utente (es. nome, indirizzo, dettagli negozio). Accessibile solo all'utente stesso o a un amministratore. L'email e il ruolo non possono essere modificati tramite questa route.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           description: ID numerico dell'utente da aggiornare.
 *           example: 5
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate' # Schema con i campi aggiornabili
 *     responses:
 *       '200':
 *         description: Utente aggiornato con successo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Utente aggiornato con successo
 *                 user:
 *                   $ref: '#/components/schemas/User' # Ritorna l'utente aggiornato
 *       '400':
 *         description: Richiesta non valida (es. ID non numerico, dati mancanti/errati).
 *       '401':
 *         description: Non autorizzato (token mancante o non valido).
 *       '403':
 *         description: Accesso negato (utente non autorizzato ad aggiornare questo profilo).
 *       '404':
 *         description: Utente non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.put('/:id', authenticateToken, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;

    if (isNaN(targetUserId)) {
        return res.status(400).json({message: 'ID utente non valido.'});
    }

    // Verifica permessi (posso modificare il mio profile ma non quello degli altri, a meno che io non sia admin)
    if (requestingUserRole !== 'admin' && requestingUserId !== targetUserId) {
        return res.status(403).json({message: 'Accesso negato. Non puoi modificare questo profilo.'});
    }

    const {full_name, shop_name, shop_description, address, phone_number} = req.body;

    // Validazione
    if (!full_name && !shop_name && !shop_description && !address && !phone_number) {
        return res.status(400).json({message: 'Nessun dato fornito per l\'aggiornamento.'});
    }

    try {
        // Recupero utente e dati
        const currentUserResult = await db.query('SELECT * FROM users WHERE user_id = $1', [targetUserId]);
        if (currentUserResult.rows.length === 0) {
            return res.status(404).json({message: 'Utente non trovato.'});
        }
        const currentUser = currentUserResult.rows[0];

        const newFullName = full_name !== undefined ? full_name : currentUser.full_name;
        const newShopName = currentUser.role === 'artigiano' && shop_name !== undefined ? shop_name : currentUser.shop_name;
        const newShopDescription = currentUser.role === 'artigiano' && shop_description !== undefined ? shop_description : currentUser.shop_description;
        const newAddress = address !== undefined ? address : currentUser.address;
        const newPhoneNumber = phone_number !== undefined ? phone_number : currentUser.phone_number;

        // UPDATE
        const result = await db.query(
            `UPDATE users
             SET full_name        = $1,
                 shop_name        = $2,
                 shop_description = $3,
                 address          = $4,
                 phone_number     = $5
             WHERE user_id = $6
             RETURNING user_id, email, role, full_name, shop_name, shop_description, address, phone_number, is_active, created_at, updated_at`,
            [newFullName, newShopName, newShopDescription, newAddress, newPhoneNumber, targetUserId]
        );

        res.json({
            message: 'Utente aggiornato con successo',
            user: result.rows[0]
        });
    } catch (error) {
        console.error(`Errore nell'aggiornare l'utente ${targetUserId}:`, error);
        res.status(500).json({message: 'Errore del server durante l\'aggiornamento dell\'utente.'});
    }
});

/**
 * @swagger
 * /api/users/{id}/cambia-password:
 *   put:
 *     summary: Cambia la password di un utente specifico.
 *     tags: [Utenti]
 *     description: Permette di cambiare la password dell'utente fornendo la password attuale per conferma. Accessibile solo all'utente stesso o a un amministratore.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           description: ID numerico dell'utente di cui cambiare la password.
 *           example: 5
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CambioPassword'
 *     responses:
 *       '200':
 *         description: Password cambiata con successo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password cambiata con successo
 *       '400':
 *         description: Richiesta non valida (es. ID non numerico, dati mancanti, password troppo corta).
 *       '401':
 *         description: Non autorizzato (token mancante o non valido, password attuale errata).
 *       '403':
 *         description: Accesso negato (utente non autorizzato a cambiare questa password).
 *       '404':
 *         description: Utente non trovato.
 *       '500':
 *         description: Errore interno del server.
 */
router.put('/:id/cambia-password', authenticateToken, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const requestingUserId = req.user.userId;
    const requestingUserRole = req.user.role;

    if (isNaN(targetUserId)) {
        return res.status(400).json({message: 'ID utente non valido.'});
    }

    // Verifica permessi
    if (requestingUserRole !== 'admin' && requestingUserId !== targetUserId) {
        return res.status(403).json({message: 'Accesso negato. Non puoi cambiare la password di questo utente.'});
    }

    const {password_attuale, nuova_password} = req.body;

    // Validazione
    if (!password_attuale || !nuova_password) {
        return res.status(400).json({message: 'Password attuale e nuova password sono obbligatorie.'});
    }

    if (nuova_password.length < 8) {
        return res.status(400).json({message: 'La nuova password deve essere di almeno 8 caratteri.'});
    }

    try {
        // Utente attuale
        const userResult = await db.query('SELECT user_id, password_hash FROM users WHERE user_id = $1', [targetUserId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({message: 'Utente non trovato.'});
        }
        const user = userResult.rows[0];

        // Verifica password attuale
        if (requestingUserRole !== 'admin' || requestingUserId === targetUserId) {
            const isCurrentPasswordValid = await bcrypt.compare(password_attuale, user.password_hash);
            if (!isCurrentPasswordValid) {
                return res.status(401).json({message: 'Password attuale non corretta.'});
            }
        }

        // Hash nuova password
        const salt = await bcrypt.genSalt(10);
        const nuova_password_hash = await bcrypt.hash(nuova_password, salt);

        // Aggiornamento password nel database
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
            [nuova_password_hash, targetUserId]
        );

        res.json({
            message: 'Password cambiata con successo'
        });
    } catch (error) {
        console.error(`Errore nel cambiare la password dell'utente ${targetUserId}:`, error);
        res.status(500).json({message: 'Errore del server durante il cambio password.'});
    }
});

export default router;