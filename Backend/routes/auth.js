import express from 'express';
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Autenticazione
 *   description: Operazioni di registrazione e login utenti.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthRegister:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email univoca dell'utente.
 *           example: mario.rossi@email.com
 *         password:
 *           type: string
 *           format: password
 *           description: Password dell'utente (min. 8 caratteri consigliati).
 *           example: passwordSicura123
 *         role:
 *           type: string
 *           enum: [cliente, artigiano] # Escludiamo 'admin' dalla registrazione pubblica
 *           description: Ruolo dell'utente (cliente o artigiano).
 *           example: cliente
 *         full_name:
 *           type: string
 *           description: Nome completo dell'utente (richiesto per clienti e artigiani).
 *           example: Mario Rossi
 *         shop_name:
 *           type: string
 *           description: Nome del negozio (richiesto solo se role='artigiano').
 *           example: Creazioni Artigianali Rossi
 *         shop_description:
 *           type: string
 *           description: Descrizione del negozio (opzionale, solo per artigiani).
 *           example: Prodotti unici fatti a mano con passione.
 *     AuthLogin:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Email dell'utente registrato.
 *           example: mario.rossi@email.com
 *         password:
 *           type: string
 *           format: password
 *           description: Password dell'utente registrato.
 *           example: passwordSicura123
 *     AuthResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Messaggio di conferma.
 *           example: Login effettuato con successo
 *         token:
 *           type: string
 *           description: Token JWT per le richieste autenticate.
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         user:
 *           type: object
 *           properties:
 *             user_id:
 *               type: integer
 *               description: ID univoco dell'utente.
 *               example: 1
 *             email:
 *               type: string
 *               format: email
 *               description: Email dell'utente.
 *               example: mario.rossi@email.com
 *             role:
 *               type: string
 *               enum: [cliente, artigiano, admin]
 *               description: Ruolo dell'utente.
 *               example: cliente
 *             full_name:
 *                type: string
 *                description: Nome completo dell'utente.
 *                example: Mario Rossi
 *     ErrorResponse:
 *        type: object
 *        properties:
 *          message:
 *            type: string
 *            description: Descrizione dell'errore.
 *            example: Credenziali errate
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registra un nuovo utente (cliente o artigiano).
 *     tags: [Autenticazione]
 *     description: Crea un nuovo account utente nella piattaforma. Richiede email, password, ruolo e nome completo. Se il ruolo è 'artigiano', è richiesto anche il nome del negozio.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRegister'
 *     responses:
 *       '201':
 *         description: Utente registrato con successo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Registrazione effettuata con successo
 *                 user:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                       example: 10
 *                     email:
 *                       type: string
 *                       example: nuovo.utente@email.com
 *                     role:
 *                       type: string
 *                       example: cliente
 *       '400':
 *         description: Richiesta non valida (es. email già in uso, dati mancanti).
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
router.post('/register', async (req, res) => {
    try {
        const { email, password, role, full_name, shop_name, shop_description } = req.body;

        // Validazione
        if (!email || !password || !role || !full_name) {
            return res.status(400).json({ message: 'Email, password, ruolo e nome completo sono obbligatori.' });
        }
        if (role === 'artigiano' && !shop_name) {
            return res.status(400).json({ message: 'Il nome del negozio è obbligatorio per gli artigiani.' });
        }
        if (!['cliente', 'artigiano'].includes(role)) {
            return res.status(400).json({ message: 'Ruolo non valido. Scegliere tra "cliente" o "artigiano".' });
        }

        // Verifico se l'email sia già in uso
        const userCheck = await db.query('SELECT user_id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Email già registrata. Effettua il login.' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Inserisco nuovo utente
        const result = await db.query(
            `INSERT INTO users (email, password_hash, role, full_name, shop_name, shop_description)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING user_id, email, role`,
            [email, password_hash, role, full_name, (role === 'artigiano' ? shop_name : null), (role === 'artigiano' ? shop_description : null)]
        );

        res.status(201).json({
            message: 'Registrazione effettuata con successo',
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Errore durante la registrazione:", error);
        res.status(500).json({ message: 'Errore del server durante la registrazione.' });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Effettua il login di un utente esistente.
 *     tags: [Autenticazione]
 *     description: Autentica un utente tramite email e password e restituisce un token JWT se le credenziali sono corrette.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLogin'
 *     responses:
 *       '200':
 *         description: Login effettuato con successo. Restituisce token JWT e informazioni utente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       '401':
 *         description: Autenticazione fallita (credenziali errate).
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
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email e password sono obbligatorie.' });
        }

        // Verifico se l'utente esiste
        const result = await db.query('SELECT user_id, email, password_hash, role, full_name FROM users WHERE email = $1 AND is_active = TRUE', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Credenziali non valide.' });
        }

        const user = result.rows[0];

        // Verifica password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenziali non valide.' });
        }

        // Genero Token JWT
        const payload = {
            userId: user.user_id,
            email: user.email,
            role: user.role
        };
        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login effettuato con successo',
            token,
            user: {
                user_id: user.user_id,
                email: user.email,
                role: user.role,
                full_name: user.full_name
            }
        });
    } catch (error) {
        console.error("Errore durante il login:", error);
        res.status(500).json({ message: 'Errore del server durante il login.' });
    }
});

/**
 * @swagger
 * /api/auth/verify-token:
 *   post:
 *     summary: Verifica la validità di un token JWT.
 *     tags: [Autenticazione]
 *     description: Controlla se un token JWT fornito è ancora valido (non scaduto e firmato correttamente).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Il token JWT da verificare.
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJjbGllbnRlIiwiaWF0IjoxNj..."
 *     responses:
 *       '200':
 *         description: Il token è valido.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *                   description: Il payload decodificato del token (contenente user_id, role, ecc.).
 *                   properties:
 *                      userId:
 *                          type: integer
 *                          example: 1
 *                      role:
 *                          type: string
 *                          example: cliente
 *                      iat:
 *                          type: integer
 *                          example: 1678886400
 *                      exp:
 *                          type: integer
 *                          example: 1678890000
 *       '400':
 *         description: Richiesta malformata (es. token mancante nel body).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Token mancante nel body."
 *       '401':
 *         description: Il token non è valido (scaduto o malformato).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 reason:
 *                   type: string
 *                   enum: [expired, invalid]
 *                   example: expired
 *                 message:
 *                   type: string
 *                   example: "Token scaduto."
 *       '500':
 *         description: Errore interno del server durante la verifica.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Errore del server durante la verifica del token."
 */
router.post('/verify-token', (req, res) => {

    if (!req.body || !req.body.token) return res.status(400).json({ valid: false, message: 'Token mancante nel body.' });

    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ valid: false, message: 'Token mancante nel corpo della richiesta.' });
    }

    try {
        jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
            if (err) {
                let reason = 'invalid';
                let message = 'Token non valido o malformato.';
                if (err.name === 'TokenExpiredError') {
                    reason = 'expired';
                    message = 'Token scaduto.';
                }
                return res.status(401).json({ valid: false, reason: reason, message: message });
            }

            res.status(200).json({ valid: true, user: userPayload });
        });
    } catch (error) {
        console.error("Errore durante la verifica del token:", error);
        res.status(500).json({ valid: false, message: 'Errore del server durante la verifica del token.' });
    }
});

export default router;