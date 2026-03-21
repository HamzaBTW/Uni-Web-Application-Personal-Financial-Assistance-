const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const db = require('./database');

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_SIZE = 1024 * 100; // 100 KB
const ALLOWED_TABLES = new Set(['protection', 'estate', 'income', 'assets', 'liabilities', 'intangibles']);

// Session store: sessionId -> { id, email, username }
const sessions = new Map();

function getSessionId(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    return cookies.sid || null;
}

function buildSessionCookie(sid, maxAge = 7200) {
    return cookie.serialize('sid', sid, {
        httpOnly: true,
        path: '/',
        maxAge: maxAge,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
    });
}

function securityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'",
    };
}

function sanitizeInput(str) {
    if (str == null) return null;
    return String(str).trim().replace(/<[^>]*>/g, '').substring(0, 1000);
}

function getUser(req) {
    const sid = getSessionId(req);
    return sid ? sessions.get(sid) : null;
}

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404, { ...securityHeaders() }); return res.end('Not found'); }
        const ext = path.extname(filePath).toLowerCase();
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', ...securityHeaders() });
        res.end(data);
    });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let b = '';
        let size = 0;
        req.on('data', c => {
            size += c.length;
            if (size > MAX_BODY_SIZE) {
                req.destroy();
                return reject(new Error('Request body too large'));
            }
            b += c;
        });
        req.on('end', () => resolve(b));
        req.on('error', reject);
    });
}

function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...securityHeaders() });
    res.end(JSON.stringify(data));
}

function redirect(res, location) {
    res.writeHead(302, { 'Location': location, ...securityHeaders() });
    res.end();
}

