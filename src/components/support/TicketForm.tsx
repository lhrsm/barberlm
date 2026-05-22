import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Paperclip, X, Loader2 } from "lucide-react";
import { useTenant } from "@/hooks/use-tenant";

const ticketSchema = z.object({
  subject: z.string().min(5, "O título deve ter pelo menos 5 caracteres"),
  category: z.string().min(1, "Selecione uma categoria"),
  priority: z.string().min(1, "Selecione uma prioridade"),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres"),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface TicketFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function TicketForm({ onSuccess, onCancel }: TicketFormProps) {
  console.log("TicketForm rendering");
  const { tenantId } = useTenant();
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      subject: "",
      category: "",
      priority: "medium",
      description: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: TicketFormValues) => {
    if (!tenantId) {
      toast.error("Erro: ID da barbearia não encontrado. Tente recarregar a página.");
      return;
    }
    setIsSubmitting(true);

    try {
      const attachmentUrls: string[] = [];

      if (attachments.length > 0) {
        setIsUploading(true);
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${tenantId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('support-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('support-attachments')
            .getPublicUrl(filePath);
          
          attachmentUrls.push(publicUrl);
        }
        setIsUploading(false);
      }

      const { error } = await supabase
        .from("support_tickets")
        .insert({
          subject: values.subject,
          category: values.category,
          priority: values.priority,
          description: values.description,
          tenant_id: tenantId,
          status: 'open',
          attachment_urls: attachmentUrls
        });

      if (error) throw error;

      toast.success("Ticket aberto com sucesso!");
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao abrir ticket:", error);
      toast.error("Erro ao abrir ticket: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Resumo do problema" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="Agendamentos">Agendamentos</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Pagamentos">Pagamentos</SelectItem>
                    <SelectItem value="Erros">Erros do sistema</SelectItem>
                    <SelectItem value="Sugestões">Sugestões</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridade</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descreva detalhadamente seu problema ou dúvida..." 
                  className="min-h-[120px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Anexos (Imagens ou PDFs)</FormLabel>
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted p-2 rounded-md text-xs">
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button type="button" onClick={() => removeAttachment(i)} className="text-destructive">
                  <X size={14} />
                </button>
              </div>
            ))}
            <label className="flex items-center justify-center w-10 h-10 rounded-md border-2 border-dashed cursor-pointer hover:border-primary transition-colors">
              <Paperclip size={18} className="text-muted-foreground" />
              <input type="file" className="hidden" multiple onChange={handleFileChange} accept="image/*,.pdf" />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploading ? "Enviando arquivos..." : "Abrir Chamado"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
