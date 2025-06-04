import jwt from 'jsonwebtoken';
import db from '../db/database.js';

export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({message: 'Token di autenticazione mancante.'});
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, userPayload) => {
        if (err) {
            let status = 403;
            let message = 'Token non valido o scaduto.';

            if (err.name === 'TokenExpiredError') {
                message = 'Token scaduto. Effettuare nuovamente il login.';
            } else if (err.name === 'JsonWebTokenError') {
                message = 'Token non valido o malformato.';
            }

            return res.status(status).json({message: message});
        }

        try {
            const userResult = await db.query('SELECT is_active FROM users WHERE user_id = $1', [userPayload.userId]);
            
            if (userResult.rows.length === 0) {
                return res.status(401).json({message: 'Utente non trovato. Effettuare nuovamente il login.'});
            }

            if (!userResult.rows[0].is_active) {
                return res.status(403).json({message: 'Account disattivato. Contattare l\'amministratore.'});
            }

            req.user = userPayload;
            next();
        } catch (dbError) {
            console.error('Errore durante la verifica dello stato utente:', dbError);
            return res.status(500).json({message: 'Errore interno del server durante l\'autenticazione.'});
        }
    });
};

export const authorizeRoles = (...roles) => {
    return (req, res, next) => {

        if (!req.user || !req.user.role) {
            console.error("ERRORE: roles chiamato senza req.user o req.user.role validi.");
            return res.status(500).json({message: 'Errore interno di configurazione del server.'});
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Accesso negato: permessi insufficienti',
            });
        }
        next();
    };
};