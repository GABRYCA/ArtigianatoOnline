import db from '../db/database.js';
import bcrypt from 'bcryptjs';

async function seedDatabase() {
    const client = await db.getClient();
    console.log('Connesso al database, inizio seeding...');

    try {
        await client.query('BEGIN');
        console.log('Transazione iniziata.');

        // Utenti
        console.log('Inserimento utenti...');
        const passwordAdmin = await bcrypt.hash('passwordAdmin123', 10);
        const passwordArt1 = await bcrypt.hash('passwordArtigiano1', 10);
        const passwordArt2 = await bcrypt.hash('passwordArtigiano2', 10);
        const passwordCli1 = await bcrypt.hash('passwordCliente1', 10);
        const passwordCli2 = await bcrypt.hash('passwordCliente2', 10);

        const users = [
            {role: 'admin', email: 'admin@artigianato.it', password_hash: passwordAdmin, full_name: 'Admin User'},
            {
                role: 'artigiano',
                email: 'anna.rossi@artigianato.it',
                password_hash: passwordArt1,
                full_name: 'Anna Rossi',
                shop_name: 'Creazioni di Anna',
                shop_description: 'Articoli unici fatti a mano.',
                address: 'Via Roma 1, Torino',
                phone_number: '3331112233'
            },
            {
                role: 'artigiano',
                email: 'marco.verdi@artigianato.it',
                password_hash: passwordArt2,
                full_name: 'Marco Verdi',
                shop_name: 'Legno Vivo',
                shop_description: 'Mobili e oggetti in legno massello.',
                address: 'Via Po 5, Torino',
                phone_number: '3334445566'
            },
            {
                role: 'cliente',
                email: 'luca.bianchi@email.com',
                password_hash: passwordCli1,
                full_name: 'Luca Bianchi',
                address: 'Corso Francia 10, Torino',
                phone_number: '3471122334'
            },
            {
                role: 'cliente',
                email: 'sara.neri@email.com',
                password_hash: passwordCli2,
                full_name: 'Sara Neri',
                address: 'Via Garibaldi 20, Milano',
                phone_number: '3485566778'
            },
        ];

        const insertedUsers = [];
        for (const user of users) {
            const res = await client.query(
                `INSERT INTO users (role, email, password_hash, full_name, shop_name, shop_description, address,
                                    phone_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING user_id, role, email`,
                [user.role, user.email, user.password_hash, user.full_name, user.shop_name, user.shop_description, user.address, user.phone_number]
            );
            insertedUsers.push(res.rows[0]);
        }
        console.log(`Inseriti ${insertedUsers.length} utenti.`);
        const adminUser = insertedUsers.find(u => u.role === 'admin');
        const artisan1 = insertedUsers.find(u => u.email === 'anna.rossi@artigianato.it');
        const artisan2 = insertedUsers.find(u => u.email === 'marco.verdi@artigianato.it');
        const client1 = insertedUsers.find(u => u.email === 'luca.bianchi@email.com');
        const client2 = insertedUsers.find(u => u.email === 'sara.neri@email.com');

        // Categorie
        console.log('Inserimento categorie...');
        const categories = [
            {name: 'Ceramiche', description: 'Oggetti in ceramica lavorati a mano.'},
            {name: 'Tessuti', description: 'Prodotti tessili artigianali.'},
            {name: 'Legno', description: 'Creazioni artistiche in legno.'},
            {name: 'Gioielli', description: 'Gioielli unici fatti a mano.'},
            {name: 'Vasi', description: 'Vasi decorativi.', parent_category_name: 'Ceramiche'}, // Sottocategoria
        ];
        const insertedCategories = {};
        for (const cat of categories) {
            let parentId = null;
            if (cat.parent_category_name) {
                parentId = insertedCategories[cat.parent_category_name];
                if (!parentId) {
                    console.warn(`Categoria genitore "${cat.parent_category_name}" non trovata per "${cat.name}". La categoria verrà inserita senza genitore.`);
                }
            }
            const res = await client.query(
                `INSERT INTO categories (name, description, parent_category_id)
                 VALUES ($1, $2, $3)
                 RETURNING category_id, name`,
                [cat.name, cat.description, parentId]
            );
            insertedCategories[res.rows[0].name] = res.rows[0].category_id;
        }
        console.log(`Inserite ${Object.keys(insertedCategories).length} categorie.`);

        // Prodotti
        console.log('Inserimento prodotti...');
        const products = [
            {
                artisan_id: artisan1.user_id,
                category_name: 'Vasi',
                sku: 'CR-VAS-001',
                name: 'Vaso Blu Cobalto',
                description: 'Vaso in ceramica, colore blu intenso.',
                price: 45.00,
                stock_quantity: 5,
                image_url: 'https://images.unsplash.com/photo-1617567790012-c7c000b5515c?q=80'
            },
            {
                artisan_id: artisan1.user_id,
                category_name: 'Ceramiche',
                sku: 'CR-PIA-001',
                name: 'Piatto Decorativo Sole',
                description: 'Piatto da appendere dipinto a mano.',
                price: 30.50,
                stock_quantity: 10,
                image_url: 'https://images.unsplash.com/photo-1579963823690-4593d0ea2814?q=80'
            },
            {
                artisan_id: artisan2.user_id,
                category_name: 'Legno',
                sku: 'LV-TAG-001',
                name: 'Tagliere in Ulivo',
                description: 'Tagliere robusto in legno d\'ulivo massello.',
                price: 55.00,
                stock_quantity: 8,
                image_url: 'https://images.unsplash.com/photo-1601133972897-faeda6e5bab1?q=80'
            },
            {
                artisan_id: artisan2.user_id,
                category_name: 'Legno',
                sku: 'LV-SCA-001',
                name: 'Scatola Portagioie Intarsiata',
                description: 'Elegante scatola in legno.',
                price: 75.00,
                stock_quantity: 3,
                image_url: 'https://images.unsplash.com/photo-1575112946192-37008ecd1e4d?q=80'
            },
            {
                artisan_id: artisan1.user_id,
                category_name: 'Tessuti',
                sku: 'CR-SCI-001',
                name: 'Sciarpa di Seta Dipinta',
                description: 'Sciarpa leggera in pura seta dipinta a mano.',
                price: 65.00,
                stock_quantity: 12,
                image_url: 'https://images.unsplash.com/photo-1562176603-48b2cf0d96b3?q=80'
            },
            {
                artisan_id: artisan2.user_id,
                category_name: 'Legno',
                sku: 'LV-GIR-001',
                name: 'Girandola Colorata',
                description: 'Girandola in legno colorato per bambini.',
                price: 15.00,
                stock_quantity: 20,
                image_url: 'https://images.unsplash.com/photo-1620875196406-4fb23e5be9f6?q=80'
            },
        ];
        const insertedProducts = [];
        for (const prod of products) {
            const category_id = insertedCategories[prod.category_name];
            if (!category_id) {
                console.warn(`Categoria "${prod.category_name}" non trovata per il prodotto "${prod.name}". Il prodotto non sarà inserito.`);
                continue;
            }
            const res = await client.query(
                `INSERT INTO products (artisan_id, category_id, sku, name, description, price, stock_quantity,
                                       image_url)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING product_id, artisan_id, price`,
                [prod.artisan_id, category_id, prod.sku, prod.name, prod.description, prod.price, prod.stock_quantity, prod.image_url]
            );
            insertedProducts.push(res.rows[0]);
        }
        console.log(`Inseriti ${insertedProducts.length} prodotti.`);

        // Ordini
        console.log('Inserimento ordini...');
        const order1Product1 = insertedProducts.find(p => p.product_id === 1);
        const order1Product2 = insertedProducts.find(p => p.product_id === 3);
        const order1Total = order1Product1.price * 1 + order1Product2.price * 1;
        const order1Items = [
            {product: order1Product1, quantity: 1},
            {product: order1Product2, quantity: 1},
        ];

        const order2Product1 = insertedProducts.find(p => p.product_id === 5);
        const order2Total = order2Product1.price * 2;
        const order2Items = [
            {product: order2Product1, quantity: 2},
        ];

        const order3Product1 = insertedProducts.find(p => p.product_id === 6);
        const order3Total = order3Product1.price * 1;
        const order3Items = [
            {product: order3Product1, quantity: 1},
        ];


        const orders = [
            {
                customer_id: client1.user_id,
                status: 'paid',
                total_amount: order1Total,
                shipping_address: client1.address || 'Indirizzo mancante',
                items: order1Items
            },
            {
                customer_id: client2.user_id,
                status: 'shipped',
                total_amount: order2Total,
                shipping_address: client2.address || 'Indirizzo mancante',
                shipping_method: 'Corriere Espresso',
                tracking_number: 'TRACK123456XYZ',
                items: order2Items
            },
            {
                customer_id: client1.user_id,
                status: 'pending',
                total_amount: order3Total,
                shipping_address: client1.address || 'Indirizzo mancante',
                notes: 'Regalo urgente!',
                items: order3Items
            },
        ];

        const insertedOrderIds = [];
        for (const order of orders) {
            const orderRes = await client.query(
                `INSERT INTO orders (customer_id, status, total_amount, shipping_address, billing_address,
                                     shipping_method, tracking_number, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING order_id`,
                [order.customer_id, order.status, order.total_amount, order.shipping_address, order.billing_address || order.shipping_address, order.shipping_method, order.tracking_number, order.notes]
            );
            const orderId = orderRes.rows[0].order_id;
            insertedOrderIds.push(orderId);

            for (const item of order.items) {
                await client.query(
                    `INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, artisan_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [orderId, item.product.product_id, item.quantity, item.product.price, item.product.artisan_id]
                );
            }
            console.log(`Inserito ordine ${orderId} con ${order.items.length} articoli.`);

            // Simulazione aggiornamento stock
            if (!['pending', 'cancelled'].includes(order.status)) {
                for (const item of order.items) {
                    await client.query(
                        `UPDATE products
                         SET stock_quantity = stock_quantity - $1
                         WHERE product_id = $2
                           AND stock_quantity >= $1`,
                        [item.quantity, item.product.product_id]
                    );
                }
                console.log(`Stock aggiornato per ordine ${orderId} (stato: ${order.status})`);
            }
        }
        console.log(`Inseriti ${insertedOrderIds.length} ordini.`);

        // Pagamenti
        console.log('Inserimento pagamenti...');
        const paymentsToInsert = [];
        if (orders[0].status !== 'pending') {
            paymentsToInsert.push({
                order_id: insertedOrderIds[0],
                amount: orders[0].total_amount,
                payment_method: 'credit_card',
                status: 'completed',
                transaction_id: 'PAYID-ORDER1-12345'
            });
        }
        if (orders[1].status !== 'pending') {
            paymentsToInsert.push({
                order_id: insertedOrderIds[1],
                amount: orders[1].total_amount,
                payment_method: 'paypal',
                status: 'completed',
                transaction_id: 'PAYID-ORDER2-67890'
            });
        }

        let paymentsInsertedCount = 0;
        for (const payment of paymentsToInsert) {
            await client.query(
                `INSERT INTO payments (order_id, amount, payment_method, status, transaction_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [payment.order_id, payment.amount, payment.payment_method, payment.status, payment.transaction_id]
            );
            paymentsInsertedCount++;
        }
        console.log(`Inseriti ${paymentsInsertedCount} pagamenti.`);


        await client.query('COMMIT');
        console.log('Transazione completata con successo (COMMIT).');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Errore durante il seeding, rollback della transazione:', error);
        throw error;
    } finally {
        await client.release();
        console.log('Client chiuso.');
    }
}

seedDatabase().catch(error => {
    console.error("Impossibile completare il seeding del database:", error);
    process.exit(1);
});