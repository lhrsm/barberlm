
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Users, UserPlus, ShieldAlert, Mail, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTeamMembers, getPendingInvitations } from "@/lib/team.functions";
import { useTenant } from "@/hooks/use-tenant";
import { AddUserModal } from "@/components/team/AddUserModal";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/usuarios")({
  component: TeamManagementPage,
});

function TeamManagementPage() {
  const { tenantId } = useTenant();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const fetchMembers = useServerFn(getTeamMembers);
  const fetchInvites = useServerFn(getPendingInvitations);

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['team-members', tenantId],
    queryFn: () => fetchMembers({ data: { tenantId: tenantId! } }),
    enabled: !!tenantId
  });

  const { data: invites, isLoading: loadingInvites } = useQuery({
    queryKey: ['team-invites', tenantId],
    queryFn: () => fetchInvites({ data: { tenantId: tenantId! } }),
    enabled: !!tenantId
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Usuários e Permissões</h1>
          <p className="text-zinc-400">Gerencie quem pode acessar e operar sua barbearia.</p>
        </div>
        <Button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gold hover:bg-gold/90 text-black font-bold"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar usuário
        </Button>
      </div>

      <AddUserModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        tenantId={tenantId || ''} 
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0b0f17] border-gold/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Usuários ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {loadingMembers ? <Loader2 className="h-5 w-5 animate-spin" /> : members?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0f17] border-gold/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gold">
              {loadingInvites ? <Loader2 className="h-5 w-5 animate-spin" /> : invites?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0f17] border-gold/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Usuários bloqueados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">0</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0b0f17] border-gold/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Profissionais vinculados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-[#0b0f17] rounded-xl border border-gold/10 overflow-hidden">
        <div className="p-4 border-b border-gold/10 flex items-center gap-2">
          <Users className="text-gold h-5 w-5" />
          <h2 className="font-bold text-white">Membros da Equipe</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-gold/5 hover:bg-transparent">
              <TableHead className="text-zinc-400">Nome</TableHead>
              <TableHead className="text-zinc-400">Função</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members?.map((member: any) => (
              <TableRow key={member.id} className="border-gold/5 hover:bg-gold/5">
                <TableCell className="font-medium text-white">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold">
                      {member.profile?.responsible_name?.[0] || member.profile?.display_name?.[0] || member.profile?.email?.[0] || member.email?.[0] || '?'}
                    </div>
                    <div>
                      <div>{member.profile?.responsible_name || member.profile?.display_name || 'Sem nome'}</div>
                      <div className="text-xs text-zinc-500">{member.profile?.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-gold/20 text-gold capitalize">
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className="bg-green-500/20 text-green-500 border-none">
                    {member.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {(!members || members.length === 0) && !loadingMembers && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-zinc-500">
                  Nenhum membro encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {invites && invites.length > 0 && (
        <div className="bg-[#0b0f17] rounded-xl border border-gold/10 overflow-hidden">
          <div className="p-4 border-b border-gold/10 flex items-center gap-2">
            <Mail className="text-gold h-5 w-5" />
            <h2 className="font-bold text-white">Convites Pendentes</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-gold/5 hover:bg-transparent">
                <TableHead className="text-zinc-400">E-mail</TableHead>
                <TableHead className="text-zinc-400">Função</TableHead>
                <TableHead className="text-zinc-400">Expira em</TableHead>
                <TableHead className="text-zinc-400 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite: any) => (
                <TableRow key={invite.id} className="border-gold/5 hover:bg-gold/5">
                  <TableCell className="text-white">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-gold/20 text-gold capitalize">
                      {invite.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                      Reenviar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                      Revogar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
