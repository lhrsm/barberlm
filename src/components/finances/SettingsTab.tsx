import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw, Trash2 } from "lucide-react";

type Props = {
  handleClearTestData: () => void | Promise<void>;
  isClearingData: boolean;
};

export function SettingsTab({ handleClearTestData, isClearingData }: Props) {
  return (
    <div className="space-y-4">
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Zona de Perigo
          </CardTitle>
          <CardDescription>Ações irreversíveis para gerenciamento de dados da barbearia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-red-50 gap-4">
            <div>
              <h4 className="font-semibold text-red-900">Limpar Dados Financeiros de Teste</h4>
              <p className="text-sm text-red-700">
                Remove todos os agendamentos, transações, cashback e créditos. Útil para resetar a barbearia após o
                período de testes.
              </p>
              <p className="text-xs text-red-600 mt-1 font-medium">
                * Clientes, Barbeiros, Serviços e Configurações serão mantidos.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleClearTestData}
              disabled={isClearingData}
              className="whitespace-nowrap"
            >
              {isClearingData ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar Tudo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
