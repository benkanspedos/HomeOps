-- Seed data for development environment

-- Insert test user (password: testuser123)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data)
VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'test@homeops.local',
    crypt('testuser123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"full_name": "Test User", "avatar_url": "https://api.dicebear.com/7.x/avataaars/svg?seed=test"}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Insert test accounts
INSERT INTO public.accounts (id, user_id, name, type, institution, account_number, balance, currency)
VALUES 
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 
     'Main Checking', 'bank', 'Chase Bank', '****1234', 5420.50, 'USD'),
    ('b2c3d4e5-f678-90ab-cdef-123456789012', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 
     'Investment Portfolio', 'investment', 'E*TRADE', '****5678', 25750.00, 'USD'),
    ('c3d4e5f6-7890-abcd-ef12-345678901234', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 
     'Crypto Wallet', 'crypto', 'Coinbase', '0xAbC...xYz', 0.5423, 'BTC')
ON CONFLICT (id) DO NOTHING;

-- Insert sample transactions
INSERT INTO public.transactions (account_id, type, amount, currency, description, category, transaction_date)
VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'deposit', 3000.00, 'USD', 'Salary Deposit', 'Income', NOW() - INTERVAL '5 days'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'withdrawal', 150.00, 'USD', 'ATM Withdrawal', 'Cash', NOW() - INTERVAL '3 days'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'withdrawal', 89.99, 'USD', 'Grocery Store', 'Food', NOW() - INTERVAL '2 days'),
    ('b2c3d4e5-f678-90ab-cdef-123456789012', 'trade', 500.00, 'USD', 'Buy AAPL', 'Investment', NOW() - INTERVAL '7 days'),
    ('b2c3d4e5-f678-90ab-cdef-123456789012', 'dividend', 25.50, 'USD', 'Dividend Payment', 'Income', NOW() - INTERVAL '1 day'),
    ('c3d4e5f6-7890-abcd-ef12-345678901234', 'trade', 0.025, 'BTC', 'Buy Bitcoin', 'Crypto', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- Insert sample alerts
INSERT INTO public.alerts (user_id, name, description, severity, condition_type, condition_config, notification_channels)
VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 
     'Low Balance Alert', 
     'Alert when checking account falls below $500', 
     'warning', 
     'balance',
     '{"account_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "threshold": 500, "operator": "less_than"}'::jsonb,
     '["email", "push"]'::jsonb),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 
     'Large Transaction Alert', 
     'Alert for transactions over $1000', 
     'info', 
     'transaction',
     '{"amount_threshold": 1000, "operator": "greater_than"}'::jsonb,
     '["email"]'::jsonb),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 
     'Bitcoin Price Alert', 
     'Alert when Bitcoin drops below $40,000', 
     'warning', 
     'price',
     '{"symbol": "BTC", "threshold": 40000, "operator": "less_than"}'::jsonb,
     '["email", "sms"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Insert sample automations
INSERT INTO public.automations (user_id, name, description, trigger_type, trigger_config, actions, status)
VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479',
     'Daily Balance Report',
     'Send daily account balance summary',
     'schedule',
     '{"cron": "0 9 * * *", "timezone": "America/New_York"}'::jsonb,
     '[{"type": "email_report", "config": {"template": "daily_balance", "recipients": ["test@homeops.local"]}}]'::jsonb,
     'active'),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479',
     'Auto-Transfer Savings',
     'Transfer excess funds to savings when balance exceeds $5000',
     'condition',
     '{"account_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "threshold": 5000, "check_frequency": "daily"}'::jsonb,
     '[{"type": "transfer", "config": {"from_account": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "to_account": "savings", "amount_formula": "balance - 5000"}}]'::jsonb,
     'active')
ON CONFLICT DO NOTHING;

-- Insert sample services
INSERT INTO public.services (user_id, name, container_name, image, status, health_check_url, ports)
VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479',
     'HomeOps Backend',
     'homeops-backend',
     'homeops/backend:latest',
     'running',
     'http://localhost:3001/health',
     '[{"host": 3001, "container": 3001}]'::jsonb),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479',
     'Redis Cache',
     'homeops-redis',
     'redis:7-alpine',
     'running',
     null,
     '[{"host": 6379, "container": 6379}]'::jsonb),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479',
     'Gluetun VPN',
     'homeops-gluetun',
     'qmcgaw/gluetun:latest',
     'running',
     'http://localhost:8000/v1/publicip/ip',
     '[]'::jsonb)
ON CONFLICT DO NOTHING;

-- Insert sample DNS entries
INSERT INTO public.dns_entries (user_id, domain, record_type, value, ttl, provider)
VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'homeops.local', 'A', '192.168.1.100', 3600, 'manual'),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'api.homeops.local', 'A', '192.168.1.101', 3600, 'manual'),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'db.homeops.local', 'A', '192.168.1.102', 3600, 'manual'),
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'homeops.local', 'TXT', 'v=spf1 -all', 3600, 'manual')
ON CONFLICT DO NOTHING;

-- Insert sample API key
INSERT INTO public.api_keys (user_id, name, key_hash, key_prefix, permissions)
VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479',
     'Development API Key',
     -- This would be a proper hash in production
     '$2b$10$YourHashedKeyHere',
     'ho_dev_',
     '["read:accounts", "write:transactions", "read:alerts"]'::jsonb)
ON CONFLICT DO NOTHING;