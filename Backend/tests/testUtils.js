import bcrypt from "bcryptjs";
import db from "../db/database.js";
import request from "supertest";
import app from "../index.js";

export async function getAdminToken() {
    const adminEmail = `test.admin.helper.${Date.now()}@example.com`;
    const adminPassword = 'adminPasswordHelper';
    const adminData = {
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        full_name: 'Admin Helper',
    };
    await createUserAndLogin(adminData);

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: adminEmail, password: adminPassword })
        .expect(200);
    return loginRes.body.token;
}

export const createUserAndLogin = async (userData) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(userData.password, salt);
    const userRes = await db.query(
        `INSERT INTO users (email, password_hash, role, full_name, shop_name, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING user_id`,
        [userData.email, hash, userData.role, userData.full_name, userData.shop_name || null]
    );
    const userId = userRes.rows[0].user_id;

    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password })
        .expect(200);
    const token = loginRes.body.token;
    return { userId, token };
};