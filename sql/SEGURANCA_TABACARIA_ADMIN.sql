-- RODE no SQL Editor do Supabase JÁ EXISTENTE uma vez.
-- Protege a gestão de Tabacaria: não permite incluir produtos dessa categoria em pedidos online.
-- A verificação acontece no banco de dados mesmo que alguém tente forçar IDs pela API.
CREATE OR REPLACE FUNCTION public.adega_bloquear_tabacaria_online()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE id=NEW.product_id AND category='Tabacaria') THEN
    RAISE EXCEPTION 'PRODUTO_INDISPONIVEL';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_adega_bloquear_tabacaria_online ON public.order_items;
CREATE TRIGGER trg_adega_bloquear_tabacaria_online
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.adega_bloquear_tabacaria_online();
REVOKE ALL ON FUNCTION public.adega_bloquear_tabacaria_online() FROM PUBLIC,anon,authenticated;
