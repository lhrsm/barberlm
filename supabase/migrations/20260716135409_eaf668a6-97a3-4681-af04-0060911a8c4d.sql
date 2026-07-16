GRANT SELECT (
  id, business_name, slug, whatsapp_number, whatsapp_enabled,
  primary_color, secondary_color, logo_url, barbershop_logo_url,
  scheduling_mode, cashback_enabled, cashback_percentage,
  address, google_maps_url, free_service_threshold,
  font_family, font_size, font_color,
  pix_key, pix_qr_code_url,
  status, trial_end, plan, effective_plan, selected_plan,
  opening_date, social_links, gallery_images, tenant_id
) ON public.profiles TO anon;