import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReception } from "@/hooks/use-reception";

export const Route = createFileRoute("/reception/customers")({
  head: () => ({
    meta: [
      { title: "Clientes | Recepção Barbex" },
      { name: "description", content: "Diretório operacional de clientes para a recepção da barbearia." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Clientes | Recepção Barbex" },
      { property: "og:description", content: "Diretório operacional de clientes da barbearia." },
    ],
  }),
  component: ReceptionCustomers,
});

function ReceptionCustomers() {
  const { tenantId } = useReception();
  const [term, setTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["reception-customers", tenantId, term],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("customers")
        .select("id, name, phone, email, last_visit")
        .eq("tenant_id", tenantId!)
        .order("name")
        .limit(60);
      if (term.trim()) q = q.or(`name.ilike.%${term.trim()}%,phone.ilike.%${term.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">Consulta rápida para atendimento no balcão.</p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar cliente"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (data || []).length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</Card>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {(data || []).map((c: any) => (
            <li key={c.id}>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.phone || "sem telefone"}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                </div>
                {c.phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://wa.me/${String(c.phone).replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Phone className="mr-2 h-4 w-4" aria-hidden /> WhatsApp
                    </a>
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