const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, `http://localhost:${DEFAULT_PORT}`);
    const method = req.method;

    // GET /api/me
    if (pathname === '/api/me' && method === 'GET') {
        const user = getUser(req);
        return user ? json(res, 200, user) : json(res, 401, { error: 'Not logged in' });
    }

    // POST /api/login
    if (pathname === '/api/login' && method === 'POST') {
        let fields;
        try {
            fields = Object.fromEntries(new URLSearchParams(await readBody(req)));
        } catch (err) {
            return json(res, 413, { error: 'Request body too large.' });
        }
        const email = (fields.email || '').trim().toLowerCase();
        const password = fields.password || '';
        if (!email) return json(res, 400, { error: 'Email is required.' });
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return json(res, 401, { error: 'Invalid email or password.' });
        }
        const sid = crypto.randomBytes(32).toString('hex');
        sessions.set(sid, { id: user.id, email: user.email, username: user.username });
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': buildSessionCookie(sid),
            ...securityHeaders()
        });
        return res.end(JSON.stringify({ success: true }));
    }

    // POST /api/signup
    if (pathname === '/api/signup' && method === 'POST') {
        let fields;
        try {
            fields = Object.fromEntries(new URLSearchParams(await readBody(req)));
        } catch (err) {
            return json(res, 413, { error: 'Request body too large.' });
        }
        const email = (fields.email || '').trim().toLowerCase();
        const username = (fields.username || '').trim();
        const password = fields.password || '';
        const confirm_password = fields.confirm_password || '';
        if (!email || !username || !password || !confirm_password) return json(res, 400, { error: 'All fields are required.' });
        if (password !== confirm_password) return json(res, 400, { error: 'Passwords do not match.' });
        if (password.length < 6) return json(res, 400, { error: 'Password must be at least 6 characters.' });
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return json(res, 400, { error: 'Invalid email format.' });
        if (!/^[a-zA-Z0-9_ ]{2,30}$/.test(username)) return json(res, 400, { error: 'Username must be 2-30 characters (letters, numbers, spaces, underscores).' });
        if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return json(res, 400, { error: 'Email already registered.' });
        db.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)').run(email, username, bcrypt.hashSync(password, 10));
        return json(res, 200, { success: true });
    }

    // GET /api/logout
    if (pathname === '/api/logout' && method === 'GET') {
        const sid = getSessionId(req);
        if (sid) sessions.delete(sid);
        res.writeHead(302, {
            'Set-Cookie': buildSessionCookie('', 0),
            'Location': '/auth.html',
            ...securityHeaders()
        });
        return res.end();
    }

    // POST /api/preferences — save user preferences as a cookie
    if (pathname === '/api/preferences' && method === 'POST') {
        const user = getUser(req);
        if (!user) return json(res, 401, { error: 'Not logged in' });
        let fields;
        try {
            fields = Object.fromEntries(new URLSearchParams(await readBody(req)));
        } catch (err) {
            return json(res, 413, { error: 'Request body too large.' });
        }
        const allowed = ['light', 'dark'];
        const safeTheme = allowed.includes(fields.theme) ? fields.theme : 'light';
        const prefCookie = cookie.serialize('prefs', JSON.stringify({ theme: safeTheme }), {
            httpOnly: false,
            path: '/',
            maxAge: 31536000,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production',
        });
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': prefCookie,
            ...securityHeaders()
        });
        return res.end(JSON.stringify({ success: true, theme: safeTheme }));
    }

    // ─── AUTH-GUARDED HELPER ───
    function requireAuth() {
        const user = getUser(req);
        if (!user) { json(res, 401, { error: 'Not logged in' }); return null; }
        return user;
    }

    // ─── GENERIC CRUD ───
    function handleCrud(tableName) {
        if (!ALLOWED_TABLES.has(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        const base = `/api/${tableName}`;

        // GET /api/{table} — list rows for logged-in user
        if (pathname === base && method === 'GET') {
            const user = requireAuth();
            if (!user) return true;
            const rows = db.prepare(`SELECT * FROM ${tableName} WHERE user_id = ? ORDER BY id DESC`).all(user.id);
            json(res, 200, rows);
            return true;
        }

        // POST /api/{table} — create row
        if (pathname === base && method === 'POST') {
            return 'create';
        }

        // POST /api/{table}/:id/edit
        const editMatch = pathname.match(new RegExp(`^${base}/(\\d+)/edit$`));
        if (editMatch && method === 'POST') {
            return { action: 'edit', id: editMatch[1] };
        }

        // POST /api/{table}/:id/delete
        const deleteMatch = pathname.match(new RegExp(`^${base}/(\\d+)/delete$`));
        if (deleteMatch && method === 'POST') {
            return { action: 'delete', id: deleteMatch[1] };
        }

        return false;
    }

    async function executeCrud(tableName, columns, match) {
        if (!ALLOWED_TABLES.has(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        const user = requireAuth();
        if (!user) return;
        const colNames = columns.map(c => c.name);
        for (const col of colNames) {
            if (!/^[a-z_]+$/.test(col)) {
                throw new Error(`Invalid column name: ${col}`);
            }
        }

        if (match === 'create') {
            let fields;
            try {
                fields = Object.fromEntries(new URLSearchParams(await readBody(req)));
            } catch (err) {
                return json(res, 413, { error: 'Request body too large.' });
            }
            const placeholders = colNames.map(() => '?').join(', ');
            const values = colNames.map(c => sanitizeInput(fields[c]));
            db.prepare(`INSERT INTO ${tableName} (user_id, ${colNames.join(', ')}) VALUES (?, ${placeholders})`).run(user.id, ...values);
            return json(res, 200, { success: true });
        }

        if (match.action === 'edit') {
            let fields;
            try {
                fields = Object.fromEntries(new URLSearchParams(await readBody(req)));
            } catch (err) {
                return json(res, 413, { error: 'Request body too large.' });
            }
            const sets = colNames.map(c => `${c} = ?`).join(', ');
            const values = colNames.map(c => sanitizeInput(fields[c]));
            db.prepare(`UPDATE ${tableName} SET ${sets} WHERE id = ? AND user_id = ?`).run(...values, match.id, user.id);
            return json(res, 200, { success: true });
        }

        if (match.action === 'delete') {
            db.prepare(`DELETE FROM ${tableName} WHERE id = ? AND user_id = ?`).run(match.id, user.id);
            return json(res, 200, { success: true });
        }
    }

    // ─── PROTECTION CRUD ───
    const protectionCols = [
        { name: 'policy_type' }, { name: 'provider' }, { name: 'premium' },
        { name: 'start_date' }, { name: 'renewal_date' }
    ];
    const protectionMatch = handleCrud('protection');
    if (protectionMatch === true) return;
    if (protectionMatch) return executeCrud('protection', protectionCols, protectionMatch);

    // ─── ESTATE CRUD ───
    const estateCols = [
        { name: 'item_type' }, { name: 'status' }, { name: 'details' },
        { name: 'contact_info' }
    ];
    const estateMatch = handleCrud('estate');
    if (estateMatch === true) return;
    if (estateMatch) return executeCrud('estate', estateCols, estateMatch);

    // ─── ASSETS CRUD ───
    const assetCols = [
        { name: 'category' }, { name: 'description' }, { name: 'value' }
    ];
    const assetMatch = handleCrud('assets');
    if (assetMatch === true) return;
    if (assetMatch) return executeCrud('assets', assetCols, assetMatch);

    // ─── LIABILITIES CRUD ───
    const liabilityCols = [
        { name: 'category' }, { name: 'description' }, { name: 'balance' }, { name: 'interest_rate' }
    ];
    const liabilityMatch = handleCrud('liabilities');
    if (liabilityMatch === true) return;
    if (liabilityMatch) return executeCrud('liabilities', liabilityCols, liabilityMatch);

    // ─── DASHBOARD AGGREGATES ───
    if (pathname === '/api/dashboard' && method === 'GET') {
        const user = requireAuth();
        if (!user) return;

        const totalIncome = db.prepare(`SELECT COALESCE(SUM(
            CASE frequency WHEN 'weekly' THEN amount * 52 WHEN 'monthly' THEN amount * 12 WHEN 'annual' THEN amount ELSE amount END
        ), 0) AS total FROM income WHERE user_id = ?`).get(user.id).total;

        const totalAssets = db.prepare('SELECT COALESCE(SUM(value), 0) AS total FROM assets WHERE user_id = ?').get(user.id).total;
        const totalLiabilities = db.prepare('SELECT COALESCE(SUM(balance), 0) AS total FROM liabilities WHERE user_id = ?').get(user.id).total;
        const protectionCount = db.prepare('SELECT COUNT(*) AS count FROM protection WHERE user_id = ?').get(user.id).count;

        const estateRow = db.prepare(`SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS completed
            FROM estate WHERE user_id = ?`).get(user.id);

        const avgIntangible = db.prepare('SELECT COALESCE(AVG(score), 0) AS avg FROM intangibles WHERE user_id = ?').get(user.id).avg;

        return json(res, 200, {
            income: totalIncome,
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: totalAssets - totalLiabilities,
            protectionPolicies: protectionCount,
            estateTotal: estateRow.total,
            estateCompleted: estateRow.completed,
            intangibleAvg: Math.round(avgIntangible * 10) / 10
        });
    }

    // Convenience redirects
    if (pathname === '/') return redirect(res, '/welcome.html');
    if (pathname === '/login' || pathname === '/signup') return redirect(res, '/auth.html');
    if (pathname === '/dashboard') return redirect(res, '/dashboard.html');
    if (pathname === '/logout') return redirect(res, '/api/logout');

    // Static files — check /public, then each templates subfolder, then /templates root
    const stripped = pathname.replace(/^\//, '');
    const candidates = [
        path.join(__dirname, 'public', stripped),
        path.join(__dirname, 'templates', 'Welcome_Page', stripped),
        path.join(__dirname, 'templates', 'Auth', stripped),
        path.join(__dirname, 'templates', 'Dashboard', stripped),
        path.join(__dirname, 'templates', 'Assets', stripped),
        path.join(__dirname, 'templates', 'Liabilities', stripped),
        path.join(__dirname, 'templates', 'Protection', stripped),
        path.join(__dirname, 'templates', 'Estate', stripped),
        path.join(__dirname, 'templates', stripped),
    ];
    for (const f of candidates) {
        if (fs.statSync(f, { throwIfNoEntry: false })?.isFile()) return serveFile(res, f);
    }

    res.writeHead(404, { ...securityHeaders() });
    res.end('Not found');
});

let currentPort = DEFAULT_PORT;
let retryCount = 0;
const MAX_PORT_RETRIES = 10;

server.on('listening', () => {
    const address = server.address();
    if (address && typeof address === 'object') {
        console.log(`Server running at http://localhost:${address.port}`);
    }
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && retryCount < MAX_PORT_RETRIES) {
        console.warn(`Port ${currentPort} is busy, trying ${currentPort + 1}...`);
        currentPort += 1;
        retryCount += 1;
        return server.listen(currentPort);
    }
    throw err;
});

server.listen(currentPort);