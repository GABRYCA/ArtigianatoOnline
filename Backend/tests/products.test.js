import { expect } from 'chai';
import request from 'supertest';
import app from '../index.js';
import db from '../db/database.js';
import { createUserAndLogin } from './testUtils.js';

let adminToken = '';
let artigiano1Token = '';
let artigiano2Token = '';
let clienteToken = '';

let adminUserId = null;
let artigiano1Id = null;
let artigiano2Id = null;
let clienteUserId = null;

let testCategory1 = null;
let testCategory2 = null;

let product1 = null;
let product2 = null;
let product3 = null;
let product4 = null;

const adminUserData = { email: `test.admin.prod.${Date.now()}@example.com`, password: 'adminPasswordProd', role: 'admin', full_name: 'Admin Prod' };
const artigiano1Data = { email: `test.art1.prod.${Date.now()}@example.com`, password: 'art1PasswordProd', role: 'artigiano', full_name: 'Artigiano 1 Prod', shop_name: 'Art1 Shop' };
const artigiano2Data = { email: `test.art2.prod.${Date.now()}@example.com`, password: 'art2PasswordProd', role: 'artigiano', full_name: 'Artigiano 2 Prod', shop_name: 'Art2 Shop' };
const clienteUserData = { email: `test.cli.prod.${Date.now()}@example.com`, password: 'cliPasswordProd', role: 'cliente', full_name: 'Cliente Prod' };

