-- Adicionar colunas na tabela products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS promotional_price NUMERIC,
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS badge TEXT;

-- Criar índice para busca por slug
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- Criar tabela product_images
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para product_images
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Políticas para product_images
CREATE POLICY "Qualquer pessoa pode ver imagens de produtos" 
ON public.product_images 
FOR SELECT 
USING (true);

CREATE POLICY "Vendedores podem gerenciar imagens de seus produtos" 
ON public.product_images 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_id AND p.user_id = auth.uid()
    )
);

-- Função para gerar slug automaticamente se não fornecido
CREATE OR REPLACE FUNCTION public.generate_product_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        -- Garantir que não termina com hífen
        NEW.slug := trim(trailing '-' from NEW.slug);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para gerar slug
DROP TRIGGER IF EXISTS trg_generate_product_slug ON public.products;
CREATE TRIGGER trg_generate_product_slug
BEFORE INSERT OR UPDATE OF name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.generate_product_slug();
