
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { 
  BookOpen, 
  HelpCircle, 
  MessageSquare, 
  ChevronRight, 
  Clock, 
  BarChart, 
  Search,
  CheckCircle2,
  ExternalLink,
  Copy,
  Mail,
  Ticket
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


export const Route = createFileRoute("/support")({
  component: SupportComponent,
});

const tutorials = [
  {
    id: "meta-account",
    title: "Como criar conta Meta Business",
    description: "O primeiro passo para usar a API oficial é ter uma conta empresarial na Meta.",
    difficulty: "Fácil",
    time: "5 min",
    category: "WhatsApp",
    steps: [
      "Acesse business.facebook.com/overview",
      "Clique em 'Criar conta'",
      "Insira o nome da sua empresa, seu nome e seu e-mail comercial",
      "Confirme seu e-mail para ativar a conta"
    ],
    videoId: "placeholder_id"
  },
  {
    id: "meta-app",
    title: "Como criar aplicativo Meta Developers",
    description: "Crie um aplicativo do tipo 'Empresa' no portal de desenvolvedores da Meta.",
    difficulty: "Média",
    time: "10 min",
    category: "WhatsApp",
    steps: [
      "Vá para developers.facebook.com",
      "Clique em 'Meus Aplicativos' > 'Criar Aplicativo'",
      "Selecione o tipo 'Empresa' (Business)",
      "Dê um nome ao app e selecione sua Conta Empresarial criada no passo anterior"
    ]
  },
  {
    id: "whatsapp-setup",
    title: "Como configurar WhatsApp Cloud API",
    description: "Adicione o produto WhatsApp ao seu aplicativo da Meta.",
    difficulty: "Média",
    time: "15 min",
    category: "WhatsApp",
    steps: [
      "No painel do seu app na Meta, localize 'Adicionar Produto'",
      "Clique em 'Configurar' no card do WhatsApp",
      "Selecione sua conta comercial para vincular",
      "Vá em 'Configuração' para obter seu ID do número de telefone e ID da conta comercial"
    ]
  },
  {
    id: "connect-system",
    title: "Como conectar o número ao sistema",
    description: "Insira suas credenciais da Meta em nosso painel de configurações.",
    difficulty: "Fácil",
    time: "5 min",
    category: "WhatsApp",
    steps: [
      "No nosso sistema, vá em Configurações > WhatsApp",
      "Clique em 'Conectar WhatsApp Cloud API'",
      "Cole o 'Phone Number ID' e o 'WABA ID' obtidos na Meta",
      "Gere um Token de Acesso Permanente na Meta e cole no campo correspondente"
    ]
  },
  {
    id: "webhook-setup",
    title: "Como configurar webhook",
    description: "Configure a URL de retorno para receber status de mensagens e respostas.",
    difficulty: "Avançada",
    time: "10 min",
    category: "WhatsApp",
    steps: [
      "No painel da Meta, vá em WhatsApp > Configuração",
      "Em 'Webhook', clique em 'Editar'",
      "Insira a URL de Callback que fornecemos em nosso painel",
      "Defina o Token de Verificação (você mesmo cria um)",
      "Assine os campos 'messages' para receber notificações"
    ]
  },
  {
    id: "meta-billing",
    title: "Como ativar cobrança Meta",
    description: "Configure um cartão de crédito na Meta para pagar pelas mensagens enviadas.",
    difficulty: "Fácil",
    time: "5 min",
    category: "WhatsApp",
    steps: [
      "No Gerenciador de Negócios da Meta, vá em 'Configurações do Negócio'",
      "Vá em 'Métodos de Pagamento' e adicione um cartão",
      "Vá em 'Contas de WhatsApp' > Selecione sua conta > 'Configurações de Pagamento'",
      "Vincule o cartão à conta de WhatsApp específica"
    ]
  }
];

function SupportComponent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTutorial, setSelectedTutorial] = useState<typeof tutorials[0] | null>(null);

  const filteredTutorials = tutorials.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Central de Suporte e Tutoriais</h2>
            <p className="text-muted-foreground">Tudo o que você precisa para configurar e dominar sua plataforma.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
                <MessageSquare className="h-4 w-4" /> WhatsApp Suporte
              </a>
            </Button>
            <Button className="gap-2">
              <Ticket className="h-4 w-4" /> Abrir Ticket
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Buscar tutoriais (ex: WhatsApp, Webhook, Meta...)" 
            className="pl-10 h-12 text-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="text-primary h-5 w-5" />
                Tutoriais de Integração WhatsApp
              </CardTitle>
              <CardDescription>
                Siga o passo a passo para conectar seu WhatsApp Business API oficial.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredTutorials.map((tutorial) => (
                  <button 
                    key={tutorial.id}
                    onClick={() => setSelectedTutorial(tutorial)}
                    className="flex flex-col text-left p-4 border rounded-xl hover:bg-accent transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                        {tutorial.difficulty}
                      </Badge>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                        <Clock className="h-3 w-3" /> {tutorial.time}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{tutorial.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tutorial.description}</p>
                    <div className="mt-4 flex items-center text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      Ver tutorial <ChevronRight className="h-3 w-3" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Dúvidas Frequentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold">Quem cobra pelas mensagens?</p>
                  <p className="text-xs text-muted-foreground">O custo é cobrado diretamente pela Meta conforme o uso. Nosso sistema não cobra taxas adicionais por mensagem.</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold">Posso usar meu número pessoal?</p>
                  <p className="text-xs text-muted-foreground">Recomendamos um número exclusivo para o Business API, pois o número será formatado para uso profissional pela Meta.</p>
                </div>
                <Button variant="link" className="p-0 h-auto text-xs" asChild>
                  <Link to="/support">Ver FAQ completo</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações Úteis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">URL de Webhook</p>
                    <p className="text-[10px] text-muted-foreground font-mono">https://api.seusass.com/webhook</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard("https://api.seusass.com/webhook")}>
                    <Copy className="h-3.3 w-3.3" />
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">Verify Token</p>
                    <p className="text-[10px] text-muted-foreground font-mono">barber_secure_2024</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard("barber_secure_2024")}>
                    <Copy className="h-3.3 w-3.3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tutorial Modal */}
        <Dialog open={!!selectedTutorial} onOpenChange={() => setSelectedTutorial(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedTutorial && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{selectedTutorial.category}</Badge>
                    <Badge variant="secondary">{selectedTutorial.difficulty}</Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {selectedTutorial.time}
                    </span>
                  </div>
                  <DialogTitle className="text-2xl">{selectedTutorial.title}</DialogTitle>
                  <DialogDescription className="text-base">
                    {selectedTutorial.description}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 my-4">
                  <div className="aspect-video bg-muted rounded-xl flex items-center justify-center border-2 border-dashed">
                    <div className="text-center space-y-2">
                      <ExternalLink className="h-8 w-8 mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground italic">Vídeo tutorial em breve</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-bold flex items-center gap-2">
                      <BarChart className="h-4 w-4 text-primary" />
                      Passo a Passo Detalhado
                    </h5>
                    <div className="space-y-3">
                      {selectedTutorial.steps.map((step, index) => (
                        <div key={index} className="flex gap-4 p-4 border rounded-xl bg-card">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
                            {index + 1}
                          </div>
                          <p className="text-sm leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Alert className="bg-amber-50 border-amber-200">
                    <HelpCircle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 font-bold">Dica Importante</AlertTitle>
                    <AlertDescription className="text-amber-700 text-sm">
                      Mantenha suas chaves de API da Meta em segurança. Nunca compartilhe seu Access Token com terceiros.
                    </AlertDescription>
                  </Alert>
                </div>

                <div className="flex items-center justify-between border-t pt-6">
                  <Button variant="outline" onClick={() => setSelectedTutorial(null)}>
                    Fechar
                  </Button>
                  <Button className="gap-2" onClick={() => copyToClipboard(selectedTutorial.steps.join("\n"))}>
                    <Copy className="h-4 w-4" /> Copiar Passos
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <div className="text-center py-12 border-t">
          <p className="text-sm text-muted-foreground mb-4">Ainda precisa de ajuda?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="outline" className="gap-2">
              <Mail className="h-4 w-4" /> Enviar E-mail
            </Button>
            <Button variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" /> Chat ao Vivo
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
