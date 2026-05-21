-- Clear and Update plans
TRUNCATE TABLE public.plans;

INSERT INTO public.plans (name, description, price_monthly, features, limits, active)
VALUES 
('Starter', 'Ideal para barbeiros iniciantes.', 19.90, 
  '{"agenda": true, "whatsapp": true, "financeiro": "basico", "clientes": "ilimitado"}', 
  '{"users": 1, "clients": -1, "appointments": -1}', true),
('Pro', 'Para barbearias em crescimento.', 39.90, 
  '{"agenda": true, "whatsapp": true, "cashback": true, "financeiro": "avancado", "reports": true, "automations": true}', 
  '{"users": 5, "clients": -1, "appointments": -1}', true),
('Elite', 'Solução definitiva sem limites.', 59.90, 
  '{"agenda": true, "whatsapp": true, "cashback": true, "financeiro": "premium", "reports": true, "automations": true, "ia": true, "analytics": true, "support": "prioritario"}', 
  '{"users": -1, "clients": -1, "appointments": -1}', true);
