-- Create wallet table
CREATE TABLE IF NOT EXISTS public.wallet (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    balance NUMERIC NOT NULL DEFAULT 0,
    user_id UUID NOT NULL, -- The business owner ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(customer_id)
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallet(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for wallet
CREATE POLICY "Users can view wallets of their customers" 
ON public.wallet FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage wallets of their customers" 
ON public.wallet FOR ALL USING (auth.uid() = user_id);

-- Policies for wallet_transactions
CREATE POLICY "Users can view transactions of their customers" 
ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage transactions of their customers" 
ON public.wallet_transactions FOR ALL USING (auth.uid() = user_id);

-- Function to update wallet balance on transaction
CREATE OR REPLACE FUNCTION public.handle_wallet_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.type = 'credit') THEN
        UPDATE public.wallet 
        SET balance = balance + NEW.amount, updated_at = now()
        WHERE id = NEW.wallet_id;
    ELSIF (NEW.type = 'debit') THEN
        UPDATE public.wallet 
        SET balance = balance - NEW.amount, updated_at = now()
        WHERE id = NEW.wallet_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for wallet balance
CREATE TRIGGER on_wallet_transaction
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_wallet_transaction();

-- Function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wallet_updated_at
BEFORE UPDATE ON public.wallet
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
