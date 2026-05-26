export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_read: boolean | null
          reference_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          reference_id?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          api_key: string | null
          created_at: string
          id: string
          model: string | null
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: string
          model?: string | null
          provider?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: string
          model?: string | null
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          barber_id: string | null
          barbershop_amount: number | null
          cancel_token: string | null
          cashback_earned: number | null
          cashback_used: number | null
          confirmation_sent: boolean | null
          created_at: string
          credit_used: number | null
          customer_id: string | null
          end_time: string
          final_amount: number | null
          id: string
          items: Json | null
          notes: string | null
          original_total: number | null
          payment_method: string | null
          payment_status: string | null
          pix_amount: number | null
          refund_requested_at: string | null
          refund_status: string | null
          refund_type: string | null
          reminder_sent: boolean | null
          service_id: string | null
          start_time: string
          status: string | null
          total_price: number | null
          user_id: string
        }
        Insert: {
          barber_id?: string | null
          barbershop_amount?: number | null
          cancel_token?: string | null
          cashback_earned?: number | null
          cashback_used?: number | null
          confirmation_sent?: boolean | null
          created_at?: string
          credit_used?: number | null
          customer_id?: string | null
          end_time: string
          final_amount?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          original_total?: number | null
          payment_method?: string | null
          payment_status?: string | null
          pix_amount?: number | null
          refund_requested_at?: string | null
          refund_status?: string | null
          refund_type?: string | null
          reminder_sent?: boolean | null
          service_id?: string | null
          start_time: string
          status?: string | null
          total_price?: number | null
          user_id: string
        }
        Update: {
          barber_id?: string | null
          barbershop_amount?: number | null
          cancel_token?: string | null
          cashback_earned?: number | null
          cashback_used?: number | null
          confirmation_sent?: boolean | null
          created_at?: string
          credit_used?: number | null
          customer_id?: string | null
          end_time?: string
          final_amount?: number | null
          id?: string
          items?: Json | null
          notes?: string | null
          original_total?: number | null
          payment_method?: string | null
          payment_status?: string | null
          pix_amount?: number | null
          refund_requested_at?: string | null
          refund_status?: string | null
          refund_type?: string | null
          reminder_sent?: boolean | null
          service_id?: string | null
          start_time?: string
          status?: string | null
          total_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          appointment_id: string | null
          automation_id: string
          barber_id: string | null
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          id: string
          message_type: string | null
          original_template: string | null
          phone: string | null
          processed_template: string | null
          provider: string | null
          response: Json | null
          sent_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          automation_id: string
          barber_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_type?: string | null
          original_template?: string | null
          phone?: string | null
          processed_template?: string | null
          provider?: string | null
          response?: Json | null
          sent_at?: string
          status: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          automation_id?: string
          barber_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_type?: string | null
          original_template?: string | null
          phone?: string | null
          processed_template?: string | null
          provider?: string | null
          response?: Json | null
          sent_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_status: {
        Row: {
          id: string
          last_error: string | null
          last_run_at: string | null
          messages_failed: number | null
          messages_sent: number | null
          server_time: string | null
          status: string | null
          timezone: string | null
          total_processed: number | null
        }
        Insert: {
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          messages_failed?: number | null
          messages_sent?: number | null
          server_time?: string | null
          status?: string | null
          timezone?: string | null
          total_processed?: number | null
        }
        Update: {
          id?: string
          last_error?: string | null
          last_run_at?: string | null
          messages_failed?: number | null
          messages_sent?: number | null
          server_time?: string | null
          status?: string | null
          timezone?: string | null
          total_processed?: number | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          barber_id: string | null
          channel: string | null
          created_at: string
          enabled: boolean | null
          id: string
          template: string | null
          tenant_id: string
          trigger_delay: number | null
          trigger_type: string
          type: string
          updated_at: string
        }
        Insert: {
          barber_id?: string | null
          channel?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          template?: string | null
          tenant_id: string
          trigger_delay?: number | null
          trigger_type: string
          type: string
          updated_at?: string
        }
        Update: {
          barber_id?: string | null
          channel?: string | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          template?: string | null
          tenant_id?: string
          trigger_delay?: number | null
          trigger_type?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_services: {
        Row: {
          barber_id: string | null
          created_at: string | null
          id: string
          service_id: string | null
          user_id: string | null
        }
        Insert: {
          barber_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
          user_id?: string | null
        }
        Update: {
          barber_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          average_rating: number | null
          category: string | null
          commission_rate: number | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          total_ratings: number | null
          user_id: string
          working_hours: Json | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          average_rating?: number | null
          category?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          total_ratings?: number | null
          user_id: string
          working_hours?: Json | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          average_rating?: number | null
          category?: string | null
          commission_rate?: number | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          total_ratings?: number | null
          user_id?: string
          working_hours?: Json | null
        }
        Relationships: []
      }
      barbershops: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_logs: {
        Row: {
          campaign_id: string
          customer_id: string | null
          id: string
          response: Json | null
          sent_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          customer_id?: string | null
          id?: string
          response?: Json | null
          sent_at?: string
          status: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          customer_id?: string | null
          id?: string
          response?: Json | null
          sent_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          content: string | null
          created_at: string
          filters: Json | null
          id: string
          scheduled_at: string | null
          status: string | null
          tenant_id: string
          title: string
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          scheduled_at?: string | null
          status?: string | null
          tenant_id: string
          title: string
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          filters?: Json | null
          id?: string
          scheduled_at?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_auth: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          password_hash: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          password_hash?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          password_hash?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_auth_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          avatar_url: string | null
          barber_id: string | null
          birth_date: string | null
          birthday_sent: boolean | null
          cashback_balance: number
          created_at: string
          credits: number | null
          email: string | null
          id: string
          loyalty_points: number | null
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          barber_id?: string | null
          birth_date?: string | null
          birthday_sent?: boolean | null
          cashback_balance?: number
          created_at?: string
          credits?: number | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          barber_id?: string | null
          birth_date?: string | null
          birthday_sent?: boolean | null
          cashback_balance?: number
          created_at?: string
          credits?: number | null
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_settings: {
        Row: {
          api_key: string | null
          created_at: string
          id: string
          provider: string
          sender_email: string | null
          sender_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          created_at?: string
          id?: string
          provider?: string
          sender_email?: string | null
          sender_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          created_at?: string
          id?: string
          provider?: string
          sender_email?: string | null
          sender_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          barber_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          read: boolean | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          barber_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          read?: boolean | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          barber_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_settings: {
        Row: {
          id: string
          is_active: boolean | null
          message: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          message?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          message?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          features: Json
          id: string
          limits: Json
          name: string
          price_monthly: number
          price_yearly: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          limits?: Json
          name: string
          price_monthly?: number
          price_yearly?: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          limits?: Json
          name?: string
          price_monthly?: number
          price_yearly?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales: {
        Row: {
          barber_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          items: Json
          pix_key: string | null
          refund_reason: string | null
          refund_requested_at: string | null
          status: Database["public"]["Enums"]["product_sale_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          barber_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          items: Json
          pix_key?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          status?: Database["public"]["Enums"]["product_sale_status"]
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          barber_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          items?: Json
          pix_key?: string | null
          refund_reason?: string | null
          refund_requested_at?: string | null
          status?: Database["public"]["Enums"]["product_sale_status"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sales_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          badge: string | null
          brand: string | null
          category: string | null
          created_at: string
          description: string | null
          featured: boolean | null
          id: string
          image_url: string | null
          name: string
          price: number
          promotional_price: number | null
          short_description: string | null
          slug: string | null
          stock_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          badge?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
          promotional_price?: number | null
          short_description?: string | null
          slug?: string | null
          stock_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          badge?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          promotional_price?: number | null
          short_description?: string | null
          slug?: string | null
          stock_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          barbers_range: string | null
          blocked_at: string | null
          business_name: string | null
          cashback_enabled: boolean
          cashback_percentage: number
          created_at: string
          email: string | null
          font_color: string | null
          font_family: string | null
          font_size: string | null
          free_service_threshold: number | null
          google_maps_url: string | null
          id: string
          logo_url: string | null
          payment_gateway_key: string | null
          payment_gateway_provider: string | null
          pix_key: string | null
          pix_qr_code_url: string | null
          plan: string | null
          primary_color: string | null
          responsible_name: string | null
          role: string | null
          scheduling_mode: string | null
          secondary_color: string | null
          slug: string | null
          status: string | null
          suspension_reason: string | null
          tenant_id: string | null
          trial_end: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          barbers_range?: string | null
          blocked_at?: string | null
          business_name?: string | null
          cashback_enabled?: boolean
          cashback_percentage?: number
          created_at?: string
          email?: string | null
          font_color?: string | null
          font_family?: string | null
          font_size?: string | null
          free_service_threshold?: number | null
          google_maps_url?: string | null
          id: string
          logo_url?: string | null
          payment_gateway_key?: string | null
          payment_gateway_provider?: string | null
          pix_key?: string | null
          pix_qr_code_url?: string | null
          plan?: string | null
          primary_color?: string | null
          responsible_name?: string | null
          role?: string | null
          scheduling_mode?: string | null
          secondary_color?: string | null
          slug?: string | null
          status?: string | null
          suspension_reason?: string | null
          tenant_id?: string | null
          trial_end?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          barbers_range?: string | null
          blocked_at?: string | null
          business_name?: string | null
          cashback_enabled?: boolean
          cashback_percentage?: number
          created_at?: string
          email?: string | null
          font_color?: string | null
          font_family?: string | null
          font_size?: string | null
          free_service_threshold?: number | null
          google_maps_url?: string | null
          id?: string
          logo_url?: string | null
          payment_gateway_key?: string | null
          payment_gateway_provider?: string | null
          pix_key?: string | null
          pix_qr_code_url?: string | null
          plan?: string | null
          primary_color?: string | null
          responsible_name?: string | null
          role?: string | null
          scheduling_mode?: string | null
          secondary_color?: string | null
          slug?: string | null
          status?: string | null
          suspension_reason?: string | null
          tenant_id?: string | null
          trial_end?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ratings: {
        Row: {
          appointment_id: string
          barber_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          rating: number
          user_id: string
        }
        Insert: {
          appointment_id: string
          barber_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          rating: number
          user_id: string
        }
        Update: {
          appointment_id?: string
          barber_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_ratings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          price: number
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachment_url: string | null
          attachment_urls: string[] | null
          created_at: string | null
          id: string
          is_admin_reply: boolean | null
          message: string
          sender_id: string | null
          ticket_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          attachment_urls?: string[] | null
          created_at?: string | null
          id?: string
          is_admin_reply?: boolean | null
          message: string
          sender_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          attachment_urls?: string[] | null
          created_at?: string | null
          id?: string
          is_admin_reply?: boolean | null
          message?: string
          sender_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          attachment_url: string | null
          attachment_urls: string[] | null
          barbershop_id: string | null
          category: string | null
          created_at: string | null
          description: string
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          attachment_urls?: string[] | null
          barbershop_id?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          attachment_urls?: string[] | null
          barbershop_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          admin_access_level: string | null
          audit_logs_enabled: boolean | null
          id: string
          integrations: Json | null
          main_url: string | null
          maintenance_mode: boolean | null
          payments_test_mode: boolean | null
          saas_logo: string | null
          saas_name: string | null
          stripe_secret_key: string | null
          stripe_webhook_secret: string | null
          two_factor_auth_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          admin_access_level?: string | null
          audit_logs_enabled?: boolean | null
          id?: string
          integrations?: Json | null
          main_url?: string | null
          maintenance_mode?: boolean | null
          payments_test_mode?: boolean | null
          saas_logo?: string | null
          saas_name?: string | null
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          two_factor_auth_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          admin_access_level?: string | null
          audit_logs_enabled?: boolean | null
          id?: string
          integrations?: Json | null
          main_url?: string | null
          maintenance_mode?: boolean | null
          payments_test_mode?: boolean | null
          saas_logo?: string | null
          saas_name?: string | null
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          two_factor_auth_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          barber_id: string | null
          category: string | null
          created_at: string
          date: string | null
          description: string | null
          id: string
          time: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          barber_id?: string | null
          category?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          time?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          barber_id?: string | null
          category?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          id?: string
          time?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          name: string
          order: number | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          order?: number | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          order?: number | null
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          category_id: string | null
          content_url: string
          created_at: string | null
          description: string | null
          id: string
          is_featured: boolean | null
          order: number | null
          thumbnail_url: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          content_url: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          order?: number | null
          thumbnail_url?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          content_url?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_featured?: boolean | null
          order?: number | null
          thumbnail_url?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tutorial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_preferences: {
        Row: {
          last_seen_at: string | null
          show_onboarding: boolean | null
          user_id: string
        }
        Insert: {
          last_seen_at?: string | null
          show_onboarding?: boolean | null
          user_id: string
        }
        Update: {
          last_seen_at?: string | null
          show_onboarding?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet: {
        Row: {
          balance: number
          created_at: string
          customer_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          barbershop_id: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          status: string
        }
        Insert: {
          barbershop_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          status: string
        }
        Update: {
          barbershop_id?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_cloud_connections: {
        Row: {
          access_token: string | null
          business_name: string | null
          connected_at: string | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          phone_number: string | null
          phone_number_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          waba_id: string | null
          webhook_verify_token: string | null
        }
        Insert: {
          access_token?: string | null
          business_name?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Update: {
          access_token?: string | null
          business_name?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          barber_id: string | null
          barbershop_id: string
          connected: boolean | null
          created_at: string
          id: string
          instance_id: string
          instance_name: string | null
          instance_token: string
          last_connection: string | null
          phone: string | null
          provider: string
          server_url: string
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          barber_id?: string | null
          barbershop_id: string
          connected?: boolean | null
          created_at?: string
          id?: string
          instance_id: string
          instance_name?: string | null
          instance_token: string
          last_connection?: string | null
          phone?: string | null
          provider?: string
          server_url: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          barber_id?: string | null
          barbershop_id?: string
          connected?: boolean | null
          created_at?: string
          id?: string
          instance_id?: string
          instance_name?: string | null
          instance_token?: string
          last_connection?: string | null
          phone?: string | null
          provider?: string
          server_url?: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          api_key: string | null
          api_url: string | null
          barber_id: string | null
          connected: boolean | null
          connection_type: string | null
          created_at: string
          id: string
          instance_name: string | null
          name: string
          phone: string | null
          provider: string
          qrcode: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          barber_id?: string | null
          connected?: boolean | null
          connection_type?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          name: string
          phone?: string | null
          provider?: string
          qrcode?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          barber_id?: string | null
          connected?: boolean | null
          connection_type?: string | null
          created_at?: string
          id?: string
          instance_name?: string | null
          name?: string
          phone?: string | null
          provider?: string
          qrcode?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          connection_id: string | null
          content: string | null
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          scheduled_for: string | null
          status: string
          type: string
          user_id: string
          wa_id: string | null
        }
        Insert: {
          connection_id?: string | null
          content?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          scheduled_for?: string | null
          status?: string
          type: string
          user_id: string
          wa_id?: string | null
        }
        Update: {
          connection_id?: string | null
          content?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          scheduled_for?: string | null
          status?: string
          type?: string
          user_id?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_cloud_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          content: string
          created_at: string | null
          event_type: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          event_type: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          event_type?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_appointment_by_token:
        | {
            Args: { token_val: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.cancel_appointment_by_token(token_val => text), public.cancel_appointment_by_token(token_val => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { token_val: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.cancel_appointment_by_token(token_val => text), public.cancel_appointment_by_token(token_val => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      decrement_product_stock: {
        Args: { amount: number; prod_id: string }
        Returns: undefined
      }
      generate_unique_slug: { Args: { base_name: string }; Returns: string }
      get_cron_status: {
        Args: never
        Returns: {
          cron_end_time: string
          cron_job_id: number
          cron_job_name: string
          cron_last_run: string
          cron_return_message: string
          cron_start_time: string
          cron_status: string
        }[]
      }
      get_my_profile_role: { Args: never; Returns: string }
      get_my_tenant_id: { Args: never; Returns: string }
      get_server_info: { Args: never; Returns: Json }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_profile_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_super_admin_user: { Args: never; Returns: boolean }
      process_product_sale: {
        Args: {
          p_customer_id: string
          p_items: Json
          p_pix_key: string
          p_total_amount: number
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "tenant_admin" | "barber" | "client"
      product_sale_status: "completed" | "cancelled" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "tenant_admin", "barber", "client"],
      product_sale_status: ["completed", "cancelled", "refunded"],
    },
  },
} as const