describe('Products API (/api/products)', () => {

    before(async () => {
        try {
            console.log('Pulizia DB prima dei test dei prodotti...');
            await db.query('TRUNCATE TABLE payments, order_items, orders, products, categories, users RESTART IDENTITY CASCADE');
            console.log('Tabelle rilevanti pulite.');

            console.log('Creazione utenti e login...');
            const admin = await createUserAndLogin(adminUserData);
            adminUserId = admin.userId;
            adminToken = admin.token;

            const art1 = await createUserAndLogin(artigiano1Data);
            artigiano1Id = art1.userId;
            artigiano1Token = art1.token;

            const art2 = await createUserAndLogin(artigiano2Data);
            artigiano2Id = art2.userId;
            artigiano2Token = art2.token;

            const cliente = await createUserAndLogin(clienteUserData);
            clienteUserId = cliente.userId;
            clienteToken = cliente.token;
            console.log('Utenti creati e loggati.');

            console.log('Creazione categorie...');
            const cat1Res = await db.query("INSERT INTO categories (name) VALUES ('Categoria Prod 1') RETURNING *");
            testCategory1 = cat1Res.rows[0];
            const cat2Res = await db.query("INSERT INTO categories (name) VALUES ('Categoria Prod 2') RETURNING *");
            testCategory2 = cat2Res.rows[0];
            console.log('Categorie create.');

            console.log('Creazione prodotti di test...');
            const prod1Res = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, description, is_active)
                 VALUES ($1, $2, 'Prodotto Test 1', 25.50, 10, 'Desc Prod 1', TRUE) RETURNING *`,
                [artigiano1Id, testCategory1.category_id]
            );
            product1 = prod1Res.rows[0];

            const prod2Res = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, description, is_active)
                 VALUES ($1, $2, 'Prodotto Test 2', 50.00, 5, 'Desc Prod 2', TRUE) RETURNING *`,
                [artigiano1Id, testCategory2.category_id]
            );
            product2 = prod2Res.rows[0];

            const prod3Res = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, description, is_active)
                 VALUES ($1, $2, 'Prodotto Test 3 Inattivo', 15.00, 20, 'Desc Prod 3', FALSE) RETURNING *`,
                [artigiano1Id, testCategory1.category_id]
            );
            product3 = prod3Res.rows[0];

            const prod4Res = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, description, is_active)
                 VALUES ($1, $2, 'Prodotto Test 4 Art2', 99.99, 2, 'Desc Prod 4', TRUE) RETURNING *`,
                [artigiano2Id, testCategory1.category_id]
            );
            product4 = prod4Res.rows[0];

            console.log('Prodotti di test creati.');

        } catch (err) {
            console.error('Errore FATALE durante il setup dei test prodotti:', err);
            process.exit(1);
        }
    });

    describe('GET /api/products', () => {
        it('dovrebbe restituire la lista dei prodotti ATTIVI', async () => {
            const res = await request(app).get('/api/products').expect(200);
            expect(res.body).to.be.an('object');
            expect(res.body.products).to.be.an('array');
            expect(res.body.products.length).to.be.at.least(3);
            const ids = res.body.products.map(p => p.product_id);
            expect(ids).to.include(product1.product_id);
            expect(ids).to.include(product2.product_id);
            expect(ids).to.include(product4.product_id);
            expect(ids).to.not.include(product3.product_id);
        });

        it('dovrebbe filtrare per categoria', async () => {
            const res = await request(app)
                .get(`/api/products?category=${testCategory1.category_id}`)
                .expect(200);
            expect(res.body.products.length).to.equal(2);
            expect(res.body.products.every(p => p.category_id === testCategory1.category_id)).to.be.true;
        });

        it('dovrebbe filtrare per prezzo minimo', async () => {
            const res = await request(app)
                .get('/api/products?minPrice=50')
                .expect(200);
            expect(res.body.products.length).to.equal(2);
            expect(res.body.products.every(p => p.price >= 50)).to.be.true;
        });

        it('dovrebbe filtrare per prezzo massimo', async () => {
            const res = await request(app)
                .get('/api/products?maxPrice=30')
                .expect(200);
            expect(res.body.products.length).to.equal(1);
            expect(res.body.products[0].product_id).to.equal(product1.product_id);
        });

        it('dovrebbe filtrare per disponibilità (inStock=true)', async () => {
            await db.query('UPDATE products SET stock_quantity = 0 WHERE product_id = $1', [product2.product_id]);
            const res = await request(app)
                .get('/api/products?inStock=true')
                .expect(200);
            expect(res.body.products.length).to.equal(2);
            const ids = res.body.products.map(p => p.product_id);
            expect(ids).to.include(product1.product_id);
            expect(ids).to.include(product4.product_id);
            expect(ids).to.not.include(product2.product_id);
            await db.query('UPDATE products SET stock_quantity = 5 WHERE product_id = $1', [product2.product_id]);
        });

        it('dovrebbe filtrare per artigiano', async () => {
            const res = await request(app)
                .get(`/api/products?artisanId=${artigiano1Id}`)
                .expect(200);
            expect(res.body.products.length).to.equal(2);
            expect(res.body.products.every(p => p.artisan_id === artigiano1Id)).to.be.true;
        });

        it('dovrebbe cercare per termine nel nome o descrizione', async () => {
            const res = await request(app)
                .get('/api/products?q=Prod 2')
                .expect(200);
            expect(res.body.products.length).to.equal(1);
            expect(res.body.products[0].product_id).to.equal(product2.product_id);
        });

        it('dovrebbe ordinare per prezzo ascendente', async () => {
            const res = await request(app)
                .get('/api/products?sortBy=price_asc')
                .expect(200);
            const prices = res.body.products.map(p => parseFloat(p.price));
            for (let i = 0; i < prices.length - 1; i++) {
                expect(prices[i]).to.be.at.most(prices[i + 1]);
            }
        });

        it('dovrebbe gestire la paginazione (limit)', async () => {
            const res = await request(app)
                .get('/api/products?limit=1')
                .expect(200);
            expect(res.body.products.length).to.equal(1);
            expect(res.body.totalItems).to.equal(3);
            expect(res.body.totalPages).to.equal(3);
            expect(res.body.currentPage).to.equal(1);
        });

        it('dovrebbe gestire la paginazione (page)', async () => {
            const res = await request(app)
                .get('/api/products?limit=1&page=2&sortBy=name_asc')
                .expect(200);
            expect(res.body.products.length).to.equal(1);
            expect(res.body.currentPage).to.equal(2);
        });
    });

    describe('GET /api/products/:id', () => {
        it('dovrebbe restituire i dettagli di un prodotto ATTIVO specifico', async () => {
            const res = await request(app)
                .get(`/api/products/${product1.product_id}`)
                .expect(200);
            expect(res.body).to.be.an('object');
            expect(res.body.product_id).to.equal(product1.product_id);
            expect(res.body.name).to.equal(product1.name);
            expect(res.body.is_active).to.be.true;
        });

        it('dovrebbe restituire 404 per un prodotto non esistente', async () => {
            await request(app).get('/api/products/99999').expect(404);
        });

        it('dovrebbe restituire 404 per un prodotto INATTIVO', async () => {
            await request(app).get(`/api/products/${product3.product_id}`).expect(404);
        });

        it('dovrebbe restituire 400 per un ID non valido', async () => {
            await request(app).get('/api/products/abc').expect(400);
        });
    });

    describe('POST /api/products', () => {

        it('dovrebbe creare un nuovo prodotto con token artigiano proprietario', async () => {
            const newProductData = {
                category_id: testCategory1.category_id,
                name: `Nuovo Prodotto POST ${Date.now()}`,
                description: 'Creato da test POST',
                price: 19.99,
                stock_quantity: 15,
                sku: `SKU-POST-${Date.now()}`,
                image_url: 'http://example.com/image.jpg',
            };
            const res = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(newProductData)
                .expect(201);

            expect(res.body).to.be.an('object');
            expect(res.body.name).to.equal(newProductData.name);
            expect(res.body.price == newProductData.price).to.be.true;
            expect(res.body.stock_quantity).to.equal(newProductData.stock_quantity);
            expect(res.body.artisan_id).to.equal(artigiano1Id);
            expect(res.body.is_active).to.be.true;

            const dbCheck = await db.query('SELECT * FROM products WHERE product_id = $1', [res.body.product_id]);
            expect(dbCheck.rows.length).to.equal(1);
            expect(dbCheck.rows[0].name).to.equal(newProductData.name);
        });

        it('NON dovrebbe creare un prodotto senza token', async () => {
            const newProductData = {
                category_id: testCategory1.category_id,
                name: `Nuovo Prodotto POST NT ${Date.now()}`,
                description: 'Creato da test POST no token',
                price: 19.99,
                stock_quantity: 15,
            };
            await request(app)
                .post('/api/products')
                .send(newProductData)
                .expect(401);
        });

        it('NON dovrebbe creare un prodotto con token non artigiano (es. cliente)', async () => {
            const newProductData = {
                category_id: testCategory1.category_id,
                name: `Nuovo Prodotto POST CLI ${Date.now()}`,
                description: 'Creato da test POST cliente',
                price: 19.99,
                stock_quantity: 15,
            };
            await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send(newProductData)
                .expect(403);
        });

        it('NON dovrebbe creare un prodotto con token admin (solo artigiani possono creare)', async () => {
            const newProductData = {
                category_id: testCategory1.category_id,
                name: `Nuovo Prodotto POST ADM ${Date.now()}`,
                description: 'Creato da test POST admin',
                price: 19.99,
                stock_quantity: 15,
            };
            await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newProductData)
                .expect(403);
        });

        const requiredPostFields = ['name', 'price', 'stock_quantity', 'category_id'];
        requiredPostFields.forEach(field => {
            it(`NON dovrebbe creare un prodotto senza campo obbligatorio: ${field}`, async () => {
                const baseData = {
                    category_id: testCategory1.category_id,
                    name: `Nuovo Prodotto POST MISS ${field} ${Date.now()}`,
                    description: 'Creato da test POST missing field',
                    price: 19.99,
                    stock_quantity: 15,
                };
                const badData = { ...baseData };
                delete badData[field];
                await request(app)
                    .post('/api/products')
                    .set('Authorization', `Bearer ${artigiano1Token}`)
                    .send(badData)
                    .expect(400);
            });
        });

        it('NON dovrebbe creare un prodotto con prezzo negativo', async () => {
            const newProductData = {
                category_id: testCategory1.category_id,
                name: `Nuovo Prodotto POST NEG P ${Date.now()}`,
                description: 'Test prezzo negativo',
                price: -10,
                stock_quantity: 15,
            };
            await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(newProductData)
                .expect(400);
        });

        it('NON dovrebbe creare un prodotto con stock negativo', async () => {
            const newProductData = {
                category_id: testCategory1.category_id,
                name: `Nuovo Prodotto POST NEG S ${Date.now()}`,
                description: 'Test stock negativo',
                price: 19.99,
                stock_quantity: -5,
            };
            await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(newProductData)
                .expect(400);
        });

        it('NON dovrebbe creare un prodotto con categoria non valida', async () => {
            const newProductData = {
                name: `Nuovo Prodotto POST BAD CAT ${Date.now()}`,
                description: 'Test categoria non valida',
                price: 19.99,
                stock_quantity: 15,
                category_id: 99999
            };
            await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(newProductData)
                .expect(400);
        });

        it('NON dovrebbe creare un prodotto con SKU duplicato (se esiste constraint)', async () => {
            const uniqueSku = `UNIQUE-SKU-${Date.now()}`;
            const firstProdData = {
                category_id: testCategory1.category_id,
                name: `Nuovo Prodotto POST SKU1 ${Date.now()}`,
                description: 'Primo con SKU unico',
                price: 19.99,
                stock_quantity: 15,
                sku: uniqueSku,
            };
            await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(firstProdData)
                .expect(201);

            const secondProdData = {
                category_id: testCategory2.category_id,
                name: `Nuovo Prodotto POST SKU2 ${Date.now()}`,
                description: 'Secondo con SKU uguale',
                price: 25.00,
                stock_quantity: 10,
                sku: uniqueSku,
            };
            await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(secondProdData)
                .expect(400);
        });
    });

    describe('PUT /api/products/:id', () => {
        const updateData = {
            name: `Prodotto Aggiornato ${Date.now()}`,
            price: 33.33,
            stock_quantity: 8,
            is_active: false,
        };

        it('dovrebbe aggiornare un prodotto dal proprietario artigiano', async () => {
            const res = await request(app)
                .put(`/api/products/${product1.product_id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(updateData)
                .expect(200);

            expect(res.body.name).to.equal(updateData.name);
            expect(res.body.price == updateData.price).to.be.true;
            expect(res.body.stock_quantity).to.equal(updateData.stock_quantity);
            expect(res.body.is_active).to.equal(updateData.is_active);
            await db.query('UPDATE products SET is_active = TRUE WHERE product_id = $1', [product1.product_id]);
        });

        it('dovrebbe aggiornare un prodotto da un admin', async () => {
            const adminUpdate = { description: 'Aggiornato da Admin' };
            const res = await request(app)
                .put(`/api/products/${product1.product_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(adminUpdate)
                .expect(200);
            expect(res.body.description).to.equal(adminUpdate.description);
        });

        it('NON dovrebbe aggiornare un prodotto senza token', async () => {
            await request(app)
                .put(`/api/products/${product1.product_id}`)
                .send(updateData)
                .expect(401);
        });

        it('NON dovrebbe aggiornare un prodotto da un artigiano non proprietario', async () => {
            await request(app)
                .put(`/api/products/${product1.product_id}`)
                .set('Authorization', `Bearer ${artigiano2Token}`)
                .send(updateData)
                .expect(403);
        });

        it('NON dovrebbe aggiornare un prodotto da un cliente', async () => {
            await request(app)
                .put(`/api/products/${product1.product_id}`)
                .set('Authorization', `Bearer ${clienteToken}`)
                .send(updateData)
                .expect(403);
        });

        it('dovrebbe restituire 404 aggiornando un prodotto non esistente', async () => {
            await request(app)
                .put('/api/products/99999')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(updateData)
                .expect(404);
        });

        it('NON dovrebbe aggiornare con prezzo negativo', async () => {
            await request(app)
                .put(`/api/products/${product1.product_id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send({ price: -1 })
                .expect(400);
        });

        it('NON dovrebbe aggiornare con categoria non valida', async () => {
            await request(app)
                .put(`/api/products/${product1.product_id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send({ category_id: 99999 })
                .expect(400);
        });
    });

    describe('DELETE /api/products/:id', () => {
        let productToDelete;

        beforeEach(async () => {
            const res = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, is_active)
                 VALUES ($1, $2, 'Prod Da Eliminare ${Date.now()}', 10, 1, TRUE) RETURNING *`,
                [artigiano1Id, testCategory1.category_id]
            );
            productToDelete = res.rows[0];
        });

        it('dovrebbe disattivare un prodotto dal proprietario artigiano', async () => {
            await request(app)
                .delete(`/api/products/${productToDelete.product_id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(204);

            const dbCheck = await db.query('SELECT is_active FROM products WHERE product_id = $1', [productToDelete.product_id]);
            expect(dbCheck.rows.length).to.equal(1);
            expect(dbCheck.rows[0].is_active).to.be.false;
        });

        it('dovrebbe disattivare un prodotto da un admin', async () => {
            await request(app)
                .delete(`/api/products/${productToDelete.product_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(204);

            const dbCheck = await db.query('SELECT is_active FROM products WHERE product_id = $1', [productToDelete.product_id]);
            expect(dbCheck.rows[0].is_active).to.be.false;
        });

        it('NON dovrebbe disattivare un prodotto senza token', async () => {
            await request(app)
                .delete(`/api/products/${productToDelete.product_id}`)
                .expect(401);
        });

        it('NON dovrebbe disattivare un prodotto da un artigiano non proprietario', async () => {
            await request(app)
                .delete(`/api/products/${productToDelete.product_id}`)
                .set('Authorization', `Bearer ${artigiano2Token}`)
                .expect(403);
        });

        it('NON dovrebbe disattivare un prodotto da un cliente', async () => {
            await request(app)
                .delete(`/api/products/${productToDelete.product_id}`)
                .set('Authorization', `Bearer ${clienteToken}`)
                .expect(403);
        });

        it('dovrebbe restituire 404 eliminando un prodotto non esistente', async () => {
            await request(app)
                .delete('/api/products/99999')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(404);
        });

        it('il prodotto disattivato non dovrebbe essere visibile in GET /api/products', async () => {
            await request(app)
                .delete(`/api/products/${productToDelete.product_id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(204);

            const res = await request(app).get('/api/products').expect(200);
            const ids = res.body.products.map(p => p.product_id);
            expect(ids).to.not.include(productToDelete.product_id);
        });

        it('il prodotto disattivato non dovrebbe essere visibile in GET /api/products/:id', async () => {
            await request(app)
                .delete(`/api/products/${productToDelete.product_id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(204);

            await request(app).get(`/api/products/${productToDelete.product_id}`).expect(404);
        });
    });

});