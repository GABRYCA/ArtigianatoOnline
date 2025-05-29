import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

import userRoutes from './routes/users.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import authRoutes from './routes/auth.js';

// .env
config();

const app = express();
const PORT = process.env.PORT || 3000;

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Artigianato Online API',
            version: '0.0.1',
            description: 'API RESTful per la piattaforma e-commerce Artigianato Online.',
        },
        /*
        servers: [
            {
                url: process.env.PUBLIC_BACKEND_URL || `http://localhost:${PORT}`,
            },
        ],
         */
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT per autenticazione. Inserire il token preceduto da "Bearer ". Esempio: "Bearer eyJhbGciOiJI..."'
                },
            },
        },
        tags: [
            { name: 'Autenticazione', description: 'Endpoint per registrazione e login' },
            { name: 'Utenti', description: 'Gestione profili utente (clienti, artigiani, admin)' },
            { name: 'Categorie', description: 'Gestione categorie prodotti' },
            { name: 'Prodotti', description: 'Gestione prodotti degli artigiani' },
            { name: 'Ordini', description: 'Gestione ordini dei clienti' },
            { name: 'Pagamenti', description: 'Gestione pagamenti associati agli ordini' },
        ]
    },
    apis: ['./routes/*.js'],
}

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const swaggerDocs = swaggerJSDoc(swaggerOptions);

try {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
} catch (error) {
    console.log('Errore durante la generazione dello Swagger.');
}

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/', (req, res) => {
    res.send('Artigianato Online API attivo - Backend');
});

const startServer = () => {
    app.listen(PORT, () => {
        console.log(`Server avviato sulla porta ${PORT}`);
        console.log(`Documentazione API: http://localhost:${PORT}/api-docs`);
    });
};

if (process.env.NODE_ENV !== 'test') startServer();

export default app;