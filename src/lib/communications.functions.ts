import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type ChannelType = 'whatsapp' | 'email' | 'sms' | 'push' | 'internal' | 'telegram' | 'instagram';
export type MessageStatus = 'pending' | 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'cancelled' | 'expired';
export type CommunicationCategory = 'transactional' | 'operational' | 'commercial' | 'billing' | 'support' | 'internal' | 'security';

export const getChannels = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tenantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: channels, error } = await supabase
      .from("communication_channels")
      .select("*")
      .eq("tenant_id", data.tenantId);
    
    if (error) throw error;
    return channels;
  });

export const getMessages = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ 
    tenantId: z.string().uuid(),
    limit: z.number().optional().default(50),
    offset: z.number().optional().default(0),
    channelType: z.string().optional(),
    status: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase
      .from("communication_messages")
      .select(`
        *,
        customer:customers(id, name, phone, email)
      `)
      .eq("tenant_id", data.tenantId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    
    if (data.channelType) query = query.eq("channel_type", data.channelType);
    if (data.status) query = query.eq("status", data.status);
    
    const { data: messages, error } = await query;
    if (error) throw error;
    return messages;
  });

export const getTemplates = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tenantId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { data: templates, error } = await supabase
      .from("communication_templates")
      .select("*")
      .eq("tenant_id", data.tenantId);
    
    if (error) throw error;
    return templates;
  });

export const updateChannelStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ 
    id: z.string().uuid(),
    status: z.string(),
    isActive: z.boolean()
  }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("communication_channels")
      .update({ 
        status: data.status,
        is_active: data.isActive,
        updated_at: new Date().toISOString()
      })
      .eq("id", data.id);
    
    if (error) throw error;
    return { success: true };
  });
