import { createFileRoute, useParams } from '@tanstack/react-router';
import { SecurityCentral } from '@/components/security/SecurityCentral';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/$slug/portal/security')({
  component: () => {
    const { slug } = useParams({ from: '/$slug/portal/security' });
    
    return (
      <div className="min-h-screen bg-[#05070d] text-white p-6 md:p-8 space-y-8">
        <div className="flex items-center gap-4">
          <Link to="/$slug/portal" params={{ slug }}>
            <Button variant="ghost" size="icon" className="text-gold hover:text-gold/80 hover:bg-gold/10">
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </Link>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">
            Segurança <span className="text-gold">da Conta</span>
          </h1>
        </div>

        <div className="max-w-4xl mx-auto">
          <SecurityCentral />
        </div>
      </div>
    );
  },
});
