import { expect } from 'chai';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index.js';
import db from '../db/database.js';

let adminToken = '';
let adminUserId = null;
let testCategory1 = null;
let testCategory2 = null;

const adminUserData = {
    email: `test.admin.${Date.now()}@example.com`,
    password: 'adminPassword123',
    role: 'admin',
    full_name: 'Test Admin User',
};

const categoryData1 = {
    name: `Test Categoria ${Date.now()}`,
    description: 'Descrizione categoria 1',
};

const categoryData2 = {
    name: `Sub Categoria ${Date.now()}`,
    description: 'Descrizione sub categoria 2',
};


describe('Categories API (/api/categories)', () => {

    before(async () => {
        try {
            console.log('Pulizia DB prima dei test delle categorie...');
            await db.query('TRUNCATE TABLE payments, order_items, orders, products, categories, users RESTART IDENTITY CASCADE');
            console.log('Tabelle rilevanti pulite.');

            console.log('Creazione utente admin per test categorie...');
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(adminUserData.password, salt);
            const adminRes = await db.query(
                `INSERT INTO users (email, password_hash, role, full_name, is_active)
                 VALUES ($1, $2, $3, $4, TRUE) RETURNING user_id`,
                [adminUserData.email, password_hash, adminUserData.role, adminUserData.full_name]
            );
            adminUserId = adminRes.rows[0].user_id;
            console.log(`Utente admin creato con ID: ${adminUserId}`);

            console.log('Login admin per ottenere token...');
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: adminUserData.email, password: adminUserData.password })
                .expect(200);
            adminToken = loginRes.body.token;
            expect(adminToken).to.be.a('string');
            console.log('Token admin ottenuto.');

            console.log('Creazione categorie di test preliminari...');
            const cat1Res = await db.query(
                'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
                [categoryData1.name, categoryData1.description]
            );
            testCategory1 = cat1Res.rows[0];

            const cat2Res = await db.query(
                'INSERT INTO categories (name, description, parent_category_id) VALUES ($1, $2, $3) RETURNING *',
                [categoryData2.name, categoryData2.description, testCategory1.category_id]
            );
            testCategory2 = cat2Res.rows[0];
            console.log('Categorie di test create.');

        } catch (err) {
            console.error('Errore FATALE durante il setup dei test categorie:', err);
            process.exit(1);
        }
    });

    describe('GET /api/categories', () => {
        it('dovrebbe restituire la lista di tutte le categorie', async () => {
            const res = await request(app)
                .get('/api/categories')
                .expect(200);

            expect(res.body).to.be.an('array');
            expect(res.body.length).to.be.at.least(2);
            const names = res.body.map(cat => cat.name);
            expect(names).to.include(testCategory1.name);
            expect(names).to.include(testCategory2.name);
        });
    });

    describe('GET /api/categories/:id', () => {
        it('dovrebbe restituire i dettagli di una categoria specifica', async () => {
            const res = await request(app)
                .get(`/api/categories/${testCategory1.category_id}`)
                .expect(200);

            expect(res.body).to.be.an('object');
            expect(res.body.category_id).to.equal(testCategory1.category_id);
            expect(res.body.name).to.equal(testCategory1.name);
        });

        it('dovrebbe restituire 404 per una categoria non esistente', async () => {
            await request(app)
                .get('/api/categories/99999')
                .expect(404);
        });

        it('dovrebbe restituire 400 per un ID non valido', async () => {
            await request(app)
                .get('/api/categories/abc')
                .expect(400);
        });
    });

    describe('POST /api/categories', () => {
        const newCategoryData = {
            name: `Nuova Categoria POST ${Date.now()}`,
            description: 'Creata via API test',
        };

        it('dovrebbe creare una nuova categoria con token admin valido', async () => {
            const res = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newCategoryData)
                .expect(201);

            expect(res.body).to.be.an('object');
            expect(res.body.name).to.equal(newCategoryData.name);
            expect(res.body.description).to.equal(newCategoryData.description);
            expect(res.body).to.have.property('category_id');

            const dbCheck = await db.query('SELECT * FROM categories WHERE category_id = $1', [res.body.category_id]);
            expect(dbCheck.rows.length).to.equal(1);
            expect(dbCheck.rows[0].name).to.equal(newCategoryData.name);
        });

        it('dovrebbe creare una nuova sub-categoria con token admin valido', async () => {
            const subCategoryData = {
                name: `Nuova Sub POST ${Date.now()}`,
                description: 'Sub-categoria via API',
                parent_category_id: testCategory1.category_id
            };
            const res = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(subCategoryData)
                .expect(201);

            expect(res.body.name).to.equal(subCategoryData.name);
            expect(res.body.parent_category_id).to.equal(testCategory1.category_id);
        });

        it('NON dovrebbe creare una categoria senza token', async () => {
            await request(app)
                .post('/api/categories')
                .send(newCategoryData)
                .expect(401);
        });

        it('NON dovrebbe creare una categoria con token non admin (es. cliente)', async () => {
            const clienteEmail = `cliente.cat.${Date.now()}@example.com`;
            const clientePassword = 'passwordCliente';
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(clientePassword, salt);
            await db.query(
                `INSERT INTO users (email, password_hash, role, full_name, is_active)
                  VALUES ($1, $2, 'cliente', 'Cliente Cat Test', TRUE)`,
                [clienteEmail, hash]
            );
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: clienteEmail, password: clientePassword })
                .expect(200);
            const clienteToken = loginRes.body.token;

            await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send(newCategoryData)
                .expect(403);
        });

        it('NON dovrebbe creare una categoria senza nome', async () => {
            const { name, ...badData } = newCategoryData;
            await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(badData)
                .expect(400);
        });

        it('NON dovrebbe creare una categoria con nome duplicato', async () => {
            await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: testCategory1.name })
                .expect(400);
        });

        it('NON dovrebbe creare una categoria con parent_category_id non esistente', async () => {
            await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...newCategoryData, parent_category_id: 99999 })
                .expect(400);
        });
    });

    describe('PUT /api/categories/:id', () => {
        const updateData = {
            name: `Categoria Aggiornata ${Date.now()}`,
            description: 'Descrizione aggiornata',
            parent_category_id: null,
        };

        it('dovrebbe aggiornare una categoria esistente con token admin', async () => {
            const categoryToUpdate = testCategory2;
            const res = await request(app)
                .put(`/api/categories/${categoryToUpdate.category_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData)
                .expect(200);

            expect(res.body).to.be.an('object');
            expect(res.body.category_id).to.equal(categoryToUpdate.category_id);
            expect(res.body.name).to.equal(updateData.name);
            expect(res.body.description).to.equal(updateData.description);
            expect(res.body.parent_category_id).to.be.null;
        });

        it('NON dovrebbe aggiornare una categoria senza token', async () => {
            await request(app)
                .put(`/api/categories/${testCategory1.category_id}`)
                .send(updateData)
                .expect(401);
        });

        it('NON dovrebbe aggiornare una categoria con token non admin', async () => {
            const clienteEmail = `cliente.cat.put.${Date.now()}@example.com`;
            const clientePassword = 'passwordClientePut';
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(clientePassword, salt);
            await db.query(
                `INSERT INTO users (email, password_hash, role, full_name, is_active)
                  VALUES ($1, $2, 'cliente', 'Cliente Put Test', TRUE)`,
                [clienteEmail, hash]
            );
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: clienteEmail, password: clientePassword })
                .expect(200);
            const clienteToken = loginRes.body.token;

            await request(app)
                .put(`/api/categories/${testCategory1.category_id}`)
                .set('Authorization', `Bearer ${clienteToken}`)
                .send(updateData)
                .expect(403);
        });

        it('dovrebbe restituire 404 se si tenta di aggiornare una categoria non esistente', async () => {
            await request(app)
                .put('/api/categories/99999')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData)
                .expect(404);
        });

        it('NON dovrebbe aggiornare una categoria con nome duplicato', async () => {
            await request(app)
                .put(`/api/categories/${testCategory2.category_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: testCategory1.name })
                .expect(400);
        });

        it('NON dovrebbe aggiornare una categoria rendendola genitore di se stessa', async () => {
            await request(app)
                .put(`/api/categories/${testCategory1.category_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ parent_category_id: testCategory1.category_id })
                .expect(400);
        });

        it('NON dovrebbe aggiornare una categoria con parent_id non esistente', async () => {
            await request(app)
                .put(`/api/categories/${testCategory1.category_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ parent_category_id: 99999 })
                .expect(400);
        });
    });

    describe('DELETE /api/categories/:id', () => {
        let categoryToDelete;

        beforeEach(async () => {
            const res = await db.query(
                'INSERT INTO categories (name) VALUES ($1) RETURNING *',
                [`Categoria Da Eliminare ${Date.now()}`]
            );
            categoryToDelete = res.rows[0];
        });

        it('dovrebbe eliminare una categoria esistente con token admin', async () => {
            await request(app)
                .delete(`/api/categories/${categoryToDelete.category_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(204);

            const dbCheck = await db.query('SELECT * FROM categories WHERE category_id = $1', [categoryToDelete.category_id]);
            expect(dbCheck.rows.length).to.equal(0);
        });

        it('NON dovrebbe eliminare una categoria senza token', async () => {
            await request(app)
                .delete(`/api/categories/${categoryToDelete.category_id}`)
                .expect(401);
        });

        it('NON dovrebbe eliminare una categoria con token non admin', async () => {
            const clienteEmail = `cliente.cat.del.${Date.now()}@example.com`;
            const clientePassword = 'passwordClienteDel';
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(clientePassword, salt);
            await db.query(
                `INSERT INTO users (email, password_hash, role, full_name, is_active)
                  VALUES ($1, $2, 'cliente', 'Cliente Del Test', TRUE)`,
                [clienteEmail, hash]
            );
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: clienteEmail, password: clientePassword })
                .expect(200);
            const clienteToken = loginRes.body.token;

            await request(app)
                .delete(`/api/categories/${categoryToDelete.category_id}`)
                .set('Authorization', `Bearer ${clienteToken}`)
                .expect(403);
        });

        it('dovrebbe restituire 404 se si tenta di eliminare una categoria non esistente', async () => {
            await request(app)
                .delete('/api/categories/99999')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });

        it('dovrebbe impostare parent_category_id a NULL nelle subcategorie quando si elimina la categoria genitore', async () => {
            await request(app)
                .delete(`/api/categories/${testCategory1.category_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(204);

            const dbCheck = await db.query('SELECT parent_category_id FROM categories WHERE category_id = $1', [testCategory2.category_id]);
            expect(dbCheck.rows.length).to.equal(1);
            expect(dbCheck.rows[0].parent_category_id).to.be.null;
        });
    });

});