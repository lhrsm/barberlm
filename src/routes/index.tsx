import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Users, 
  CircleDollarSign, 
  Scissors, 
  CheckCircle2, 
  ArrowRight,
  BarChart3,
  Smartphone,
  ShieldCheck,
  Star
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPageComponent,
});

function LandingPageComponent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  if (loading) return null;
  if (user) return null;

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="text-primary h-6 w-6" />
            <span className="text-xl font-bold tracking-tight text-primary">BarberSaaS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" className="text-sm font-medium hover:text-primary transition-colors">Funcionalidades</a>
            <a href="#precos" className="text-sm font-medium hover:text-primary transition-colors">Preços</a>
            <a href="#depoimentos" className="text-sm font-medium hover:text-primary transition-colors">Depoimentos</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Começar Grátis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            A solução definitiva para sua barbearia
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 text-foreground leading-[1.1]">
            Gerencie sua barbearia <br className="hidden lg:block" />
            <span className="text-primary">como um profissional.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Agenda inteligente, controle financeiro, gestão de profissionais e muito mais. 
            Tudo o que você precisa em um único lugar para focar no que importa: seus clientes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg gap-2" asChild>
              <Link to="/auth">
                Começar agora gratuitamente <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg" asChild>
              <a href="#funcionalidades">Ver todas as funções</a>
            </Button>
          </div>
          
          {/* Dashboard Preview */}
          <div className="mt-16 lg:mt-24 relative max-w-5xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative rounded-xl border bg-card shadow-2xl overflow-hidden animate-slide-up">
              <img 
                src="https://images.unsplash.com/photo-1512690196162-458d9bc0a892?auto=format&fit=crop&q=80&w=2000" 
                alt="Barber Dashboard Preview" 
                className="w-full h-auto opacity-50 grayscale hover:grayscale-0 transition duration-700"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px]">
                 <div className="bg-background/90 p-8 rounded-xl border shadow-xl max-w-md text-center">
                    <BarChart3 className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Interface Simples e Poderosa</h3>
                    <p className="text-muted-foreground">Otimizado para desktop e mobile. Gerencie tudo do seu celular ou tablet.</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-12 text-muted-foreground/60 font-medium">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> +500 Barbearias Ativas</div>
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> 99.9% de Disponibilidade</div>
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Suporte 24/7 em Português</div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-24 px-4 bg-muted/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-base font-semibold text-primary uppercase tracking-wide mb-2">Funcionalidades</h2>
            <p className="text-3xl lg:text-5xl font-bold tracking-tight text-foreground">Tudo o que você precisa para crescer</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Calendar className="h-8 w-8 text-primary" />}
              title="Agenda Inteligente"
              description="Visualização diária e semanal com sistema de arraste e solte. Evite conflitos de horário automaticamente."
            />
            <FeatureCard 
              icon={<Users className="h-8 w-8 text-primary" />}
              title="Gestão de Clientes"
              description="Histórico completo de atendimentos, preferências e dados de contato para fidelizar seus clientes."
            />
            <FeatureCard 
              icon={<CircleDollarSign className="h-8 w-8 text-primary" />}
              title="Controle Financeiro"
              description="Fluxo de caixa simplificado. Acompanhe entradas, saídas e comissões de forma automática."
            />
            <FeatureCard 
              icon={<Smartphone className="h-8 w-8 text-primary" />}
              title="100% Responsivo"
              description="Acesse de qualquer lugar. O sistema funciona perfeitamente em celulares, tablets e computadores."
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-8 w-8 text-primary" />}
              title="Segurança SaaS"
              description="Dados isolados por barbearia com criptografia de ponta a ponta e backups automáticos diários."
            />
            <FeatureCard 
              icon={<BarChart3 className="h-8 w-8 text-primary" />}
              title="Métricas em Tempo Real"
              description="Dashboard completo com faturamento, ticket médio e novos clientes por dia e mês."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-base font-semibold text-primary uppercase tracking-wide mb-2">Preços</h2>
            <p className="text-3xl lg:text-5xl font-bold tracking-tight text-foreground">Planos que cabem no seu bolso</p>
            <p className="mt-4 text-muted-foreground">Teste gratuitamente por 7 dias em qualquer modalidade.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free Plan */}
            <div className="relative p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all">
              <h3 className="text-lg font-bold mb-1">Grátis</h3>
              <p className="text-xs text-muted-foreground mb-4">Teste de 7 dias incluso.</p>
              <div className="text-3xl font-extrabold mb-6">R$ 0<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 1 Profissional</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> Até 5 Serviços</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 30 Agendamentos</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 1 WhatsApp</li>
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/auth">Começar Grátis</Link>
              </Button>
            </div>

            {/* Basic Plan */}
            <div className="relative p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all border-green-500/20">
              <h3 className="text-lg font-bold mb-1 text-green-600">Básico</h3>
              <p className="text-xs text-muted-foreground mb-4">Para profissionais liberais.</p>
              <div className="text-3xl font-extrabold mb-6">R$ 19,90<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 2 Profissionais</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 10 Serviços</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 100 Agendamentos</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 1 WhatsApp</li>
              </ul>
              <Button className="w-full bg-green-600 hover:bg-green-700" asChild>
                <Link to="/auth">Assinar Básico</Link>
              </Button>
            </div>

            {/* Intermediate Plan */}
            <div className="relative p-6 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all border-purple-500/30">
              <div className="absolute -top-3 right-4 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">RECOMENDADO</div>
              <h3 className="text-lg font-bold mb-1 text-purple-600">Intermediário</h3>
              <p className="text-xs text-muted-foreground mb-4">Pequenas barbearias.</p>
              <div className="text-3xl font-extrabold mb-6">R$ 39,90<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 5 Profissionais</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 25 Serviços</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 500 Agendamentos</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> 3 WhatsApps</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> Gateway Pagto</li>
              </ul>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" asChild>
                <Link to="/auth">Assinar Interm.</Link>
              </Button>
            </div>
            
            {/* Pro Plan */}
            <div className="relative p-6 rounded-2xl border-2 border-primary bg-card shadow-xl overflow-hidden transition-all">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-4 py-1 rounded-bl-lg">PRÓ</div>
              <h3 className="text-lg font-bold mb-1">Profissional (Pró)</h3>
              <p className="text-xs text-muted-foreground mb-4">Solução sem limites.</p>
              <div className="text-3xl font-extrabold mb-6">R$ 59,90<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> Tudo Ilimitado</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> WhatsApp Ilimitado</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> Gateway Pagto</li>
                <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> Suporte Prioritário</li>
              </ul>
              <Button className="w-full bg-primary hover:bg-primary/90" asChild>
                <Link to="/auth">Assinar Pró</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="depoimentos" className="py-24 px-4 bg-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-base font-semibold text-primary uppercase tracking-wide mb-2">Depoimentos</h2>
            <p className="text-3xl lg:text-5xl font-bold tracking-tight text-foreground">O que dizem os barbeiros</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard 
              name="Carlos Alberto"
              business="Barbearia Estilo"
              content="O sistema mudou a forma como gerencio meu tempo. O controle de conflitos na agenda é perfeito."
              rating={5}
            />
            <TestimonialCard 
              name="Ricardo Nunes"
              business="The Barber Shop"
              content="Saímos do papel para o digital em um dia. A interface é tão simples que nem precisei treinar minha equipe."
              rating={5}
            />
            <TestimonialCard 
              name="Marcos Souza"
              business="Barba & Cia"
              content="O controle financeiro é o diferencial. Agora sei exatamente quanto estou faturando e quais serviços rendem mais."
              rating={5}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Scissors className="text-primary h-6 w-6" />
                <span className="text-xl font-bold tracking-tight text-primary">BarberSaaS</span>
              </div>
              <p className="text-muted-foreground max-w-sm mb-6">
                Ajudamos barbeiros a profissionalizarem seus negócios através de tecnologia simples e acessível.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a></li>
                <li><a href="#precos" className="hover:text-primary transition-colors">Preços</a></li>
                <li><a href="/auth" className="hover:text-primary transition-colors">Cadastrar</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Termos de Uso</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center text-sm text-muted-foreground">
            © 2026 BarberSaaS. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-card border shadow-sm hover:shadow-md transition-shadow animate-fade-in">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({ name, business, content, rating }: { name: string, business: string, content: string, rating: number }) {
  return (
    <div className="p-8 rounded-2xl bg-card border shadow-sm animate-fade-in">
      <div className="flex gap-1 mb-4 text-yellow-400">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </div>
      <p className="text-lg italic mb-6 leading-relaxed">"{content}"</p>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
          {name.charAt(0)}
        </div>
        <div>
          <div className="font-bold">{name}</div>
          <div className="text-xs text-muted-foreground">{business}</div>
        </div>
      </div>
    </div>
  );
}
