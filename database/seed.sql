-- =============================================================
-- Seed Data — shared demo/test values for all contributors
-- Rules:
--   1. Always use INSERT OR IGNORE (safe to re-run on restart)
--   2. Always use an explicit id so foreign keys stay consistent
--   3. Append your rows at the bottom — never edit existing rows
-- =============================================================

-- Demo user (password: "password123" — bcrypt hash)
INSERT OR IGNORE INTO users (id, email, username, password_hash) VALUES
(1, 'demo@example.com', 'DemoUser', '$2b$10$Fo4soNAkdZGGzMFAnqhsHOiGFBFnGXHmmHS1Ql5W2BjE3DlJGdSWq');

-- Sample income
INSERT OR IGNORE INTO income (id, user_id, source_type, description, amount, frequency, tax_band) VALUES
(1, 1, 'Employment', 'Main job salary', 35000, 'Annual', 'Basic Rate'),
(2, 1, 'Rental', 'Flat rental income', 800, 'Monthly', 'Basic Rate');

-- Sample assets
INSERT OR IGNORE INTO assets (id, user_id, category, description, value) VALUES
(1, 1, 'Property', 'Family home', 220000),
(2, 1, 'Savings', 'ISA account', 8500);

-- Sample liabilities
INSERT OR IGNORE INTO liabilities (id, user_id, category, description, balance, interest_rate) VALUES
(1, 1, 'Mortgage', 'Home mortgage', 150000, 3.5),
(2, 1, 'Credit Card', 'Visa credit card', 1200, 19.9);

-- Sample protection
INSERT OR IGNORE INTO protection (id, user_id, policy_type, provider, premium, start_date, renewal_date) VALUES
(1, 1, 'Life Insurance', 'Aviva', 45.00, '2024-01-01', '2025-01-01');

-- Sample estate
INSERT OR IGNORE INTO estate (id, user_id, item_type, status, details, contact_info) VALUES
(1, 1, 'Will', 'In place', 'Drafted with solicitor', 'solicitor@example.com');

-- Sample intangibles
INSERT OR IGNORE INTO intangibles (id, user_id, category, score, description) VALUES
(1, 1, 'Health', 8, 'Good overall physical health'),
(2, 1, 'Skills', 7, 'Software development and finance knowledge');
