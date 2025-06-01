import { expect } from 'chai';
import request from 'supertest';
import app from '../index.js';
import db from '../db/database.js';
import { createUserAndLogin } from './testUtils.js';

let adminToken = '';
let cliente1Token = '';
let artigiano1Token = '';

let adminUserId = null;
let cliente1Id = null;
let artigiano1Id = null;

const adminData = { email: `admin.usr.${Date.now()}@example.com`, password: 'password', role: 'admin', full_name: 'Admin Users Test' };
const cliente1Data = { email: `cliente1.usr.${Date.now()}@example.com`, password: 'password', role: 'cliente', full_name: 'Cliente 1 Users Test' };
const artigiano1Data = { email: `artigiano1.usr.${Date.now()}@example.com`, password: 'password', role: 'artigiano', full_name: 'Artigiano 1 Users Test', shop_name: 'Art Usr Shop', shop_description: 'Art Usr Desc' };


describe('Users API (/api/users)', () => {

    before(async () => {
        try {
            console.log('Pulizia DB prima dei test degli utenti...');
            await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
            console.log('Tabella users pulita.');

            console.log('Creazione utenti e login...');
            const admin = await createUserAndLogin(adminData);
            adminUserId = admin.userId;
            adminToken = admin.token;

            const cli1 = await createUserAndLogin(cliente1Data);
            cliente1Id = cli1.userId;
            cliente1Token = cli1.token;

            const art1 = await createUserAndLogin(artigiano1Data);
            artigiano1Id = art1.userId;
            artigiano1Token = art1.token;
            console.log('Utenti creati e loggati.');

        } catch (err) {
            console.error('Errore FATALE durante il setup dei test utenti:', err);
            process.exit(1);
        }
    });

    describe('GET /api/users', () => {
        it('Admin: dovrebbe ottenere la lista di tutti gli utenti (sommario)', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body).to.be.an('array');
            expect(res.body.length).to.be.at.least(3);
            const sampleUser = res.body.find(u => u.user_id === cliente1Id);
            expect(sampleUser).to.exist;
            expect(sampleUser).to.have.property('user_id', cliente1Id);
            expect(sampleUser).to.have.property('email', cliente1Data.email);
            expect(sampleUser).to.have.property('role', cliente1Data.role);
            expect(sampleUser).to.have.property('full_name', cliente1Data.full_name);
            expect(sampleUser).to.have.property('is_active', true);
            expect(sampleUser).to.have.property('created_at');
            expect(sampleUser).to.not.have.property('password_hash');
        });

        it('Cliente: NON dovrebbe ottenere la lista (403)', async () => {
            await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${cliente1Token}`)
                .expect(403);
        });

        it('Artigiano: NON dovrebbe ottenere la lista (403)', async () => {
            await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(403);
        });

        it('NON dovrebbe ottenere la lista senza token (401)', async () => {
            await request(app)
                .get('/api/users')
                .expect(401);
        });
    });

    describe('GET /api/users/:id', () => {
        it('Admin: dovrebbe ottenere i dettagli di qualsiasi utente (cliente)', async () => {
            const res = await request(app)
                .get(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body).to.be.an('object');
            expect(res.body.user_id).to.equal(cliente1Id);
            expect(res.body.email).to.equal(cliente1Data.email);
            expect(res.body).to.not.have.property('password_hash');
        });

        it('Admin: dovrebbe ottenere i dettagli di qualsiasi utente (artigiano)', async () => {
            const res = await request(app)
                .get(`/api/users/${artigiano1Id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);
            expect(res.body.user_id).to.equal(artigiano1Id);
            expect(res.body.email).to.equal(artigiano1Data.email);
            expect(res.body.shop_name).to.equal(artigiano1Data.shop_name);
            expect(res.body).to.not.have.property('password_hash');
        });

        it('Cliente: dovrebbe ottenere i dettagli del PROPRIO profilo', async () => {
            const res = await request(app)
                .get(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .expect(200);
            expect(res.body.user_id).to.equal(cliente1Id);
            expect(res.body.email).to.equal(cliente1Data.email);
            expect(res.body).to.not.have.property('password_hash');
        });

        it('Artigiano: dovrebbe ottenere i dettagli del PROPRIO profilo', async () => {
            const res = await request(app)
                .get(`/api/users/${artigiano1Id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(200);
            expect(res.body.user_id).to.equal(artigiano1Id);
            expect(res.body.email).to.equal(artigiano1Data.email);
            expect(res.body.shop_name).to.equal(artigiano1Data.shop_name);
            expect(res.body).to.not.have.property('password_hash');
        });

        it('Cliente: NON dovrebbe ottenere i dettagli di un ALTRO utente (403)', async () => {
            await request(app)
                .get(`/api/users/${artigiano1Id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .expect(403);
        });

        it('Artigiano: NON dovrebbe ottenere i dettagli di un ALTRO utente (403)', async () => {
            await request(app)
                .get(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .expect(403);
        });

        it('NON dovrebbe ottenere dettagli senza token (401)', async () => {
            await request(app)
                .get(`/api/users/${cliente1Id}`)
                .expect(401);
        });

        it('dovrebbe restituire 404 per un utente non esistente', async () => {
            await request(app)
                .get('/api/users/99999')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);
        });

        it('dovrebbe restituire 400 per un ID non valido', async () => {
            await request(app)
                .get('/api/users/abc')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(400);
        });
    });

    describe('PUT /api/users/:id', () => {
        const updatePayloadCliente = {
            full_name: 'Cliente 1 Updated Name',
            address: 'Via Cliente Updated 1',
            phone_number: '111222333',
            shop_name: 'SHOULD NOT BE SET',
            shop_description: 'SHOULD NOT BE SET'
        };

        const updatePayloadArtigiano = {
            full_name: 'Artigiano 1 Updated Name',
            address: 'Via Artigiano Updated 1',
            phone_number: '444555666',
            shop_name: 'Art Usr Shop Updated',
            shop_description: 'Art Usr Desc Updated',
        };

        it('Cliente: dovrebbe aggiornare il PROPRIO profilo', async () => {
            const res = await request(app)
                .put(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send(updatePayloadCliente)
                .expect(200);

            expect(res.body.message).to.equal('Utente aggiornato con successo');
            expect(res.body.user).to.be.an('object');
            expect(res.body.user.user_id).to.equal(cliente1Id);
            expect(res.body.user.full_name).to.equal(updatePayloadCliente.full_name);
            expect(res.body.user.address).to.equal(updatePayloadCliente.address);
            expect(res.body.user.phone_number).to.equal(updatePayloadCliente.phone_number);
            expect(res.body.user.shop_name).to.be.null;
            expect(res.body.user.shop_description).to.be.null;

            const dbCheck = await db.query('SELECT full_name, address, phone_number, shop_name FROM users WHERE user_id = $1', [cliente1Id]);
            expect(dbCheck.rows[0].full_name).to.equal(updatePayloadCliente.full_name);
            expect(dbCheck.rows[0].address).to.equal(updatePayloadCliente.address);
            expect(dbCheck.rows[0].shop_name).to.be.null;
        });

        it('Artigiano: dovrebbe aggiornare il PROPRIO profilo (inclusi dati negozio)', async () => {
            const res = await request(app)
                .put(`/api/users/${artigiano1Id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send(updatePayloadArtigiano)
                .expect(200);

            expect(res.body.message).to.equal('Utente aggiornato con successo');
            expect(res.body.user.user_id).to.equal(artigiano1Id);
            expect(res.body.user.full_name).to.equal(updatePayloadArtigiano.full_name);
            expect(res.body.user.shop_name).to.equal(updatePayloadArtigiano.shop_name);
            expect(res.body.user.shop_description).to.equal(updatePayloadArtigiano.shop_description);
        });

        it('Admin: dovrebbe aggiornare il profilo di un ALTRO utente (cliente)', async () => {
            const adminUpdatePayload = { full_name: 'Cliente Aggiornato Da Admin' };
            const res = await request(app)
                .put(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(adminUpdatePayload)
                .expect(200);
            expect(res.body.user.full_name).to.equal(adminUpdatePayload.full_name);
        });

        it('Cliente: NON dovrebbe aggiornare il profilo di un ALTRO utente (403)', async () => {
            await request(app)
                .put(`/api/users/${artigiano1Id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ full_name: 'Hacked Name?'})
                .expect(403);
        });

        it('Artigiano: NON dovrebbe aggiornare il profilo di un ALTRO utente (403)', async () => {
            await request(app)
                .put(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send({ full_name: 'Hacked Name?'})
                .expect(403);
        });

        it('NON dovrebbe aggiornare senza token (401)', async () => {
            await request(app)
                .put(`/api/users/${cliente1Id}`)
                .send(updatePayloadCliente)
                .expect(401);
        });

        it('dovrebbe restituire 404 aggiornando un utente non esistente', async () => {
            await request(app)
                .put('/api/users/99999')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ full_name: 'Non Existent'})
                .expect(404);
        });

        it('dovrebbe restituire 400 se non viene fornito nessun dato per l\'aggiornamento', async () => {
            await request(app)
                .put(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({})
                .expect(400);
        });

        it('NON dovrebbe permettere l\'aggiornamento di email tramite questa route', async () => {
            const initialEmail = cliente1Data.email;
            const res = await request(app)
                .put(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ email: 'new.email@example.com', full_name: 'Name Changed Too' })
                .expect(200);

            expect(res.body.user.email).to.equal(initialEmail);
            const dbCheck = await db.query('SELECT email FROM users WHERE user_id = $1', [cliente1Id]);
            expect(dbCheck.rows[0].email).to.equal(initialEmail);
            expect(res.body.user.full_name).to.equal('Name Changed Too');
        });

        it('NON dovrebbe permettere l\'aggiornamento di ruolo tramite questa route', async () => {
            const initialRole = cliente1Data.role;
            const res = await request(app)
                .put(`/api/users/${cliente1Id}`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({ role: 'admin', full_name: 'Role Change Attempt' })
                .expect(200);

            expect(res.body.user.role).to.equal(initialRole);
            const dbCheck = await db.query('SELECT role FROM users WHERE user_id = $1', [cliente1Id]);
            expect(dbCheck.rows[0].role).to.equal(initialRole);
            expect(res.body.user.full_name).to.equal('Role Change Attempt');
        });

    });

    describe('PUT /api/users/:id/cambia-password', () => {

        it('Cliente: dovrebbe cambiare la propria password con successo', async () => {
            const nuovaPassword = 'nuovaPasswordSicura123';
            const res = await request(app)
                .put(`/api/users/${cliente1Id}/cambia-password`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({
                    password_attuale: cliente1Data.password,
                    nuova_password: nuovaPassword
                })
                .expect(200);

            expect(res.body.message).to.equal('Password cambiata con successo');

            // Verifica che la nuova password funzioni per il login
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: cliente1Data.email, password: nuovaPassword })
                .expect(200);

            expect(loginRes.body.message).to.equal('Login effettuato con successo');
        });

        it('Artigiano: dovrebbe cambiare la propria password con successo', async () => {
            const nuovaPassword = 'passwordArtigianoNuova456';
            const res = await request(app)
                .put(`/api/users/${artigiano1Id}/cambia-password`)
                .set('Authorization', `Bearer ${artigiano1Token}`)
                .send({
                    password_attuale: artigiano1Data.password,
                    nuova_password: nuovaPassword
                })
                .expect(200);

            expect(res.body.message).to.equal('Password cambiata con successo');
        });

        it('Admin: dovrebbe cambiare la password di qualsiasi utente', async () => {
            const nuovaPassword = 'passwordCambiataAdmin789';
            const res = await request(app)
                .put(`/api/users/${cliente1Id}/cambia-password`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    password_attuale: cliente1Data.password,
                    nuova_password: nuovaPassword
                })
                .expect(200);

            expect(res.body.message).to.equal('Password cambiata con successo');
        });

        it('NON dovrebbe cambiare password con password attuale errata', async () => {
            await request(app)
                .put(`/api/users/${cliente1Id}/cambia-password`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({
                    password_attuale: 'passwordErrata',
                    nuova_password: 'nuovaPasswordTest123'
                })
                .expect(401);
        });

        it('NON dovrebbe cambiare password se troppo corta', async () => {
            await request(app)
                .put(`/api/users/${cliente1Id}/cambia-password`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({
                    password_attuale: cliente1Data.password,
                    nuova_password: '123'
                })
                .expect(400);
        });

        it('Cliente: NON dovrebbe cambiare la password di un altro utente', async () => {
            await request(app)
                .put(`/api/users/${artigiano1Id}/cambia-password`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({
                    password_attuale: artigiano1Data.password,
                    nuova_password: 'tentativoViolazione123'
                })
                .expect(403);
        });

        it('NON dovrebbe cambiare password senza token', async () => {
            await request(app)
                .put(`/api/users/${cliente1Id}/cambia-password`)
                .send({
                    password_attuale: cliente1Data.password,
                    nuova_password: 'nuovaPasswordTest123'
                })
                .expect(401);
        });

        it('NON dovrebbe cambiare password senza dati richiesti', async () => {
            await request(app)
                .put(`/api/users/${cliente1Id}/cambia-password`)
                .set('Authorization', `Bearer ${cliente1Token}`)
                .send({})
                .expect(400);
        });

        it('dovrebbe restituire 404 per utente non esistente', async () => {
            await request(app)
                .put('/api/users/99999/cambia-password')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    password_attuale: 'qualsiasi',
                    nuova_password: 'nuovaPasswordTest123'
                })
                .expect(404);
        });

    });

});