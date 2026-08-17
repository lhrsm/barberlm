
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { inviteTeamMember } from "@/lib/team.functions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  role: z.string().min(1, "Selecione uma função"),
  professionalId: z.string().optional(),
});

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
}

export function AddUserModal({ isOpen, onClose, tenantId }: AddUserModalProps) {
  const [loading, setLoading] = useState(false);
  const inviteFn = useServerFn(inviteTeamMember);

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      phone: "",
      role: "reception",
    },
  });

  const onSubmit = async (values: z.infer<typeof inviteSchema>) => {
    setLoading(true);
    try {
      await inviteFn({
        data: {
          ...values,
          tenantId
        }
      });
      toast.success("Convite enviado com sucesso!");
      form.reset();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar convite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0b0f17] border-gold/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Novo usuário da barbearia</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Envie um convite para um novo membro da sua equipe.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">E-mail</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-black/20 border-gold/20" placeholder="exemplo@email.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">WhatsApp (Opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-black/20 border-gold/20" placeholder="71999999999" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Função / Perfil de acesso</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-black/20 border-gold/20">
                        <SelectValue placeholder="Selecione uma função" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-[#0b0f17] border-gold/20 text-white">
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="reception">Recepcionista</SelectItem>
                      <SelectItem value="financial">Financeiro</SelectItem>
                      <SelectItem value="barber">Profissional / Barbeiro</SelectItem>
                      <SelectItem value="tenant_admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
                Cancelar
              </Button>
              <Button type="submit" className="bg-gold hover:bg-gold/90 text-black font-bold" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar convite agora"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
