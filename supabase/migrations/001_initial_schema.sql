-- Initial database schema for HomeOps

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create custom types
CREATE TYPE account_type AS ENUM ('bank', 'investment', 'crypto', 'other');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'trade', 'fee', 'dividend', 'interest');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE service_status AS ENUM ('running', 'stopped', 'error', 'unknown');
CREATE TYPE automation_status AS ENUM ('active', 'paused', 'disabled');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial accounts
CREATE TABLE public.accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type account_type NOT NULL,
    institution TEXT,
    account_number TEXT,
    balance DECIMAL(20, 8) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    api_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial transactions
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    category TEXT,
    metadata JSONB DEFAULT '{}',
    external_id TEXT,
    transaction_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert configurations
CREATE TABLE public.alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    severity alert_severity NOT NULL,
    condition_type TEXT NOT NULL, -- 'price', 'balance', 'transaction', 'service', etc.
    condition_config JSONB NOT NULL,
    notification_channels JSONB DEFAULT '[]', -- ['email', 'sms', 'push', 'webhook']
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert history
CREATE TABLE public.alert_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    condition_values JSONB,
    notification_sent BOOLEAN DEFAULT false,
    error_message TEXT
);

-- Automation workflows
CREATE TABLE public.automations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- 'schedule', 'event', 'condition'
    trigger_config JSONB NOT NULL,
    actions JSONB NOT NULL, -- Array of action steps
    status automation_status DEFAULT 'active',
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation execution logs
CREATE TABLE public.automation_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    automation_id UUID REFERENCES public.automations(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL, -- 'running', 'success', 'failed'
    steps_completed INTEGER DEFAULT 0,
    error_message TEXT,
    execution_data JSONB DEFAULT '{}'
);

-- Docker services monitoring
CREATE TABLE public.services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    container_name TEXT UNIQUE NOT NULL,
    image TEXT NOT NULL,
    status service_status DEFAULT 'unknown',
    health_check_url TEXT,
    ports JSONB DEFAULT '[]',
    environment JSONB DEFAULT '{}',
    labels JSONB DEFAULT '{}',
    last_health_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service metrics (time-series data)
CREATE TABLE public.service_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    cpu_usage DECIMAL(5, 2),
    memory_usage DECIMAL(10, 2), -- in MB
    network_rx BIGINT, -- bytes received
    network_tx BIGINT, -- bytes transmitted
    disk_usage DECIMAL(10, 2), -- in MB
    response_time INTEGER, -- in milliseconds
    error_count INTEGER DEFAULT 0
);

-- DNS entries
CREATE TABLE public.dns_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    record_type TEXT NOT NULL, -- 'A', 'AAAA', 'CNAME', 'MX', 'TXT', etc.
    value TEXT NOT NULL,
    ttl INTEGER DEFAULT 3600,
    priority INTEGER,
    provider TEXT, -- 'cloudflare', 'route53', 'manual'
    provider_id TEXT,
    is_active BOOLEAN DEFAULT true,
    last_verified TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys management
CREATE TABLE public.api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- Store hashed version
    key_prefix TEXT NOT NULL, -- First 8 characters for identification
    permissions JSONB DEFAULT '[]',
    expires_at TIMESTAMPTZ,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX idx_alert_history_alert_id ON public.alert_history(alert_id);
CREATE INDEX idx_automations_user_id ON public.automations(user_id);
CREATE INDEX idx_automation_logs_automation_id ON public.automation_logs(automation_id);
CREATE INDEX idx_services_user_id ON public.services(user_id);
CREATE INDEX idx_service_metrics_service_id ON public.service_metrics(service_id);
CREATE INDEX idx_service_metrics_timestamp ON public.service_metrics(timestamp DESC);
CREATE INDEX idx_dns_entries_user_id ON public.dns_entries(user_id);
CREATE INDEX idx_dns_entries_domain ON public.dns_entries(domain);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON public.api_keys(key_prefix);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON public.alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automations_updated_at BEFORE UPDATE ON public.automations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dns_entries_updated_at BEFORE UPDATE ON public.dns_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();