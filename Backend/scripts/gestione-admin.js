import db from '../db/database.js';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

config();

class GestioneAdmin {
    static async visualizzaMenu() {
        console.log('\n=== GESTIONE UTENTI ADMIN ===');
        console.log('1. Crea nuovo utente admin');
        console.log('2. Promuovi utente esistente ad admin');
        console.log('3. Lista tutti gli admin');
        console.log('4. Disattiva utente admin');
        console.log('5. Attiva utente admin');
        console.log('6. Rimuovi privilegi admin (diventa cliente)');
        console.log('0. Esci');
        console.log('=====================================\n');
    }

    static async creaAdmin() {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const chiediInput = (domanda) => {
            return new Promise((resolve) => {
                rl.question(domanda, resolve);
            });
        };

        try {
            console.log('\n--- CREAZIONE NUOVO ADMIN ---');
            
            const email = await chiediInput('Email: ');
            if (!email || !email.includes('@')) {
                console.log('Email non valida!');
                rl.close();
                return;
            }

            const nomeCompleto = await chiediInput('Nome completo: ');
            if (!nomeCompleto.trim()) {
                console.log('Nome completo obbligatorio!');
                rl.close();
                return;
            }

            const password = await chiediInput('Password (minimo 8 caratteri): ');
            if (password.length < 8) {
                console.log('Password troppo corta! Minimo 8 caratteri.');
                rl.close();
                return;
            }

            rl.close();

            const emailEsistente = await db.query('SELECT email FROM users WHERE email = $1', [email]);
            if (emailEsistente.rows.length > 0) {
                console.log('Email già esistente nel sistema!');
                return;
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const risultato = await db.query(
                `INSERT INTO users (role, email, password_hash, full_name, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING user_id, email, full_name`,
                ['admin', email, passwordHash, nomeCompleto, true]
            );

            console.log('\n✅ Admin creato con successo!');
            console.log(`ID: ${risultato.rows[0].user_id}`);
            console.log(`Email: ${risultato.rows[0].email}`);
            console.log(`Nome: ${risultato.rows[0].full_name}`);

        } catch (errore) {
            console.error('Errore durante la creazione admin:', errore.message);
        }
    }

    static async promuoviAdmin() {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const chiediInput = (domanda) => {
            return new Promise((resolve) => {
                rl.question(domanda, resolve);
            });
        };

        try {
            console.log('\n--- PROMOZIONE UTENTE AD ADMIN ---');
            
            const utenti = await db.query(
                `SELECT user_id, email, full_name, role, is_active 
                 FROM users 
                 WHERE role != 'admin' 
                 ORDER BY created_at DESC`
            );

            if (utenti.rows.length === 0) {
                console.log('Nessun utente non-admin trovato.');
                rl.close();
                return;
            }

            console.log('\nUtenti disponibili:');
            utenti.rows.forEach((utente, indice) => {
                const stato = utente.is_active ? 'Attivo' : 'Disattivo';
                console.log(`${indice + 1}. ID: ${utente.user_id} | ${utente.email} | ${utente.full_name} | Ruolo: ${utente.role} | ${stato}`);
            });

            const scelta = await chiediInput('\nInserisci il numero dell\'utente da promuovere (0 per annullare): ');
            const indiceUtente = parseInt(scelta) - 1;

            if (indiceUtente < 0 || indiceUtente >= utenti.rows.length) {
                console.log('Selezione non valida.');
                rl.close();
                return;
            }

            const utenteSelezionato = utenti.rows[indiceUtente];
            
            const conferma = await chiediInput(`Confermi la promozione di ${utenteSelezionato.email} ad admin? (s/N): `);
            
            rl.close();

            if (conferma.toLowerCase() !== 's') {
                console.log('Operazione annullata.');
                return;
            }

            await db.query(
                `UPDATE users 
                 SET role = 'admin', updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = $1`,
                [utenteSelezionato.user_id]
            );

            console.log(`\n✅ Utente ${utenteSelezionato.email} promosso ad admin con successo!`);

        } catch (errore) {
            console.error('Errore durante la promozione:', errore.message);
        }
    }

    static async listaAdmin() {
        try {
            console.log('\n--- LISTA UTENTI ADMIN ---');
            
            const admin = await db.query(
                `SELECT user_id, email, full_name, is_active, created_at, updated_at
                 FROM users 
                 WHERE role = 'admin' 
                 ORDER BY created_at ASC`
            );

            if (admin.rows.length === 0) {
                console.log('Nessun utente admin trovato.');
                return;
            }

            console.log(`\nTrovati ${admin.rows.length} utenti admin:\n`);
            
            admin.rows.forEach((utente, indice) => {
                const stato = utente.is_active ? '🟢 Attivo' : '🔴 Disattivo';
                const dataCreazione = new Date(utente.created_at).toLocaleString('it-IT');
                const dataAggiornamento = new Date(utente.updated_at).toLocaleString('it-IT');
                
                console.log(`${indice + 1}. ${stato}`);
                console.log(`   ID: ${utente.user_id}`);
                console.log(`   Email: ${utente.email}`);
                console.log(`   Nome: ${utente.full_name || 'Non specificato'}`);
                console.log(`   Creato: ${dataCreazione}`);
                console.log(`   Aggiornato: ${dataAggiornamento}`);
                console.log('   ' + '-'.repeat(50));
            });

        } catch (errore) {
            console.error('Errore nel recuperare la lista admin:', errore.message);
        }
    }

    static async cambiaStatoAdmin(attivare = true) {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const chiediInput = (domanda) => {
            return new Promise((resolve) => {
                rl.question(domanda, resolve);
            });
        };

        try {
            const azione = attivare ? 'ATTIVAZIONE' : 'DISATTIVAZIONE';
            const statoTarget = !attivare;
            
            console.log(`\n--- ${azione} UTENTE ADMIN ---`);
            
            const admin = await db.query(
                `SELECT user_id, email, full_name, is_active 
                 FROM users 
                 WHERE role = 'admin' AND is_active = $1 
                 ORDER BY email ASC`,
                [statoTarget]
            );

            if (admin.rows.length === 0) {
                const messaggioStato = attivare ? 'disattivi' : 'attivi';
                console.log(`Nessun admin ${messaggioStato} trovato.`);
                rl.close();
                return;
            }

            console.log('\nAdmin disponibili:');
            admin.rows.forEach((utente, indice) => {
                const stato = utente.is_active ? 'Attivo' : 'Disattivo';
                console.log(`${indice + 1}. ${utente.email} | ${utente.full_name} | ${stato}`);
            });

            const scelta = await chiediInput(`\nInserisci il numero dell'admin (0 per annullare): `);
            const indiceUtente = parseInt(scelta) - 1;

            if (indiceUtente < 0 || indiceUtente >= admin.rows.length) {
                console.log('Selezione non valida.');
                rl.close();
                return;
            }

            const utenteSelezionato = admin.rows[indiceUtente];
            const azioneConferma = attivare ? 'attivazione' : 'disattivazione';
            
            const conferma = await chiediInput(`Confermi la ${azioneConferma} di ${utenteSelezionato.email}? (s/N): `);
            
            rl.close();

            if (conferma.toLowerCase() !== 's') {
                console.log('Operazione annullata.');
                return;
            }

            await db.query(
                `UPDATE users 
                 SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = $2`,
                [attivare, utenteSelezionato.user_id]
            );

            const messaggioSuccesso = attivare ? 'attivato' : 'disattivato';
            console.log(`\n✅ Admin ${utenteSelezionato.email} ${messaggioSuccesso} con successo!`);

        } catch (errore) {
            console.error(`Errore durante la modifica stato:`, errore.message);
        }
    }

    static async rimuoviPrivilegiAdmin() {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const chiediInput = (domanda) => {
            return new Promise((resolve) => {
                rl.question(domanda, resolve);
            });
        };

        try {
            console.log('\n--- RIMOZIONE PRIVILEGI ADMIN ---');
            
            const admin = await db.query(
                `SELECT user_id, email, full_name, is_active 
                 FROM users 
                 WHERE role = 'admin' 
                 ORDER BY email ASC`
            );

            if (admin.rows.length === 0) {
                console.log('Nessun utente admin trovato.');
                rl.close();
                return;
            }

            if (admin.rows.length === 1) {
                console.log('⚠️  ATTENZIONE: Questo è l\'ultimo admin del sistema!');
                console.log('Non è possibile rimuovere i privilegi all\'ultimo admin.');
                rl.close();
                return;
            }

            console.log('\nAdmin disponibili:');
            admin.rows.forEach((utente, indice) => {
                const stato = utente.is_active ? 'Attivo' : 'Disattivo';
                console.log(`${indice + 1}. ${utente.email} | ${utente.full_name} | ${stato}`);
            });

            const scelta = await chiediInput('\nInserisci il numero dell\'admin (0 per annullare): ');
            const indiceUtente = parseInt(scelta) - 1;

            if (indiceUtente < 0 || indiceUtente >= admin.rows.length) {
                console.log('Selezione non valida.');
                rl.close();
                return;
            }

            const utenteSelezionato = admin.rows[indiceUtente];
            
            console.log(`\n⚠️  ATTENZIONE: Stai per rimuovere i privilegi admin a ${utenteSelezionato.email}`);
            console.log('L\'utente diventerà un cliente normale.');
            
            const conferma = await chiediInput('Sei sicuro di voler continuare? (s/N): ');
            
            rl.close();

            if (conferma.toLowerCase() !== 's') {
                console.log('Operazione annullata.');
                return;
            }

            await db.query(
                `UPDATE users 
                 SET role = 'cliente', updated_at = CURRENT_TIMESTAMP 
                 WHERE user_id = $1`,
                [utenteSelezionato.user_id]
            );

            console.log(`\n✅ Privilegi admin rimossi da ${utenteSelezionato.email}. Ora è un cliente.`);

        } catch (errore) {
            console.error('Errore durante la rimozione privilegi:', errore.message);
        }
    }

    static async avvia() {
        const readline = await import('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const chiediInput = (domanda) => {
            return new Promise((resolve) => {
                rl.question(domanda, resolve);
            });
        };

        try {
            console.log('🔧 Sistema di Gestione Admin - Artigianato Online');
            console.log('Connessione al database in corso...');
            
            await db.query('SELECT 1');
            console.log('✅ Connesso al database con successo!');

            let continua = true;
            while (continua) {
                this.visualizzaMenu();
                const scelta = await chiediInput('Seleziona un\'opzione: ');

                switch (scelta) {
                    case '1':
                        await this.creaAdmin();
                        break;
                    case '2':
                        await this.promuoviAdmin();
                        break;
                    case '3':
                        await this.listaAdmin();
                        break;
                    case '4':
                        await this.cambiaStatoAdmin(false);
                        break;
                    case '5':
                        await this.cambiaStatoAdmin(true);
                        break;
                    case '6':
                        await this.rimuoviPrivilegiAdmin();
                        break;
                    case '0':
                        continua = false;
                        console.log('Arrivederci! 👋');
                        break;
                    default:
                        console.log('Opzione non valida. Riprova.');
                }

                if (continua) {
                    await chiediInput('\nPremi INVIO per continuare...');
                }
            }

        } catch (errore) {
            console.error('Errore critico:', errore.message);
        } finally {
            rl.close();
            process.exit(0);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    GestioneAdmin.avvia().catch(console.error);
}

export default GestioneAdmin;
