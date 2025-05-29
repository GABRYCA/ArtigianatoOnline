import { expect } from 'chai';
import request from 'supertest';
import app from '../index.js';
import db from '../db/database.js';
import { createUserAndLogin, getAdminToken } from './testUtils.js';

let adminToken = '';
let cliente1Token = '';
let cliente2Token = '';
let artigiano1Token = '';
let artigiano2Token = '';

let cliente1Id = null;
let cliente2Id = null;
let artigiano1Id = null;
let artigiano2Id = null;

let categoryId = null;

let productA_Art1 = null;
let productB_Art1 = null;
let productC_Art2 = null;

let testOrder1_Client1 = null;
let testOrder2_Client2 = null;

describe('Orders API (/api/orders)', () => {

    before(async () => {
        try {
            console.log('Pulizia DB prima dei test degli ordini...');
            await db.query('TRUNCATE TABLE payments, order_items, orders, products, categories, users RESTART IDENTITY CASCADE');
            console.log('Tabelle rilevanti pulite.');

            console.log('Creazione utenti e login...');
            adminToken = await getAdminToken();

            const cli1 = await createUserAndLogin({ email: `cli1.ord.${Date.now()}@example.com`, password: 'password', role: 'cliente', full_name: 'Cliente 1 Ord' });
            cliente1Id = cli1.userId;
            cliente1Token = cli1.token;

            const cli2 = await createUserAndLogin({ email: `cli2.ord.${Date.now()}@example.com`, password: 'password', role: 'cliente', full_name: 'Cliente 2 Ord' });
            cliente2Id = cli2.userId;
            cliente2Token = cli2.token;

            const art1 = await createUserAndLogin({ email: `art1.ord.${Date.now()}@example.com`, password: 'password', role: 'artigiano', full_name: 'Artigiano 1 Ord', shop_name: 'Art1 Ord Shop' });
            artigiano1Id = art1.userId;
            artigiano1Token = art1.token;

            const art2 = await createUserAndLogin({ email: `art2.ord.${Date.now()}@example.com`, password: 'password', role: 'artigiano', full_name: 'Artigiano 2 Ord', shop_name: 'Art2 Ord Shop' });
            artigiano2Id = art2.userId;
            artigiano2Token = art2.token;
            console.log('Utenti creati e loggati.');

            console.log('Creazione categorie e prodotti...');
            const catRes = await db.query("INSERT INTO categories (name) VALUES ('Cat Ordini') RETURNING category_id");
            categoryId = catRes.rows[0].category_id;

            const prodARes = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, is_active)
                 VALUES ($1, $2, 'Prod A Ord', 10.00, 20, TRUE) RETURNING *`,
                [artigiano1Id, categoryId]
            );
            productA_Art1 = prodARes.rows[0];

            const prodBRes = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, is_active)
                 VALUES ($1, $2, 'Prod B Ord Zero Stock', 15.00, 0, TRUE) RETURNING *`,
                [artigiano1Id, categoryId]
            );
            productB_Art1 = prodBRes.rows[0];

            const prodCRes = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, is_active)
                 VALUES ($1, $2, 'Prod C Ord Art2', 20.00, 30, TRUE) RETURNING *`,
                [artigiano2Id, categoryId]
            );
            productC_Art2 = prodCRes.rows[0];
            console.log('Categorie e prodotti creati.');

        } catch (err) {
            console.error('Errore FATALE durante il setup dei test ordini:', err);
            process.exit(1);
        }
    });

    describe('POST /api/orders', () => {
        const validOrderPayload = {
            shipping_address: 'Via Test 1, 10100 Torino',
            items: [],
        };

        it('dovrebbe creare un nuovo ordine per un cliente autenticato', async () => {
            const items = [
                { product_id: productA_Art1.product_id, quantity: 2 },
                { product_id: productC_Art2.product_id, quantity: 1 },
            ];
            const expectedTotal = 40.00;
            const initialStockA = productA_Art1.stock_quantity;
            const initialStockC = productC_Art2.stock_quantity;

            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...validOrderPayload, items: items })
                .expect(201);

            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('order_id');
            testOrder1_Client1 = res.body;
            expect(res.body.customer_id).to.equal(cliente1Id);
            expect(res.body.status).to.equal('pending');
            expect(parseFloat(res.body.total_amount)).to.equal(expectedTotal);
            expect(res.body.items).to.be.an('array').with.lengthOf(2);

            const stockCheckA = await db.query('SELECT stock_quantity FROM products WHERE product_id = $1', [productA_Art1.product_id]);
            const stockCheckC = await db.query('SELECT stock_quantity FROM products WHERE product_id = $1', [productC_Art2.product_id]);
            expect(stockCheckA.rows[0].stock_quantity).to.equal(initialStockA - 2);
            expect(stockCheckC.rows[0].stock_quantity).to.equal(initialStockC - 1);
        });

        it('NON dovrebbe creare un ordine senza token', async () => {
            const items = [{ product_id: productA_Art1.product_id, quantity: 1 }];
            await request(app)
                .post('/api/orders')
                .send({ ...validOrderPayload, items: items })
                .expect(401);
        });

        it('NON dovrebbe creare un ordine con token non cliente (artigiano)', async () => {
            const items = [{ product_id: productA_Art1.product_id, quantity: 1 }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send({ ...validOrderPayload, items: items })
                .expect(403);
        });

        it('NON dovrebbe creare un ordine con token non cliente (admin)', async () => {
            const items = [{ product_id: productA_Art1.product_id, quantity: 1 }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...validOrderPayload, items: items })
                .expect(403);
        });

        it('NON dovrebbe creare un ordine con un prodotto non esistente', async () => {
            const items = [{ product_id: 99999, quantity: 1 }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...validOrderPayload, items: items })
                .expect(400)
                .then(res => {
                    expect(res.body.message).to.contain('non trovato');
                });
        });

        it('NON dovrebbe creare un ordine con quantità non disponibile (stock 0)', async () => {
            const items = [{ product_id: productB_Art1.product_id, quantity: 1 }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...validOrderPayload, items: items })
                .expect(400)
                .then(res => {
                    expect(res.body.message).to.contain('Quantità non disponibile');
                });
        });

        it('NON dovrebbe creare un ordine con quantità richiesta maggiore dello stock', async () => {
            const highQuantity = productA_Art1.stock_quantity + 5;
            const items = [{ product_id: productA_Art1.product_id, quantity: highQuantity }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...validOrderPayload, items: items })
                .expect(400)
                .then(res => {
                    expect(res.body.message).to.contain('Quantità non disponibile');
                });
        });

        it('NON dovrebbe creare un ordine senza items', async () => {
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...validOrderPayload, items: [] })
                .expect(400);
        });

        it('NON dovrebbe creare un ordine senza shipping_address', async () => {
            const { shipping_address, ...badPayload } = validOrderPayload;
            const items = [{ product_id: productA_Art1.product_id, quantity: 1 }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...badPayload, items: items })
                .expect(400);
        });

        it('NON dovrebbe creare un ordine con formato items non valido (quantità <= 0)', async () => {
            const items = [{ product_id: productA_Art1.product_id, quantity: 0 }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...validOrderPayload, items: items })
                .expect(400);
        });
        it('NON dovrebbe creare un ordine con formato items non valido (manca product_id)', async () => {
            const items = [{ quantity: 1 }];
            await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ ...validOrderPayload, items: items })
                .expect(400);
        });
    });

    describe('GET /api/orders', () => {
        before(async () => {
            const itemsOrder2 = [{ product_id: productA_Art1.product_id, quantity: 1 }];
            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente2Token}`)
                .send({ shipping_address: 'Via Cliente 2', items: itemsOrder2 })
                .expect(201);
            testOrder2_Client2 = res.body;
        });

        it('Admin: dovrebbe ottenere tutti gli ordini', async () => {
            const res = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body.orders).to.be.an('array');
            expect(res.body.totalItems).to.be.at.least(2);
            const orderIds = res.body.orders.map(o => o.order_id);
            expect(orderIds).to.include(testOrder1_Client1.order_id);
            expect(orderIds).to.include(testOrder2_Client2.order_id);
        });

        it('Cliente 1: dovrebbe ottenere solo i propri ordini', async () => {
            const res = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .expect(200);
            expect(res.body.orders).to.be.an('array').with.lengthOf(1);
            expect(res.body.orders[0].order_id).to.equal(testOrder1_Client1.order_id);
            expect(res.body.orders[0].customer_id).to.equal(cliente1Id);
        });

        it('Cliente 2: dovrebbe ottenere solo i propri ordini', async () => {
            const res = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${cliente2Token}`)
                .expect(200);
            expect(res.body.orders).to.be.an('array').with.lengthOf(1);
            expect(res.body.orders[0].order_id).to.equal(testOrder2_Client2.order_id);
            expect(res.body.orders[0].customer_id).to.equal(cliente2Id);
        });

        it('Artigiano 1: dovrebbe ottenere ordini con i propri prodotti', async () => {
            const res = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(200);
            expect(res.body.orders).to.be.an('array');
            expect(res.body.totalItems).to.equal(2);
            const orderIds = res.body.orders.map(o => o.order_id);
            expect(orderIds).to.include(testOrder1_Client1.order_id);
            expect(orderIds).to.include(testOrder2_Client2.order_id);
        });

        it('Artigiano 2: dovrebbe ottenere ordini con i propri prodotti', async () => {
            const res = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${artigiano2Token}`)
                .expect(200);
            expect(res.body.orders).to.be.an('array').with.lengthOf(1);
            expect(res.body.orders[0].order_id).to.equal(testOrder1_Client1.order_id);
        });

        it('dovrebbe filtrare gli ordini per stato (admin)', async () => {
            await request(app)
                .put(`/api/orders/${testOrder1_Client1.order_id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'paid' })
                .expect(200);

            const resPaid = await request(app)
                .get('/api/orders?status=paid')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(resPaid.body.orders).to.be.an('array').with.lengthOf(1);
            expect(resPaid.body.orders[0].order_id).to.equal(testOrder1_Client1.order_id);
            expect(resPaid.body.orders[0].status).to.equal('paid');

            const resPending = await request(app)
                .get('/api/orders?status=pending')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(resPending.body.orders).to.be.an('array').with.lengthOf(1);
            expect(resPending.body.orders[0].order_id).to.equal(testOrder2_Client2.order_id);
            expect(resPending.body.orders[0].status).to.equal('pending');

            await request(app)
                .put(`/api/orders/${testOrder1_Client1.order_id}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'pending' })
                .expect(403);
        });
    });

    describe('GET /api/orders/:id', () => {
        it('Admin: dovrebbe ottenere dettagli di un ordine specifico', async () => {
            const res = await request(app)
                .get(`/api/orders/${testOrder1_Client1.order_id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body.order_id).to.equal(testOrder1_Client1.order_id);
            expect(res.body.items).to.be.an('array').with.lengthOf(2);
            expect(res.body.items[0]).to.have.property('product_name');
            expect(res.body.items[0]).to.have.property('artisan_shop_name');
        });

        it('Cliente Proprietario: dovrebbe ottenere dettagli del proprio ordine', async () => {
            const res = await request(app)
                .get(`/api/orders/${testOrder1_Client1.order_id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .expect(200);
            expect(res.body.order_id).to.equal(testOrder1_Client1.order_id);
            expect(res.body.customer_id).to.equal(cliente1Id);
        });

        it('Cliente NON Proprietario: NON dovrebbe ottenere dettagli (403)', async () => {
            await request(app)
                .get(`/api/orders/${testOrder1_Client1.order_id}`)
                .set('Authorization', `Bearer ${cliente2Token}`)
                .expect(403);
        });

        it('Artigiano Coinvolto: dovrebbe ottenere dettagli dell\'ordine', async () => {
            const res = await request(app)
                .get(`/api/orders/${testOrder1_Client1.order_id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(200);
            expect(res.body.order_id).to.equal(testOrder1_Client1.order_id);
        });

        it('Artigiano NON Coinvolto: NON dovrebbe ottenere dettagli (403)', async () => {
            const items = [{ product_id: productA_Art1.product_id, quantity: 1 }];
            const resOrder = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ shipping_address: 'Via Solo Art1', items: items })
                .expect(201);
            const orderOnlyArt1Id = resOrder.body.order_id;

            await request(app)
                .get(`/api/orders/${orderOnlyArt1Id}`)
                .set('Authorization', `Bearer ${artigiano2Token}`)
                .expect(403);
        });

        it('dovrebbe restituire 404 per un ordine non esistente', async () => {
            await request(app)
                .get('/api/orders/99999')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });
    });

    describe('PUT /api/orders/:id/status', () => {
        let orderToModifyId = null;
        let productInOrderToModify = null;
        let initialStock = 0;

        beforeEach(async () => {
            const items = [{ product_id: productA_Art1.product_id, quantity: 1 }];
            productInOrderToModify = productA_Art1;
            const stockRes = await db.query('SELECT stock_quantity FROM products WHERE product_id = $1', [productInOrderToModify.product_id]);
            initialStock = stockRes.rows[0].stock_quantity;

            const res = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ shipping_address: 'Via Modifica Stato', items: items })
                .expect(201);
            orderToModifyId = res.body.order_id;
        });

        it('Admin: dovrebbe aggiornare stato PENDING -> PAID', async () => {
            const res = await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'paid' })
                .expect(200);
            expect(res.body.status).to.equal('paid');
        });

        it('Admin: dovrebbe aggiornare stato PAID -> PROCESSING', async () => {
            await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'paid' }).expect(200);

            const res = await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'processing' })
                .expect(200);
            expect(res.body.status).to.equal('processing');
        });

        it('Admin: dovrebbe aggiornare stato PROCESSING -> SHIPPED (con tracking)', async () => {
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'paid' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'processing' }).expect(200);

            const tracking = 'TRACK123XYZ';
            const res = await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'shipped', tracking_number: tracking })
                .expect(200);
            expect(res.body.status).to.equal('shipped');
            expect(res.body.tracking_number).to.equal(tracking);
        });

        it('Admin: dovrebbe aggiornare stato SHIPPED -> DELIVERED', async () => {
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'paid' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'processing' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'shipped', tracking_number: 'T' }).expect(200);

            const res = await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'delivered' })
                .expect(200);
            expect(res.body.status).to.equal('delivered');
        });


        it('Admin: dovrebbe annullare un ordine (PAID -> CANCELLED) e ripristinare lo stock', async () => {
            await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'paid' }).expect(200);

            const stockBeforeCancel = initialStock -1;

            const res = await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'cancelled' })
                .expect(200);
            expect(res.body.status).to.equal('cancelled');

            const stockAfterCancel = await db.query('SELECT stock_quantity FROM products WHERE product_id = $1', [productInOrderToModify.product_id]);
            expect(stockAfterCancel.rows[0].stock_quantity).to.equal(initialStock);
        });


        it('Cliente: dovrebbe poter annullare il proprio ordine PENDING e ripristinare lo stock', async () => {
            const res = await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ status: 'cancelled' })
                .expect(200);
            expect(res.body.status).to.equal('cancelled');

            const stockAfterCancel = await db.query('SELECT stock_quantity FROM products WHERE product_id = $1', [productInOrderToModify.product_id]);
            expect(stockAfterCancel.rows[0].stock_quantity).to.equal(initialStock);
        });

        it('Cliente: NON dovrebbe poter annullare un ordine SHIPPED (403)', async () => {
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'paid' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'processing' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'shipped' }).expect(200);

            await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ status: 'cancelled' })
                .expect(403);
        });

        it('Cliente: NON dovrebbe poter modificare lo stato dell\'ordine di un altro cliente (403)', async () => {
            await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${cliente2Token}`)
                .send({ status: 'paid' })
                .expect(403);
        });

        it('Artigiano: NON dovrebbe poter modificare lo stato di un ordine (403)', async () => {
            await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send({ status: 'processing' })
                .expect(403);
        });

        it('NON dovrebbe aggiornare con uno stato non valido', async () => {
            await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'stato_inventato' })
                .expect(400);
        });

        it('NON dovrebbe permettere transizioni di stato non valide (es. DELIVERED -> PENDING)', async () => {
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'paid' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'processing' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'shipped' }).expect(200);
            await request(app).put(`/api/orders/${orderToModifyId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'delivered' }).expect(200);

            await request(app)
                .put(`/api/orders/${orderToModifyId}/status`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'pending' })
                .expect(403);
        });

        it('dovrebbe restituire 404 aggiornando un ordine non esistente', async () => {
            await request(app)
                .put('/api/orders/99999/status')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ status: 'paid' })
                .expect(404);
        });
    });

});
