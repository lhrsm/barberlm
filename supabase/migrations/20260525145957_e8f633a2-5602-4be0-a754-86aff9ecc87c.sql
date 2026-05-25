-- Add 55 prefix to customers phone numbers if missing
UPDATE public.customers 
SET phone = '55' || phone 
WHERE phone IS NOT NULL 
  AND phone != '' 
  AND phone NOT LIKE '55%';

-- Add 55 prefix to profiles whatsapp numbers if missing
UPDATE public.profiles 
SET whatsapp_number = '55' || whatsapp_number 
WHERE whatsapp_number IS NOT NULL 
  AND whatsapp_number != '' 
  AND whatsapp_number NOT LIKE '55%';