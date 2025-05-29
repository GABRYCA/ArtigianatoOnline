import { expect } from 'chai';
import request from 'supertest';
import app from '../index.js';
import db from '../db/database.js';
import { createUserAndLogin, getAdminToken } from './testUtils.js';

let adminToken = '';
let clienteToken = '';
let artigianoToken = '';

let clienteId = null;
let artigianoId = null;

let productId = null;
let pendingOrderId = null;
let pendingOrderAmount = null;
let paidOrderId = null;
let paidOrderPaymentId = null;

describe('Payments API (/api/payments)', () => {

    before(async () => {
        try {
            console.log('Pulizia DB prima dei test dei pagamenti...');
            await db.query('TRUNCATE TABLE payments, order_items, orders, products, categories, users RESTART IDENTITY CASCADE');
            console.log('Tabelle rilevanti pulite.');

            console.log('Creazione utenti e login...');
            adminToken = await getAdminToken();

            const cli = await createUserAndLogin({ email: `cli.pay.${Date.now()}@example.com`, password: 'password', role: 'cliente', full_name: 'Cliente Pay' });
            clienteId = cli.userId;
            clienteToken = cli.token;

            const art = await createUserAndLogin({ email: `art.pay.${Date.now()}@example.com`, password: 'password', role: 'artigiano', full_name: 'Artigiano Pay', shop_name: 'Art Pay Shop' });
            artigianoId = art.userId;
            artigianoToken = art.token;
            console.log('Utenti creati.');

            console.log('Creazione categoria e prodotto...');
            const catRes = await db.query("INSERT INTO categories (name) VALUES ('Cat Pagamenti') RETURNING category_id");
            const categoryId = catRes.rows[0].category_id;
            const prodRes = await db.query(
                `INSERT INTO products (artisan_id, category_id, name, price, stock_quantity, is_active)
                 VALUES ($1, $2, 'Prod Pagamenti', 55.55, 10, TRUE) RETURNING product_id`,
                [artigianoId, categoryId]
            );
            productId = prodRes.rows[0].product_id;
            console.log('Categoria e prodotto creati.');

            console.log('Creazione Ordine Pending...');
            const orderItemsPending = [{ product_id: productId, quantity: 1 }];
            const orderPendingRes = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send({ shipping_address: 'Via Pending 1', items: orderItemsPending })
                .expect(201);
            pendingOrderId = orderPendingRes.body.order_id;
            pendingOrderAmount = parseFloat(orderPendingRes.body.total_amount);
            console.log(`Ordine Pending creato: ID=${pendingOrderId}, Amount=${pendingOrderAmount}`);

            console.log('Creazione Ordine Paid (con pagamento immediato)...');
            const orderItemsPaid = [{ product_id: productId, quantity: 2 }];
            const orderPaidRes = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send({ shipping_address: 'Via Paid 2', items: orderItemsPaid })
                .expect(201);
            paidOrderId = orderPaidRes.body.order_id;
            const paidOrderAmount = parseFloat(orderPaidRes.body.total_amount);

            const paymentData = {
                order_id: paidOrderId,
                amount: paidOrderAmount,
                payment_method: 'credit_card',
                status: 'completed',
                transaction_id: `TRANS-PAID-${Date.now()}`
            };
            const paymentRes = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(paymentData)
                .expect(201);
            paidOrderPaymentId = paymentRes.body.payment_id;
            console.log(`Ordine Paid creato: ID=${paidOrderId}, PaymentID=${paidOrderPaymentId}`);


        } catch (err) {
            console.error('Errore FATALE durante il setup dei test pagamenti:', err);
            process.exit(1);
        }
    });

    describe('POST /api/payments', () => {
        const basePaymentData = {
            order_id: null,
            amount: null,
            payment_method: 'paypal',
            status: 'completed',
            transaction_id: `TRANS-${Date.now()}`
        };

        it('Admin: dovrebbe registrare un pagamento COMPLETED per un ordine PENDING e aggiornare lo stato ordine a PAID', async () => {
            const paymentData = {
                ...basePaymentData,
                order_id: pendingOrderId,
                amount: pendingOrderAmount,
                transaction_id: `TRANS-PENDING-${Date.now()}`
            };

            const res = await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(paymentData)
                .expect(201);

            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('payment_id');
            expect(res.body.order_id).to.equal(pendingOrderId);
            expect(res.body.amount == pendingOrderAmount).to.be.true;
            expect(res.body.status).to.equal('completed');

            const orderCheck = await db.query('SELECT status FROM orders WHERE order_id = $1', [pendingOrderId]);
            expect(orderCheck.rows[0].status).to.equal('paid');

            pendingOrderId = null;
            paidOrderId = res.body.order_id;
            paidOrderPaymentId = res.body.payment_id;
        });

        it('NON dovrebbe registrare pagamento senza token', async () => {
            const paymentData = { ...basePaymentData, order_id: 999, amount: 10 };
            await request(app)
                .post('/api/payments')
                .send(paymentData)
                .expect(401);
        });

        it('NON dovrebbe registrare pagamento con token non admin (cliente)', async () => {
            const paymentData = { ...basePaymentData, order_id: paidOrderId, amount: pendingOrderAmount };
            await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send(paymentData)
                .expect(403);
        });

        it('NON dovrebbe registrare pagamento per ordine non esistente', async () => {
            const paymentData = { ...basePaymentData, order_id: 99999, amount: 10 };
            await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(paymentData)
                .expect(400);
        });

        it('NON dovrebbe registrare pagamento con importo non corrispondente all\'ordine', async () => {
            const orderItems = [{ product_id: productId, quantity: 1 }];
            const orderRes = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send({ shipping_address: 'Via Importo Errato', items: orderItems })
                .expect(201);
            const tempOrderId = orderRes.body.order_id;
            const correctAmount = parseFloat(orderRes.body.total_amount);

            const paymentData = {
                ...basePaymentData,
                order_id: tempOrderId,
                amount: correctAmount + 10,
                transaction_id: `TRANS-AMOUNT-${Date.now()}`
            };
            await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(paymentData)
                .expect(400)
                .then(res => {
                    expect(res.body.message).to.contain('non corrisponde al totale dell\'ordine');
                });
        });

        it('NON dovrebbe registrare un secondo pagamento per un ordine (stato non idoneo)', async () => {
            const paymentData = {
                ...basePaymentData,
                order_id: paidOrderId,
                amount: pendingOrderAmount,
                status: 'completed',
                transaction_id: `TRANS-DUPLICATE-${Date.now()}`
            };
            await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(paymentData)
                .expect(400);
        });

        it('NON dovrebbe registrare pagamento COMPLETED per ordine già PAID', async () => {
            const paymentData = {
                ...basePaymentData,
                order_id: paidOrderId,
                amount: pendingOrderAmount,
                status: 'completed',
                transaction_id: `TRANS-PAID-${Date.now()}`
            };

            await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(paymentData)
                .expect(400);
        });


        it('NON dovrebbe registrare pagamento con transaction_id duplicato', async () => {
            const paymentData = {
                ...basePaymentData,
                order_id: paidOrderId,
                amount: 111.10,
                payment_method: 'paypal',
                status: 'pending',
                transaction_id: `TRANS-PAID-${paidOrderId}`
            };

            const orderItemsNew = [{ product_id: productId, quantity: 1 }];
            const orderNewRes = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send({ shipping_address: 'Via Trans Dup', items: orderItemsNew })
                .expect(201);
            const newOrderId = orderNewRes.body.order_id;
            const newOrderAmount = parseFloat(orderNewRes.body.total_amount);

            const firstPayment = {
                ...basePaymentData,
                order_id: newOrderId,
                amount: newOrderAmount,
                status: 'completed',
                transaction_id: `UNIQUE_TRANS_${Date.now()}`
            };
            await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(firstPayment)
                .expect(201);

            const orderItemsNew2 = [{ product_id: productId, quantity: 1 }];
            const orderNewRes2 = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send({ shipping_address: 'Via Trans Dup 2', items: orderItemsNew2 })
                .expect(201);
            const newOrderId2 = orderNewRes2.body.order_id;
            const newOrderAmount2 = parseFloat(orderNewRes2.body.total_amount);

            const secondPayment = {
                ...basePaymentData,
                order_id: newOrderId2,
                amount: newOrderAmount2,
                status: 'completed',
                transaction_id: firstPayment.transaction_id
            };
            await request(app)
                .post('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(secondPayment)
                .expect(409);
        });


        const requiredPaymentFields = ['order_id', 'amount', 'payment_method', 'status'];
        requiredPaymentFields.forEach(field => {
            it(`NON dovrebbe registrare senza campo obbligatorio: ${field}`, async () => {
                const paymentDataBase = { order_id: 999, amount: 10, payment_method: 'other', status: 'pending', transaction_id: `TRANS-MISS-${field}-${Date.now()}` };
                const badData = { ...paymentDataBase };
                delete badData[field];
                await request(app)
                    .post('/api/payments')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send(badData)
                    .expect(400);
            });
        });
    });

    describe('GET /api/payments/order/:order_id', () => {
        it('Admin: dovrebbe ottenere i dettagli del pagamento per un ordine specifico', async () => {
            const res = await request(app)
                .get(`/api/payments/order/${paidOrderId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body).to.be.an('object');
            expect(res.body.order_id).to.equal(paidOrderId);
            expect(res.body.payment_id).to.equal(paidOrderPaymentId);
        });

        it('Cliente Proprietario: dovrebbe ottenere i dettagli del pagamento del proprio ordine', async () => {
            const res = await request(app)
                .get(`/api/payments/order/${paidOrderId}`)
                .set('Authorization', `Bearer ${clienteToken}`)
                .expect(200);
            expect(res.body.order_id).to.equal(paidOrderId);
            expect(res.body.payment_id).to.equal(paidOrderPaymentId);
        });

        it('Cliente NON Proprietario: NON dovrebbe ottenere dettagli (403)', async () => {
            const otherCli = await createUserAndLogin({ email: `othercli.pay.${Date.now()}@example.com`, password: 'password', role: 'cliente', full_name: 'Other Cliente Pay' });

            await request(app)
                .get(`/api/payments/order/${paidOrderId}`)
                .set('Authorization', `Bearer ${otherCli.token}`)
                .expect(403);
        });

        it('Artigiano: NON dovrebbe ottenere dettagli (403)', async () => {
            await request(app)
                .get(`/api/payments/order/${paidOrderId}`)
                .set('Authorization', `Bearer ${artigianoToken}`)
                .expect(403);
        });

        it('dovrebbe restituire 404 se il pagamento per l\'ordine non esiste', async () => {
            const orderItems = [{ product_id: productId, quantity: 1 }];
            const orderRes = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${clienteToken}`)
                .send({ shipping_address: 'Via No Payment', items: orderItems })
                .expect(201);
            const noPaymentOrderId = orderRes.body.order_id;

            await request(app)
                .get(`/api/payments/order/${noPaymentOrderId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });

        it('NON dovrebbe ottenere dettagli senza token', async () => {
            await request(app)
                .get(`/api/payments/order/${paidOrderId}`)
                .expect(401);
        });
    });

    describe('GET /api/payments/:id', () => {
        it('Admin: dovrebbe ottenere i dettagli di un pagamento specifico tramite payment_id', async () => {
            const res = await request(app)
                .get(`/api/payments/${paidOrderPaymentId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body.payment_id).to.equal(paidOrderPaymentId);
            expect(res.body.order_id).to.equal(paidOrderId);
        });

        it('Admin: dovrebbe restituire 404 per payment_id non esistente', async () => {
            await request(app)
                .get('/api/payments/99999')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });

        it('Cliente: NON dovrebbe ottenere dettagli tramite payment_id (403)', async () => {
            await request(app)
                .get(`/api/payments/${paidOrderPaymentId}`)
                .set('Authorization', `Bearer ${clienteToken}`)
                .expect(403);
        });

        it('Artigiano: NON dovrebbe ottenere dettagli tramite payment_id (403)', async () => {
            await request(app)
                .get(`/api/payments/${paidOrderPaymentId}`)
                .set('Authorization', `Bearer ${artigianoToken}`)
                .expect(403);
        });

        it('NON dovrebbe ottenere dettagli senza token', async () => {
            await request(app)
                .get(`/api/payments/${paidOrderPaymentId}`)
                .expect(401);
        });
    });

    describe('GET /api/payments', () => {
        it('Admin: dovrebbe ottenere la lista di tutti i pagamenti', async () => {
            const res = await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body).to.be.an('object');
            expect(res.body.payments).to.be.an('array');
            expect(res.body.totalItems).to.be.at.least(1);
            const paymentIds = res.body.payments.map(p => p.payment_id);
            expect(paymentIds).to.include(paidOrderPaymentId);
        });

        it('Admin: dovrebbe filtrare pagamenti per orderId', async () => {
            const res = await request(app)
                .get(`/api/payments?orderId=${paidOrderId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body.payments).to.be.an('array').with.lengthOf(1);
            expect(res.body.payments[0].payment_id).to.equal(paidOrderPaymentId);
            expect(res.body.payments[0].order_id).to.equal(paidOrderId);
        });


        it('Cliente: NON dovrebbe ottenere la lista (403)', async () => {
            await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${clienteToken}`)
                .expect(403);
        });

        it('Artigiano: NON dovrebbe ottenere la lista (403)', async () => {
            await request(app)
                .get('/api/payments')
                .set('Authorization', `Bearer ${artigianoToken}`)
                .expect(403);
        });

        it('NON dovrebbe ottenere la lista senza token', async () => {
            await request(app)
                .get('/api/payments')
                .expect(401);
        });
    });

});