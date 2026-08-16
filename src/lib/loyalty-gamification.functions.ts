import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Adiciona XP ao cliente e verifica se ele subiu de nível ou desbloqueou conquistas.
 */
export const addCustomerXP = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      customerId: z.string().uuid(),
      xpAmount: z.number().int().positive(),
      reason: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { customerId, xpAmount } = data;

    // 1. Buscar cliente atual, XP e nível
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from("customers")
      .select("xp, loyalty_level_id, name, phone")
      .eq("id", customerId)
      .single();

    if (fetchError || !customer) {
      throw new Error(`Erro ao buscar cliente: ${fetchError?.message}`);
    }

    const newXP = (customer.xp || 0) + xpAmount;

    // 2. Verificar novo nível
    const { data: levels, error: levelsError } = await supabaseAdmin
      .from("loyalty_levels")
      .select("*")
      .order("min_xp", { ascending: false });

    if (levelsError) throw new Error("Erro ao buscar níveis");

    const currentLevel = levels.find((l) => newXP >= l.min_xp);
    const levelChanged = currentLevel && currentLevel.id !== customer.loyalty_level_id;

    // 3. Atualizar cliente
    const { error: updateError } = await supabaseAdmin
      .from("customers")
      .update({
        xp: newXP,
        loyalty_level_id: currentLevel?.id,
      })
      .eq("id", customerId);

    if (updateError) throw new Error("Erro ao atualizar XP do cliente");

    // 4. Verificar conquistas pendentes baseadas em XP ou Visitas (exemplo simplificado)
    // Aqui poderíamos ter uma lógica mais complexa baseada no `requirement_type`
    
    return {
      success: true,
      newXP,
      levelUp: levelChanged,
      newLevel: levelChanged ? currentLevel.name : null,
    };
  });
