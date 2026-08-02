import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { ReceptionLayout } from "@/components/reception/ReceptionLayout";
import { useReception } from "@/hooks/use-reception";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/reception")({
  head: () => ({
    meta: [
      { title: "Central de Atendimento | Barbex" },
      { name: "description", content: "Portal operacional da recepção: agenda do dia, fila de atendimento, check-in, walk-in e clientes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Central de Atendimento | Barbex" },
      { property: "og:description", content: "Portal operacional da recepção da barbearia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceptionRoot,
});

function ReceptionRoot() {
  const { loading, hasAccess } = useReception();

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md space-y-3 p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          <h1 className="text-lg font-semibold">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground">
            Esta área é exclusiva para usuários de recepção autorizados pela barbearia.
          </p>
          <Link to="/auth" className="inline-block text-sm font-medium text-primary underline">
            Entrar com outra conta
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <ReceptionLayout>
      <Outlet />
    </ReceptionLayout>
  );
}
