ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
  "monday": {"enabled": true, "start": "09:00", "end": "19:00"},
  "tuesday": {"enabled": true, "start": "09:00", "end": "19:00"},
  "wednesday": {"enabled": true, "start": "09:00", "end": "19:00"},
  "thursday": {"enabled": true, "start": "09:00", "end": "19:00"},
  "friday": {"enabled": true, "start": "09:00", "end": "19:00"},
  "saturday": {"enabled": true, "start": "09:00", "end": "14:00"},
  "sunday": {"enabled": false, "start": "09:00", "end": "14:00"}
}'::jsonb;