import express from 'express';
import db from '../db/database.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Categorie
 *   description: API per la gestione delle categorie di prodotti.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         category_id:
 *           type: integer
 *           description: ID univoco della categoria.
 *           example: 1
 *         name:
 *           type: string
 *           description: Nome della categoria.
 *           example: "Ceramiche"
 *         description:
 *           type: string
 *           nullable: true
 *           description: Descrizione della categoria.
 *           example: "Prodotti realizzati in ceramica."
 *         parent_category_id:
 *           type: integer
 *           nullable: true
 *           description: ID della categoria genitore (per creare gerarchie).
 *           example: null
 *         # Potremmo aggiungere campi derivati come il nome della categoria padre
 *         # parent_category_name:
 *         #   type: string
 *         #   nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data di creazione.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data ultimo aggiornamento.
 *
 *     CategoryCreate:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Nome della nuova categoria (deve essere univoco).
 *           example: "Tessuti"
 *         description:
 *           type: string
 *           description: Descrizione (opzionale).
 *           example: "Sciarpe, tovaglie e altri prodotti tessili."
 *         parent_category_id:
 *           type: integer
 *           description: ID della categoria genitore (opzionale). Se fornito, deve esistere.
 *           example: 2
 *
 *     CategoryUpdate:
 *       type: object
 *       description: Campi aggiornabili per una categoria. Almeno un campo deve essere fornito.
 *       properties:
 *         name:
 *           type: string
 *           description: Nuovo nome della categoria (deve essere univoco).
 *           example: "Tessuti Pregiati"
 *         description:
 *           type: string
 *           description: Nuova descrizione.
 *           example: "Sciarpe in seta, tovaglie in lino e altri prodotti tessili di alta qualità."
 *         parent_category_id:
 *           type: integer
 *           nullable: true # Permette di impostare a null per rimuovere il genitore
 *           description: Nuovo ID della categoria genitore. Deve esistere o essere null. Non può essere l'ID della categoria stessa.
 *           example: null
 *
 *   parameters:
 *      categoryIdParam:
 *          in: path
 *          name: id
 *          required: true
 *          schema:
 *              type: integer
 *          description: ID numerico della categoria.
 *          example: 1
 *
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Ottiene la lista di tutte le categorie.
 *     tags: [Categorie]
 *     description: Recupera un elenco di tutte le categorie disponibili, utile per popolare filtri o menu di navigazione.
 *     responses:
 *       '200':
 *         description: Lista delle categorie recuperata con successo.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       '500':
 *         description: Errore interno del server.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', async (req, res) => {
    try {
        // Recupera tutte le categorie, ordinate per nome
        const result = await db.query(
            'SELECT category_id, name, description, parent_category_id, created_at, updated_at FROM categories ORDER BY name ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Errore nel recuperare le categorie:", error);
        res.status(500).json({ message: 'Errore del server nel recuperare le categorie.' });
    }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Ottiene i dettagli di una singola categoria.
 *     tags: [Categorie]
 *     description: Recupera le informazioni dettagliate di una categoria specifica tramite il suo ID.
 *     parameters:
 *       - $ref: '#/components/parameters/categoryIdParam'
 *     responses:
 *       '200':
 *         description: Dettagli categoria recuperati con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       '404':
 *         description: Categoria non trovata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Errore interno del server.
 */
router.get('/:id', async (req, res) => {
    const categoryId = parseInt(req.params.id, 10);

    if (isNaN(categoryId)) {
        return res.status(400).json({ message: 'ID categoria non valido.' });
    }

    try {
        const result = await db.query(
            'SELECT category_id, name, description, parent_category_id, created_at, updated_at FROM categories WHERE category_id = $1',
            [categoryId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Categoria non trovata.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Errore nel recuperare la categoria ${categoryId}:`, error);
        res.status(500).json({ message: 'Errore del server nel recuperare la categoria.' });
    }
});

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Crea una nuova categoria.
 *     tags: [Categorie]
 *     description: Aggiunge una nuova categoria al sistema. Accessibile agli amministratori e agli artigiani.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryCreate'
 *     responses:
 *       '201':
 *         description: Categoria creata con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       '400':
 *         description: Dati di input non validi (es. nome mancante, nome duplicato, parent_id non esistente).
 *       '401':
 *         description: Non autorizzato (token mancante o non valido). *       '403':
 *         description: Accesso negato (l'utente non è admin o artigiano).
 *       '500':
 *         description: Errore interno del server.
 */
router.post('/', authenticateToken, authorizeRoles('admin', 'artigiano'), async (req, res) => {
    const { name, description, parent_category_id } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'Il nome della categoria è obbligatorio.' });
    }

    try {
        if (parent_category_id) {
            const parentCheck = await db.query('SELECT 1 FROM categories WHERE category_id = $1', [parent_category_id]);
            if (parentCheck.rows.length === 0) {
                return res.status(400).json({ message: `Categoria genitore con ID ${parent_category_id} non trovata.` });
            }
        }

        const result = await db.query(
            'INSERT INTO categories (name, description, parent_category_id) VALUES ($1, $2, $3) RETURNING *',
            [name, description, parent_category_id]
        );
        res.status(201).json(result.rows[0]);

    } catch (error) {
        if (!(error.code === '23505' && error.constraint === 'categories_name_key')) console.error("Errore nella creazione della categoria:", error);
        if (error.code === '23505' && error.constraint === 'categories_name_key') { // Nome duplicato
            return res.status(400).json({ message: `Il nome della categoria "${name}" esiste già.` });
        }
        res.status(500).json({ message: 'Errore del server durante la creazione della categoria.' });
    }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Aggiorna una categoria esistente.
 *     tags: [Categorie]
 *     description: Modifica i dettagli di una categoria. Accessibile agli amministratori e agli artigiani.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/categoryIdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryUpdate'
 *     responses:
 *       '200':
 *         description: Categoria aggiornata con successo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       '400':
 *         description: Dati di input non validi (es. nome duplicato, parent_id non esistente, parent_id uguale a id).
 *       '401':
 *         description: Non autorizzato. *       '403':
 *         description: Accesso negato.
 *       '404':
 *         description: Categoria non trovata.
 *       '500':
 *         description: Errore interno del server.
 */
router.put('/:id', authenticateToken, authorizeRoles('admin', 'artigiano'), async (req, res) => {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
        return res.status(400).json({ message: 'ID categoria non valido.' });
    }

    const { name, description, parent_category_id } = req.body;

    // Verifico che almeno un campo sia presente
    if (name === undefined && description === undefined && parent_category_id === undefined) {
        return res.status(400).json({ message: 'Nessun dato fornito per l\'aggiornamento.' });
    }

    // Impedisco che una categoria sia genitore di se stessa
    if (parent_category_id !== undefined && parent_category_id === categoryId) {
        return res.status(400).json({ message: 'Una categoria non può essere genitore di se stessa.' });
    }

    try {
        // Verifico esistenza categoria
        const currentCat = await db.query('SELECT * FROM categories WHERE category_id = $1', [categoryId]);
        if (currentCat.rows.length === 0) {
            return res.status(404).json({ message: 'Categoria non trovata.' });
        }

        // Verifico esistenza nuovo parent_category_id (se fornito e non null)
        if (parent_category_id) {
            const parentCheck = await db.query('SELECT 1 FROM categories WHERE category_id = $1', [parent_category_id]);
            if (parentCheck.rows.length === 0) {
                return res.status(400).json({ message: `Nuova categoria genitore con ID ${parent_category_id} non trovata.` });
            }
        }

        // Costruisco query
        const fieldsToUpdate = [];
        const queryParams = [];
        let paramIndex = 1;

        const addUpdateField = (fieldName, value) => {
            if (fieldName === 'parent_category_id') {
                if (value !== undefined) {
                    fieldsToUpdate.push(`${fieldName} = $${paramIndex++}`);
                    queryParams.push(value);
                }
            } else if (value !== undefined) {
                fieldsToUpdate.push(`${fieldName} = $${paramIndex++}`);
                queryParams.push(value);
            }
        };

        addUpdateField('name', name);
        addUpdateField('description', description);
        addUpdateField('parent_category_id', parent_category_id);

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ message: 'Nessun dato valido per l\'aggiornamento.' });
        }

        queryParams.push(categoryId);

        const updateQuery = `
            UPDATE categories
            SET ${fieldsToUpdate.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE category_id = $${paramIndex}
             RETURNING *`;

        const result = await db.query(updateQuery, queryParams);
        res.json(result.rows[0]);

    } catch (error) {
        if (!(error.code === '23505' && error.constraint === 'categories_name_key')) console.error(`Errore nell'aggiornare la categoria ${categoryId}:`, error);
        if (error.code === '23505' && error.constraint === 'categories_name_key') {
            const conflictingName = req.body.name || 'specificato';
            return res.status(400).json({ message: `Il nome della categoria "${conflictingName}" esiste già.` });
        }
        res.status(500).json({ message: 'Errore del server durante l\'aggiornamento della categoria.' });
    }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Elimina una categoria.
 *     tags: [Categorie]
 *     description: Elimina una categoria dal sistema. Accessibile solo agli amministratori.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/categoryIdParam'
 *     responses:
 *       '204':
 *         description: Categoria eliminata con successo (nessun contenuto).
 *       '401':
 *         description: Non autorizzato.
 *       '403':
 *         description: Accesso negato.
 *       '404':
 *         description: Categoria non trovata.
 *       '500':
 *         description: Errore interno del server.
 */
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
        return res.status(400).json({ message: 'ID categoria non valido.' });
    }

    try {
        // Verifico esistenza
        const checkResult = await db.query('SELECT 1 FROM categories WHERE category_id = $1', [categoryId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: 'Categoria non trovata.' });
        }

        // Eseguo
        await db.query('DELETE FROM categories WHERE category_id = $1', [categoryId]);

        res.status(204).send(); // Successo

    } catch (error) {
        console.error(`Errore nell'eliminare la categoria ${categoryId}:`, error);
        res.status(500).json({ message: 'Errore del server durante l\'eliminazione della categoria.' });
    }
});


export default router;