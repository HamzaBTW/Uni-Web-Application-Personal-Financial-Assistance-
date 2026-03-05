const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');

const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('auth', { title: 'Login', mode: 'login', error: null });
});

// POST /login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
        return res.render('auth', { title: 'Login', mode: 'login', error: 'Invalid email or password.' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
        return res.render('auth', { title: 'Login', mode: 'login', error: 'Invalid email or password.' });
    }

    // Store user in session (exclude password hash)
    req.session.user = {
        id: user.id,
        email: user.email,
        username: user.username
    };

    res.redirect('/dashboard');
});

// GET /signup
router.get('/signup', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('auth', { title: 'Sign Up', mode: 'signup', error: null });
});

// POST /signup
router.post('/signup', (req, res) => {
    const { email, username, password, confirm_password } = req.body;

    // Validation
    if (!email || !username || !password || !confirm_password) {
        return res.render('auth', { title: 'Sign Up', mode: 'signup', error: 'All fields are required.' });
    }

    if (password !== confirm_password) {
        return res.render('auth', { title: 'Sign Up', mode: 'signup', error: 'Passwords do not match.' });
    }

    if (password.length < 6) {
        return res.render('auth', { title: 'Sign Up', mode: 'signup', error: 'Password must be at least 6 characters.' });
    }

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        return res.render('auth', { title: 'Sign Up', mode: 'signup', error: 'Email already registered.' });
    }

    // Hash password and insert
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)').run(email, username, hash);

    res.redirect('/login');
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

module.exports = router;
