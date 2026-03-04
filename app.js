const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// --- Middleware ---

// Parse form data
app.use(express.urlencoded({ extended: false }));

// Serve static files (CSS, images, client JS)
app.use(express.static(path.join(__dirname, 'public')));

// Session config
app.use(session({
    secret: 'finance-app-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 2 } // 2 hours
}));

// Make session user available in all EJS templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Routes ---

const authRoutes = require('./routes/auth');
app.use(authRoutes);

// Dashboard (protected)
app.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('dashboard', { title: 'Dashboard' });
});

// --- Start server ---
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
