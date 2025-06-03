import {expect} from 'chai';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index.js';
import db from '../db/database.js';

const clienteData = {
    email: `test.cliente.${Date.now()}@example.com`,
    password: 'password123',
    role: 'cliente',
    full_name: 'Test Cliente',
};

const artigianoData = {
    email: `test.artigiano.${Date.now()}@example.com`,
    password: 'password456',
    role: 'artigiano',
    full_name: 'Test Artigiano',
    shop_name: 'Bottega Test',
    shop_description: 'Descrizione test negozio',
};

describe('Auth API (/api/auth)', () => {

    before(async () => {
        try {
            console.log('Pulizia DB prima dei test di autenticazione...');
            await db.query('TRUNCATE TABLE payments, order_items, orders, products, categories, users RESTART IDENTITY CASCADE');
            console.log('Tabelle rilevanti pulite.');
        } catch (err) {
            console.error('Errore FATALE durante la pulizia del DB prima dei test:', err);
            process.exit(1);
        }
    });

    afterEach(async () => {
        try {
            await db.query('DELETE FROM users');
        } catch (err) {
            console.error('Errore durante la pulizia della tabella users dopo un test:', err);
        }
    });

    describe('POST /api/auth/register', () => {

        it('dovrebbe registrare un nuovo utente CLIENTE con successo', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(clienteData)
                .expect(201);

            expect(res.body).to.be.an('object');
            expect(res.body.message).to.equal('Registrazione effettuata con successo');
            expect(res.body.user).to.have.property('user_id');
            expect(res.body.user.email).to.equal(clienteData.email);
            expect(res.body.user.role).to.equal('cliente');
        });

        it('dovrebbe registrare un nuovo utente ARTIGIANO con successo', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(artigianoData)
                .expect(201);

            expect(res.body.message).to.equal('Registrazione effettuata con successo');
            expect(res.body.user.email).to.equal(artigianoData.email);
            expect(res.body.user.role).to.equal('artigiano');

            const dbRes = await db.query('SELECT shop_name FROM users WHERE email = $1', [artigianoData.email]);
            expect(dbRes.rows.length).to.equal(1);
            expect(dbRes.rows[0].shop_name).to.equal(artigianoData.shop_name);
        });

        it('NON dovrebbe registrare un utente con email già esistente', async () => {
            await request(app)
                .post('/api/auth/register')
                .send(clienteData)
                .expect(201);

            const res = await request(app)
                .post('/api/auth/register')
                .send(clienteData)
                .expect(400);

            expect(res.body.message).to.contain('Email già registrata');
        });
        it('NON dovrebbe registrare senza email', async () => {
            const badData = {...clienteData};
            delete badData.email;

            const res = await request(app)
                .post('/api/auth/register')
                .send(badData)
                .expect(400);

            expect(res.body.message).to.contain('obbligatori');
        });

        it('NON dovrebbe registrare senza password', async () => {
            const badData = {...clienteData};
            delete badData.password;

            const res = await request(app)
                .post('/api/auth/register')
                .send(badData)
                .expect(400);

            expect(res.body.message).to.contain('obbligatori');
        });

        it('NON dovrebbe registrare un ARTIGIANO senza shop_name', async () => {
            const {shop_name, ...badArtigianoData} = artigianoData;
            const res = await request(app)
                .post('/api/auth/register')
                .send(badArtigianoData)
                .expect(400);

            expect(res.body.message).to.contain('nome del negozio è obbligatorio');
        });

        it('NON dovrebbe registrare con ruolo non valido', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({...clienteData, role: 'superutente'})
                .expect(400);

            expect(res.body.message).to.contain('Ruolo non valido');
        });
    });

    describe('POST /api/auth/login', () => {

        beforeEach(async () => {
            try {
                await db.query('DELETE FROM users');
                const salt = await bcrypt.genSalt(10);
                const password_hash = await bcrypt.hash(clienteData.password, salt);
                await db.query(
                    `INSERT INTO users (email, password_hash, role, full_name, is_active)
                     VALUES ($1, $2, $3, $4, TRUE)`,
                    [clienteData.email, password_hash, clienteData.role, clienteData.full_name]
                );
            } catch (err) {
                console.error('Errore durante la creazione utente per test di login:', err);
                throw err;
            }
        });

        it('dovrebbe effettuare il login di un utente esistente e restituire un token JWT', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({email: clienteData.email, password: clienteData.password})
                .expect(200);

            expect(res.body).to.be.an('object');
            expect(res.body.message).to.equal('Login effettuato con successo');
            expect(res.body).to.have.property('token');
            expect(res.body.token).to.be.a('string');
            expect(res.body.user).to.have.property('user_id');
            expect(res.body.user.email).to.equal(clienteData.email);
            expect(res.body.user.role).to.equal(clienteData.role);
        });

        it('NON dovrebbe effettuare il login con password errata', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({email: clienteData.email, password: 'passwordErrata'})
                .expect(401);

            expect(res.body.message).to.equal('Credenziali non valide.');
        });

        it('NON dovrebbe effettuare il login con email non esistente', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({email: 'inesistente@example.com', password: clienteData.password})
                .expect(401);

            expect(res.body.message).to.equal('Credenziali non valide.');
        });

        it('NON dovrebbe effettuare il login senza email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({password: clienteData.password})
                .expect(400);

            expect(res.body.message).to.equal('Email e password sono obbligatorie.');
        });

        it('NON dovrebbe effettuare il login senza password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({email: clienteData.email})
                .expect(400);

            expect(res.body.message).to.equal('Email e password sono obbligatorie.');
        });

        it('NON dovrebbe effettuare il login se l\'utente non è attivo', async () => {
            await db.query('UPDATE users SET is_active = FALSE WHERE email = $1', [clienteData.email]);

            const res = await request(app)
                .post('/api/auth/login')
                .send({email: clienteData.email, password: clienteData.password})
                .expect(401);

            expect(res.body.message).to.equal('Credenziali non valide.');
        });
    });

    describe('POST /api/auth/verify-token', () => {

        let token;

        beforeEach(async () => {
            try {
                await db.query('DELETE FROM users');
                const salt = await bcrypt.genSalt(10);
                const password_hash = await bcrypt.hash(clienteData.password, salt);
                await db.query(
                    `INSERT INTO users (email, password_hash, role, full_name, is_active)
                     VALUES ($1, $2, $3, $4, TRUE)`,
                    [clienteData.email, password_hash, clienteData.role, clienteData.full_name]
                );
            } catch (err) {
                console.error('Errore durante la creazione utente per test di verifica token:', err);
                throw err;
            }

            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({email: clienteData.email, password: clienteData.password})
                .expect(200);

            token = loginRes.body.token;
        });

        it('dovrebbe verificare un token JWT valido', async () => {
            const res = await request(app)
                .post('/api/auth/verify-token')
                .send({token: token})
                .expect(200);

            expect(res.body.valid).to.equal(true);
            expect(res.body.user).to.be.an('object');
            expect(res.body.user).to.have.property('userId');
        });

        it('NON dovrebbe verificare un token JWT non valido', async () => {
            const res = await request(app)
                .post('/api/auth/verify-token')
                .send({token: "tokenNonValido"})
                .expect(401);

            expect(res.body.valid).to.equal(false);
            expect(res.body.message).to.equal('Token non valido o malformato.');
        });

        it('NON dovrebbe verificare senza token', async () => {
            const res = await request(app)
                .post('/api/auth/verify-token')
                .expect(400);

            expect(res.body.valid).to.equal(false);
            expect(res.body.message).to.equal('Token mancante nel body.');
        });
    });
});
