-- Authentication and RLS setup for HomeOps

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dns_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Accounts table policies  
CREATE POLICY "Users can view own accounts" ON public.accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts" ON public.accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON public.accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON public.accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Transactions table policies
CREATE POLICY "Users can view own transactions" ON public.transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.accounts 
            WHERE accounts.id = transactions.account_id 
            AND accounts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create transactions for own accounts" ON public.transactions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.accounts 
            WHERE accounts.id = transactions.account_id 
            AND accounts.user_id = auth.uid()
        )
    );

-- Alerts table policies
CREATE POLICY "Users can manage own alerts" ON public.alerts
    FOR ALL USING (auth.uid() = user_id);

-- Alert history policies
CREATE POLICY "Users can view own alert history" ON public.alert_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.alerts 
            WHERE alerts.id = alert_history.alert_id 
            AND alerts.user_id = auth.uid()
        )
    );

-- Automations table policies
CREATE POLICY "Users can manage own automations" ON public.automations
    FOR ALL USING (auth.uid() = user_id);

-- Automation logs policies
CREATE POLICY "Users can view own automation logs" ON public.automation_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.automations 
            WHERE automations.id = automation_logs.automation_id 
            AND automations.user_id = auth.uid()
        )
    );

-- Services table policies
CREATE POLICY "Users can manage own services" ON public.services
    FOR ALL USING (auth.uid() = user_id);

-- Service metrics policies
CREATE POLICY "Users can view own service metrics" ON public.service_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.services 
            WHERE services.id = service_metrics.service_id 
            AND services.user_id = auth.uid()
        )
    );

-- DNS entries policies
CREATE POLICY "Users can manage own DNS entries" ON public.dns_entries
    FOR ALL USING (auth.uid() = user_id);

-- API keys policies
CREATE POLICY "Users can manage own API keys" ON public.api_keys
    FOR ALL USING (auth.uid() = user_id);

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to validate API key
CREATE OR REPLACE FUNCTION public.validate_api_key(key_prefix TEXT, key_hash TEXT)
RETURNS TABLE(user_id UUID, permissions JSONB) AS $$
BEGIN
    RETURN QUERY
    SELECT api_keys.user_id, api_keys.permissions
    FROM public.api_keys
    WHERE api_keys.key_prefix = validate_api_key.key_prefix
      AND api_keys.key_hash = validate_api_key.key_hash
      AND (api_keys.expires_at IS NULL OR api_keys.expires_at > NOW());
      
    -- Update last_used timestamp
    UPDATE public.api_keys
    SET last_used = NOW()
    WHERE api_keys.key_prefix = validate_api_key.key_prefix
      AND api_keys.key_hash = validate_api_key.key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check service health
CREATE OR REPLACE FUNCTION public.check_service_health(service_id UUID)
RETURNS VOID AS $$
DECLARE
    service_record RECORD;
BEGIN
    SELECT * INTO service_record FROM public.services WHERE id = check_service_health.service_id;
    
    IF service_record IS NOT NULL THEN
        -- Update last health check timestamp
        UPDATE public.services 
        SET last_health_check = NOW()
        WHERE id = check_service_health.service_id;
        
        -- This would normally make an HTTP request to health_check_url
        -- For now, we'll just log the check
        INSERT INTO public.service_metrics (service_id, timestamp)
        VALUES (check_service_health.service_id, NOW());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for account balances with transaction history
CREATE OR REPLACE VIEW public.account_summary AS
SELECT 
    a.id,
    a.user_id,
    a.name,
    a.type,
    a.institution,
    a.balance,
    a.currency,
    a.is_active,
    a.last_synced,
    COUNT(t.id) as transaction_count,
    MAX(t.transaction_date) as last_transaction_date
FROM public.accounts a
LEFT JOIN public.transactions t ON a.id = t.account_id
GROUP BY a.id;

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;