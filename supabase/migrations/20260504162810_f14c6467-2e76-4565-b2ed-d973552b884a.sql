-- Adjust barber_services foreign key to cascade delete
ALTER TABLE public.barber_services
DROP CONSTRAINT IF EXISTS barber_services_barber_id_fkey,
ADD CONSTRAINT barber_services_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;

-- Adjust service_ratings foreign key to cascade delete
ALTER TABLE public.service_ratings
DROP CONSTRAINT IF EXISTS service_ratings_barber_id_fkey,
ADD CONSTRAINT service_ratings_barber_id_fkey
  FOREIGN KEY (barber_id)
  REFERENCES public.barbers(id)
  ON DELETE CASCADE;
