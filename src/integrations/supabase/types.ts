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
          action_url: string | null
          archived: boolean
          created_at: string
          description: string | null
          id: string
          is_read: boolean | null
          message: string | null
          priority: string
          read_at: string | null
          reference_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          tenant_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          priority?: string
          read_at?: string | null
          reference_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          tenant_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          archived?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          priority?: string
          read_at?: string | null
          reference_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
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
      appointment_groups: {
        Row: {
          created_at: string | null
          customer_id: string | null
          group_token: string
          id: string
          payment_status: string | null
          status: string | null
          tenant_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          group_token: string
          id?: string
          payment_status?: string | null
          status?: string | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          group_token?: string
          id?: string
          payment_status?: string | null
          status?: string | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_groups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reviews: {
        Row: {
          appointment_id: string
          approved_at: string | null
          approved_by: string | null
          barber_id: string | null
          barber_rating: number | null
          barbershop_rating: number | null
          created_at: string
          customer_id: string | null
          id: string
          show_on_frontend: boolean
          tenant_id: string
          testimonial_status: string
          testimonial_text: string | null
        }
        Insert: {
          appointment_id: string
          approved_at?: string | null
          approved_by?: string | null
          barber_id?: string | null
          barber_rating?: number | null
          barbershop_rating?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          show_on_frontend?: boolean
          tenant_id: string
          testimonial_status?: string
          testimonial_text?: string | null
        }
        Update: {
          appointment_id?: string
          approved_at?: string | null
          approved_by?: string | null
          barber_id?: string | null
          barber_rating?: number | null
          barbershop_rating?: number | null
          created_at?: string
          customer_id?: string | null
          id?: string
          show_on_frontend?: boolean
          tenant_id?: string
          testimonial_status?: string
          testimonial_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "appointment_reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_status_logs: {
        Row: {
          appointment_id: string
          changed_by_id: string | null
          changed_by_type: string
          created_at: string
          error: string | null
          id: string
          metadata: Json | null
          new_status: string
          old_status: string | null
          rpc_response: Json | null
          source: string
          status_after: string | null
          status_before: string | null
        }
        Insert: {
          appointment_id: string
          changed_by_id?: string | null
          changed_by_type: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          new_status: string
          old_status?: string | null
          rpc_response?: Json | null
          source: string
          status_after?: string | null
          status_before?: string | null
        }
        Update: {
          appointment_id?: string
          changed_by_id?: string | null
          changed_by_type?: string
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json | null
          new_status?: string
          old_status?: string | null
          rpc_response?: Json | null
          source?: string
          status_after?: string | null
          status_before?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_status_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_status_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
        ]
      }
      appointments: {
        Row: {
          amount_paid: number | null
          appointment_group_id: string | null
          barber_id: string | null
          barbershop_amount: number | null
          cancel_reason: string | null
          cancel_source: string | null
          cancel_token: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cash_amount: number | null
          cashback_earned: number | null
          cashback_used: number | null
          completed_at: string | null
          completed_by: string | null
          confirmation_response_sent_at: string | null
          confirmation_sent: boolean | null
          confirmation_sent_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          credit_card_amount: number | null
          credit_used: number | null
          credits_used: number | null
          customer_action_source: string | null
          customer_id: string | null
          debit_card_amount: number | null
          discount_amount: number | null
          end_time: string
          extra_amount: number
          final_amount: number | null
          group_sequence: number | null
          id: string
          items: Json | null
          management_token: string | null
          notes: string | null
          original_total: number | null
          paid_at: string | null
          payment_breakdown: Json | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          pix_amount: number | null
          refund_preference: string | null
          refund_requested_at: string | null
          refund_status: string | null
          refund_type: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          rescheduled_from_id: string | null
          service_amount: number | null
          service_id: string | null
          source: string | null
          start_time: string
          status: string | null
          subscription_covered_amount: number
          subscription_id: string | null
          subscription_plan_id: string | null
          subtotal_amount: number | null
          tenant_id: string
          total_price: number | null
          updated_at: string | null
          updated_by_id: string | null
          updated_by_type: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          appointment_group_id?: string | null
          barber_id?: string | null
          barbershop_amount?: number | null
          cancel_reason?: string | null
          cancel_source?: string | null
          cancel_token?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_amount?: number | null
          cashback_earned?: number | null
          cashback_used?: number | null
          completed_at?: string | null
          completed_by?: string | null
          confirmation_response_sent_at?: string | null
          confirmation_sent?: boolean | null
          confirmation_sent_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          credit_card_amount?: number | null
          credit_used?: number | null
          credits_used?: number | null
          customer_action_source?: string | null
          customer_id?: string | null
          debit_card_amount?: number | null
          discount_amount?: number | null
          end_time: string
          extra_amount?: number
          final_amount?: number | null
          group_sequence?: number | null
          id?: string
          items?: Json | null
          management_token?: string | null
          notes?: string | null
          original_total?: number | null
          paid_at?: string | null
          payment_breakdown?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pix_amount?: number | null
          refund_preference?: string | null
          refund_requested_at?: string | null
          refund_status?: string | null
          refund_type?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          rescheduled_from_id?: string | null
          service_amount?: number | null
          service_id?: string | null
          source?: string | null
          start_time: string
          status?: string | null
          subscription_covered_amount?: number
          subscription_id?: string | null
          subscription_plan_id?: string | null
          subtotal_amount?: number | null
          tenant_id: string
          total_price?: number | null
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_type?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          appointment_group_id?: string | null
          barber_id?: string | null
          barbershop_amount?: number | null
          cancel_reason?: string | null
          cancel_source?: string | null
          cancel_token?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cash_amount?: number | null
          cashback_earned?: number | null
          cashback_used?: number | null
          completed_at?: string | null
          completed_by?: string | null
          confirmation_response_sent_at?: string | null
          confirmation_sent?: boolean | null
          confirmation_sent_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          credit_card_amount?: number | null
          credit_used?: number | null
          credits_used?: number | null
          customer_action_source?: string | null
          customer_id?: string | null
          debit_card_amount?: number | null
          discount_amount?: number | null
          end_time?: string
          extra_amount?: number
          final_amount?: number | null
          group_sequence?: number | null
          id?: string
          items?: Json | null
          management_token?: string | null
          notes?: string | null
          original_total?: number | null
          paid_at?: string | null
          payment_breakdown?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pix_amount?: number | null
          refund_preference?: string | null
          refund_requested_at?: string | null
          refund_status?: string | null
          refund_type?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          rescheduled_from_id?: string | null
          service_amount?: number | null
          service_id?: string | null
          source?: string | null
          start_time?: string
          status?: string | null
          subscription_covered_amount?: number
          subscription_id?: string | null
          subscription_plan_id?: string | null
          subtotal_amount?: number | null
          tenant_id?: string
          total_price?: number | null
          updated_at?: string | null
          updated_by_id?: string | null
          updated_by_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_appointment_group_id_fkey"
            columns: ["appointment_group_id"]
            isOneToOne: false
            referencedRelation: "appointment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
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
            foreignKeyName: "appointments_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      automation_conversations: {
        Row: {
          appointment_id: string | null
          appointment_ids: string[] | null
          automation_id: string | null
          automation_type: string
          confirmed_at: string | null
          created_at: string
          current_state: string
          customer_id: string | null
          customer_phone: string | null
          expected_response: string | null
          expires_at: string
          id: string
          last_option_id: string | null
          phone: string
          phone_normalized: string | null
          remaining_appointment_ids: string[] | null
          selected_appointment_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          workflow_key: string | null
        }
        Insert: {
          appointment_id?: string | null
          appointment_ids?: string[] | null
          automation_id?: string | null
          automation_type: string
          confirmed_at?: string | null
          created_at?: string
          current_state?: string
          customer_id?: string | null
          customer_phone?: string | null
          expected_response?: string | null
          expires_at?: string
          id?: string
          last_option_id?: string | null
          phone: string
          phone_normalized?: string | null
          remaining_appointment_ids?: string[] | null
          selected_appointment_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          workflow_key?: string | null
        }
        Update: {
          appointment_id?: string | null
          appointment_ids?: string[] | null
          automation_id?: string | null
          automation_type?: string
          confirmed_at?: string | null
          created_at?: string
          current_state?: string
          customer_id?: string | null
          customer_phone?: string | null
          expected_response?: string | null
          expires_at?: string
          id?: string
          last_option_id?: string | null
          phone?: string
          phone_normalized?: string | null
          remaining_appointment_ids?: string[] | null
          selected_appointment_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          workflow_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_conversations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_conversations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_conversations_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_cron_runs: {
        Row: {
          appointment_id: string | null
          details: Json | null
          eligible_count: number | null
          error: string | null
          error_count: number | null
          errors: Json | null
          finished_at: string | null
          found_count: number | null
          id: string
          processed_appointments: Json | null
          processed_count: number | null
          skipped_count: number | null
          started_at: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          details?: Json | null
          eligible_count?: number | null
          error?: string | null
          error_count?: number | null
          errors?: Json | null
          finished_at?: string | null
          found_count?: number | null
          id?: string
          processed_appointments?: Json | null
          processed_count?: number | null
          skipped_count?: number | null
          started_at?: string
          status: string
          tenant_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          details?: Json | null
          eligible_count?: number | null
          error?: string | null
          error_count?: number | null
          errors?: Json | null
          finished_at?: string | null
          found_count?: number | null
          id?: string
          processed_appointments?: Json | null
          processed_count?: number | null
          skipped_count?: number | null
          started_at?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_cron_runs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_cron_runs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_cron_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_dispatches: {
        Row: {
          appointment_id: string | null
          automation_type: string
          created_at: string
          customer_id: string | null
          id: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          unique_key: string | null
        }
        Insert: {
          appointment_id?: string | null
          automation_type: string
          created_at?: string
          customer_id?: string | null
          id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          unique_key?: string | null
        }
        Update: {
          appointment_id?: string | null
          automation_type?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          unique_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_dispatches_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_dispatches_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_dispatches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          action: string | null
          appointment_group_id: string | null
          appointment_id: string | null
          automation_id: string | null
          barber_id: string | null
          button_id: string | null
          callback_received: boolean | null
          callback_received_at: string | null
          conversation_id: string | null
          created_at: string | null
          customer_id: string | null
          direction: string | null
          error_message: string | null
          final_status: string | null
          id: string
          idempotency_key: string | null
          message_sent: string | null
          message_type: string | null
          metadata: Json | null
          option_id: string | null
          original_template: string | null
          payload: Json | null
          phone: string | null
          processed_template: string | null
          provider: string | null
          provider_message_id: string | null
          received_at: string | null
          response: Json | null
          selected_option_normalized: string | null
          selected_option_raw: string | null
          sent_at: string
          state_after: string | null
          state_before: string | null
          status: string
          tenant_id: string
          webhook_type: string | null
          zapi_response: Json | null
        }
        Insert: {
          action?: string | null
          appointment_group_id?: string | null
          appointment_id?: string | null
          automation_id?: string | null
          barber_id?: string | null
          button_id?: string | null
          callback_received?: boolean | null
          callback_received_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          direction?: string | null
          error_message?: string | null
          final_status?: string | null
          id?: string
          idempotency_key?: string | null
          message_sent?: string | null
          message_type?: string | null
          metadata?: Json | null
          option_id?: string | null
          original_template?: string | null
          payload?: Json | null
          phone?: string | null
          processed_template?: string | null
          provider?: string | null
          provider_message_id?: string | null
          received_at?: string | null
          response?: Json | null
          selected_option_normalized?: string | null
          selected_option_raw?: string | null
          sent_at?: string
          state_after?: string | null
          state_before?: string | null
          status: string
          tenant_id: string
          webhook_type?: string | null
          zapi_response?: Json | null
        }
        Update: {
          action?: string | null
          appointment_group_id?: string | null
          appointment_id?: string | null
          automation_id?: string | null
          barber_id?: string | null
          button_id?: string | null
          callback_received?: boolean | null
          callback_received_at?: string | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          direction?: string | null
          error_message?: string | null
          final_status?: string | null
          id?: string
          idempotency_key?: string | null
          message_sent?: string | null
          message_type?: string | null
          metadata?: Json | null
          option_id?: string | null
          original_template?: string | null
          payload?: Json | null
          phone?: string | null
          processed_template?: string | null
          provider?: string | null
          provider_message_id?: string | null
          received_at?: string | null
          response?: Json | null
          selected_option_normalized?: string | null
          selected_option_raw?: string | null
          sent_at?: string
          state_after?: string | null
          state_before?: string | null
          status?: string
          tenant_id?: string
          webhook_type?: string | null
          zapi_response?: Json | null
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
            foreignKeyName: "automation_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "automation_conversations"
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
      automation_queue: {
        Row: {
          appointment_group_id: string | null
          appointment_id: string | null
          attempts: number | null
          automation_id: string | null
          automation_type: string | null
          created_at: string | null
          customer_id: string | null
          error_message: string | null
          event_name: string | null
          id: string
          idempotency_key: string | null
          last_retry_at: string | null
          next_retry_at: string | null
          payload: Json | null
          processed_at: string | null
          reference_year: number | null
          retry_count: number | null
          scheduled_for: string | null
          status: string
          tenant_id: string
          updated_at: string | null
          workflow_key: string | null
        }
        Insert: {
          appointment_group_id?: string | null
          appointment_id?: string | null
          attempts?: number | null
          automation_id?: string | null
          automation_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          event_name?: string | null
          id?: string
          idempotency_key?: string | null
          last_retry_at?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          reference_year?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
          workflow_key?: string | null
        }
        Update: {
          appointment_group_id?: string | null
          appointment_id?: string | null
          attempts?: number | null
          automation_id?: string | null
          automation_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_message?: string | null
          event_name?: string | null
          id?: string
          idempotency_key?: string | null
          last_retry_at?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          reference_year?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
          workflow_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_queue_appointment_group_id_fkey"
            columns: ["appointment_group_id"]
            isOneToOne: false
            referencedRelation: "appointment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_queue_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_reconciliation_settings: {
        Row: {
          alert_period_hours: number | null
          created_at: string | null
          id: string
          not_found_alert_threshold: number | null
          pending_callback_alert_threshold: number | null
          reconciliation_interval_minutes: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          alert_period_hours?: number | null
          created_at?: string | null
          id?: string
          not_found_alert_threshold?: number | null
          pending_callback_alert_threshold?: number | null
          reconciliation_interval_minutes?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_period_hours?: number | null
          created_at?: string | null
          id?: string
          not_found_alert_threshold?: number | null
          pending_callback_alert_threshold?: number | null
          reconciliation_interval_minutes?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_reconciliation_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_send_history: {
        Row: {
          appointment_id: string | null
          automation_name: string | null
          channel: string | null
          conversation_created: boolean | null
          conversation_error: string | null
          conversation_id: string | null
          created_at: string
          event_name: string | null
          id: string
          payload: Json | null
          phone: string | null
          provider_message_id: string | null
          source: string | null
          status: string | null
          tenant_id: string | null
          zapi_response: Json | null
        }
        Insert: {
          appointment_id?: string | null
          automation_name?: string | null
          channel?: string | null
          conversation_created?: boolean | null
          conversation_error?: string | null
          conversation_id?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          payload?: Json | null
          phone?: string | null
          provider_message_id?: string | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          zapi_response?: Json | null
        }
        Update: {
          appointment_id?: string | null
          automation_name?: string | null
          channel?: string | null
          conversation_created?: boolean | null
          conversation_error?: string | null
          conversation_id?: string | null
          created_at?: string
          event_name?: string | null
          id?: string
          payload?: Json | null
          phone?: string | null
          provider_message_id?: string | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          zapi_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_send_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_send_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_send_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "automation_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_send_history_tenant_id_fkey"
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
      automation_templates: {
        Row: {
          active: boolean | null
          additional_templates: Json | null
          buttons: Json | null
          channel: string
          created_at: string | null
          id: string
          key: string
          last_notified_at: string | null
          last_reprocessed_at: string | null
          name: string
          reprocessing_attempts: number | null
          reprocessing_config: Json | null
          reprocessing_history: Json | null
          reprocessing_status: string | null
          requires_callback: boolean | null
          template: string
          tenant_id: string
          trigger_event: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          additional_templates?: Json | null
          buttons?: Json | null
          channel?: string
          created_at?: string | null
          id?: string
          key: string
          last_notified_at?: string | null
          last_reprocessed_at?: string | null
          name: string
          reprocessing_attempts?: number | null
          reprocessing_config?: Json | null
          reprocessing_history?: Json | null
          reprocessing_status?: string | null
          requires_callback?: boolean | null
          template: string
          tenant_id: string
          trigger_event: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          additional_templates?: Json | null
          buttons?: Json | null
          channel?: string
          created_at?: string | null
          id?: string
          key?: string
          last_notified_at?: string | null
          last_reprocessed_at?: string | null
          name?: string
          reprocessing_attempts?: number | null
          reprocessing_config?: Json | null
          reprocessing_history?: Json | null
          reprocessing_status?: string | null
          requires_callback?: boolean | null
          template?: string
          tenant_id?: string
          trigger_event?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_v2_dispatches: {
        Row: {
          action_executed: boolean | null
          action_executed_at: string | null
          anniversary_message_type: string | null
          anniversary_year: number | null
          appointment_group_id: string | null
          appointment_id: string | null
          birthday_year: number | null
          callback_button_id: string | null
          callback_payload: Json | null
          callback_received: boolean | null
          callback_received_at: string | null
          channel: string
          created_at: string
          current_step: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          error: string | null
          error_log: Json | null
          finalized: boolean | null
          finalized_at: string | null
          flow_type: string
          id: string
          last_retry_at: string | null
          message_id: string | null
          payload: Json | null
          phone: string
          provider_message_id: string | null
          provider_response: Json | null
          requires_callback: boolean | null
          retry_count: number | null
          sent_at: string | null
          session_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          workflow_key: string
          zaap_id: string | null
        }
        Insert: {
          action_executed?: boolean | null
          action_executed_at?: string | null
          anniversary_message_type?: string | null
          anniversary_year?: number | null
          appointment_group_id?: string | null
          appointment_id?: string | null
          birthday_year?: number | null
          callback_button_id?: string | null
          callback_payload?: Json | null
          callback_received?: boolean | null
          callback_received_at?: string | null
          channel?: string
          created_at?: string
          current_step?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error?: string | null
          error_log?: Json | null
          finalized?: boolean | null
          finalized_at?: string | null
          flow_type?: string
          id?: string
          last_retry_at?: string | null
          message_id?: string | null
          payload?: Json | null
          phone: string
          provider_message_id?: string | null
          provider_response?: Json | null
          requires_callback?: boolean | null
          retry_count?: number | null
          sent_at?: string | null
          session_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          workflow_key: string
          zaap_id?: string | null
        }
        Update: {
          action_executed?: boolean | null
          action_executed_at?: string | null
          anniversary_message_type?: string | null
          anniversary_year?: number | null
          appointment_group_id?: string | null
          appointment_id?: string | null
          birthday_year?: number | null
          callback_button_id?: string | null
          callback_payload?: Json | null
          callback_received?: boolean | null
          callback_received_at?: string | null
          channel?: string
          created_at?: string
          current_step?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          error?: string | null
          error_log?: Json | null
          finalized?: boolean | null
          finalized_at?: string | null
          flow_type?: string
          id?: string
          last_retry_at?: string | null
          message_id?: string | null
          payload?: Json | null
          phone?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          requires_callback?: boolean | null
          retry_count?: number | null
          sent_at?: string | null
          session_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          workflow_key?: string
          zaap_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_v2_dispatches_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_v2_dispatches_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_v2_dispatches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_v2_dispatches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "automation_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_v2_dispatches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_v2_logs: {
        Row: {
          appointment_id: string | null
          context: Json | null
          created_at: string
          id: string
          level: string
          message: string
          tenant_id: string
        }
        Insert: {
          appointment_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message: string
          tenant_id: string
        }
        Update: {
          appointment_id?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_v2_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_v2_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_v2_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_v2_sessions: {
        Row: {
          appointment_group_id: string | null
          appointment_id: string | null
          context: Json | null
          created_at: string
          current_step: string
          customer_id: string | null
          expires_at: string | null
          flow_type: string
          id: string
          phone: string
          provider_message_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_group_id?: string | null
          appointment_id?: string | null
          context?: Json | null
          created_at?: string
          current_step?: string
          customer_id?: string | null
          expires_at?: string | null
          flow_type?: string
          id?: string
          phone: string
          provider_message_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_group_id?: string | null
          appointment_id?: string | null
          context?: Json | null
          created_at?: string
          current_step?: string
          customer_id?: string | null
          expires_at?: string | null
          flow_type?: string
          id?: string
          phone?: string
          provider_message_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_v2_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_v2_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_v2_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_v2_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_webhook_logs: {
        Row: {
          appointment_id: string | null
          appointment_id_found: string | null
          buttonid: string | null
          buttonId: string | null
          buttontext: string | null
          conversation_found: boolean | null
          conversation_id: string | null
          conversation_selected_id: string | null
          conversations_found_count: number | null
          created_at: string | null
          error: string | null
          fromme: boolean | null
          id: string
          incoming_text: string | null
          last_processing_step: string | null
          matched_action: string | null
          messageid: string | null
          normalized_text: string | null
          phone: string | null
          phone_normalized: string | null
          phone_raw: string | null
          processed_at: string | null
          processing_error: string | null
          query_filters_used: Json | null
          raw_payload: Json
          referencemessageid: string | null
          response_sent: boolean | null
          status_after: string | null
          status_before: string | null
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          appointment_id?: string | null
          appointment_id_found?: string | null
          buttonid?: string | null
          buttonId?: string | null
          buttontext?: string | null
          conversation_found?: boolean | null
          conversation_id?: string | null
          conversation_selected_id?: string | null
          conversations_found_count?: number | null
          created_at?: string | null
          error?: string | null
          fromme?: boolean | null
          id?: string
          incoming_text?: string | null
          last_processing_step?: string | null
          matched_action?: string | null
          messageid?: string | null
          normalized_text?: string | null
          phone?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          processed_at?: string | null
          processing_error?: string | null
          query_filters_used?: Json | null
          raw_payload: Json
          referencemessageid?: string | null
          response_sent?: boolean | null
          status_after?: string | null
          status_before?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          appointment_id?: string | null
          appointment_id_found?: string | null
          buttonid?: string | null
          buttonId?: string | null
          buttontext?: string | null
          conversation_found?: boolean | null
          conversation_id?: string | null
          conversation_selected_id?: string | null
          conversations_found_count?: number | null
          created_at?: string | null
          error?: string | null
          fromme?: boolean | null
          id?: string
          incoming_text?: string | null
          last_processing_step?: string | null
          matched_action?: string | null
          messageid?: string | null
          normalized_text?: string | null
          phone?: string | null
          phone_normalized?: string | null
          phone_raw?: string | null
          processed_at?: string | null
          processing_error?: string | null
          query_filters_used?: Json | null
          raw_payload?: Json
          referencemessageid?: string | null
          response_sent?: boolean | null
          status_after?: string | null
          status_before?: string | null
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_webhook_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_webhook_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "automation_webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          barber_id: string | null
          channel: string | null
          created_at: string
          enabled: boolean | null
          id: string
          template: string | null
          template_multiple: string | null
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
          template_multiple?: string | null
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
          template_multiple?: string | null
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
      barber_commissions: {
        Row: {
          appointment_id: string
          barber_id: string
          commission_amount: number
          commission_fixed_amount: number
          commission_percentage: number
          commission_type: string
          created_at: string
          customer_id: string | null
          id: string
          paid_at: string | null
          paid_by: string | null
          service_amount: number
          service_id: string | null
          service_name: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          barber_id: string
          commission_amount?: number
          commission_fixed_amount?: number
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          service_amount?: number
          service_id?: string | null
          service_name?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          barber_id?: string
          commission_amount?: number
          commission_fixed_amount?: number
          commission_percentage?: number
          commission_type?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          service_amount?: number
          service_id?: string | null
          service_name?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      barber_services: {
        Row: {
          barber_id: string | null
          created_at: string | null
          id: string
          service_id: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          barber_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          barber_id?: string | null
          created_at?: string | null
          id?: string
          service_id?: string | null
          tenant_id?: string | null
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
          bio: string | null
          category: string | null
          commission_bonus_value: number
          commission_fixed_value: number
          commission_rate: number | null
          commission_type: string
          created_at: string
          email: string | null
          id: string
          monthly_goal: number
          name: string
          phone: string | null
          specialties: string[] | null
          tenant_id: string | null
          total_ratings: number | null
          updated_at: string | null
          user_id: string
          working_hours: Json | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          category?: string | null
          commission_bonus_value?: number
          commission_fixed_value?: number
          commission_rate?: number | null
          commission_type?: string
          created_at?: string
          email?: string | null
          id?: string
          monthly_goal?: number
          name: string
          phone?: string | null
          specialties?: string[] | null
          tenant_id?: string | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id: string
          working_hours?: Json | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          average_rating?: number | null
          bio?: string | null
          category?: string | null
          commission_bonus_value?: number
          commission_fixed_value?: number
          commission_rate?: number | null
          commission_type?: string
          created_at?: string
          email?: string | null
          id?: string
          monthly_goal?: number
          name?: string
          phone?: string | null
          specialties?: string[] | null
          tenant_id?: string | null
          total_ratings?: number | null
          updated_at?: string | null
          user_id?: string
          working_hours?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "barbers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershop_module_logs: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          module_key: string
          new_value: boolean
          old_value: boolean | null
          tenant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          module_key: string
          new_value: boolean
          old_value?: boolean | null
          tenant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          module_key?: string
          new_value?: boolean
          old_value?: boolean | null
          tenant_id?: string
        }
        Relationships: []
      }
      barbershop_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      barbershop_settings: {
        Row: {
          barber_id: string
          client_token: string | null
          created_at: string
          id: string
          instance_id: string | null
          instance_token: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          barber_id: string
          client_token?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          barber_id?: string
          client_token?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbershop_settings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershops: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          plan_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          plan_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          plan_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbershops_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
      cashback_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          base_amount: number | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          base_amount?: number | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          base_amount?: number | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cashback_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashback_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "cashback_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      commission_closings: {
        Row: {
          barber_id: string
          created_at: string
          id: string
          notes: string | null
          paid_amount: number
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          tenant_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          tenant_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          tenant_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      commission_entries: {
        Row: {
          appointment_id: string
          barber_id: string
          closing_id: string | null
          commission_amount: number
          commission_bonus: number
          commission_fixed: number
          commission_rate: number
          commission_type: string
          created_at: string
          customer_id: string | null
          earned_at: string
          id: string
          paid_amount: number
          service_amount: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          barber_id: string
          closing_id?: string | null
          commission_amount?: number
          commission_bonus?: number
          commission_fixed?: number
          commission_rate?: number
          commission_type?: string
          created_at?: string
          customer_id?: string | null
          earned_at?: string
          id?: string
          paid_amount?: number
          service_amount?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          barber_id?: string
          closing_id?: string | null
          commission_amount?: number
          commission_bonus?: number
          commission_fixed?: number
          commission_rate?: number
          commission_type?: string
          created_at?: string
          customer_id?: string | null
          earned_at?: string
          id?: string
          paid_amount?: number
          service_amount?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cookie_consents: {
        Row: {
          created_at: string
          customer_id: string | null
          device: string | null
          id: string
          ip: string | null
          marketing: boolean
          necessary: boolean
          policy_version: string
          preferences: boolean
          session_id: string | null
          source: string | null
          statistics: boolean
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          device?: string | null
          id?: string
          ip?: string | null
          marketing?: boolean
          necessary?: boolean
          policy_version?: string
          preferences?: boolean
          session_id?: string | null
          source?: string | null
          statistics?: boolean
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          device?: string | null
          id?: string
          ip?: string | null
          marketing?: boolean
          necessary?: boolean
          policy_version?: string
          preferences?: boolean
          session_id?: string | null
          source?: string | null
          statistics?: boolean
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cookie_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cookie_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean | null
          applies_to: string
          code: string
          created_at: string | null
          expires_at: string | null
          first_month_only: boolean
          id: string
          max_discount: number | null
          minimum_amount: number | null
          starts_at: string | null
          tenant_id: string
          type: string
          usage_limit: number | null
          used_count: number | null
          value: number
        }
        Insert: {
          active?: boolean | null
          applies_to?: string
          code: string
          created_at?: string | null
          expires_at?: string | null
          first_month_only?: boolean
          id?: string
          max_discount?: number | null
          minimum_amount?: number | null
          starts_at?: string | null
          tenant_id: string
          type: string
          usage_limit?: number | null
          used_count?: number | null
          value: number
        }
        Update: {
          active?: boolean | null
          applies_to?: string
          code?: string
          created_at?: string | null
          expires_at?: string | null
          first_month_only?: boolean
          id?: string
          max_discount?: number | null
          minimum_amount?: number | null
          starts_at?: string | null
          tenant_id?: string
          type?: string
          usage_limit?: number | null
          used_count?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "credit_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credits: {
        Row: {
          amount: number
          appointment_id: string | null
          available_amount: number | null
          created_at: string | null
          credit_type: string | null
          customer_id: string
          expires_at: string | null
          id: string
          payment_id: string | null
          source_payment_id: string | null
          status: string
          tenant_id: string
          updated_at: string | null
          used_amount: number
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          available_amount?: number | null
          created_at?: string | null
          credit_type?: string | null
          customer_id: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          source_payment_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
          used_amount?: number
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          available_amount?: number | null
          created_at?: string | null
          credit_type?: string | null
          customer_id?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          source_payment_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
          used_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_credits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "customer_credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_subscriptions: {
        Row: {
          auto_renew: boolean
          canceled_at: string | null
          card_token: string | null
          card_token_issued_at: string | null
          card_token_revoked_at: string | null
          coupon_code: string | null
          coupon_discount: number
          coupon_first_month_only: boolean
          coupon_id: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          customer_id: string
          external_ref: string | null
          id: string
          metadata: Json
          next_billing_at: string | null
          pause_notes: string | null
          pause_reason: string | null
          pause_until: string | null
          paused_at: string | null
          payment_method: string
          plan_id: string
          referral_code: string | null
          referred_by_code: string | null
          referred_by_subscription_id: string | null
          resumed_at: string | null
          started_at: string
          status: string
          tenant_id: string
          total_paused_days: number
          updated_at: string
          uses_this_period: number
        }
        Insert: {
          auto_renew?: boolean
          canceled_at?: string | null
          card_token?: string | null
          card_token_issued_at?: string | null
          card_token_revoked_at?: string | null
          coupon_code?: string | null
          coupon_discount?: number
          coupon_first_month_only?: boolean
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          customer_id: string
          external_ref?: string | null
          id?: string
          metadata?: Json
          next_billing_at?: string | null
          pause_notes?: string | null
          pause_reason?: string | null
          pause_until?: string | null
          paused_at?: string | null
          payment_method?: string
          plan_id: string
          referral_code?: string | null
          referred_by_code?: string | null
          referred_by_subscription_id?: string | null
          resumed_at?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          total_paused_days?: number
          updated_at?: string
          uses_this_period?: number
        }
        Update: {
          auto_renew?: boolean
          canceled_at?: string | null
          card_token?: string | null
          card_token_issued_at?: string | null
          card_token_revoked_at?: string | null
          coupon_code?: string | null
          coupon_discount?: number
          coupon_first_month_only?: boolean
          coupon_id?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          customer_id?: string
          external_ref?: string | null
          id?: string
          metadata?: Json
          next_billing_at?: string | null
          pause_notes?: string | null
          pause_reason?: string | null
          pause_until?: string | null
          paused_at?: string | null
          payment_method?: string
          plan_id?: string
          referral_code?: string | null
          referred_by_code?: string | null
          referred_by_subscription_id?: string | null
          resumed_at?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          total_paused_days?: number
          updated_at?: string
          uses_this_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_subscriptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_subscriptions_referred_by_subscription_id_fkey"
            columns: ["referred_by_subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          allow_marketing: boolean
          allow_notifications: boolean
          avatar_url: string | null
          barber_id: string | null
          birth_date: string | null
          birthday_sent: boolean | null
          cashback_balance: number
          cashback_used: number | null
          created_at: string
          credit_balance: number | null
          credits: number | null
          credits_used: number | null
          deletion_requested_at: string | null
          deletion_status: string | null
          email: string | null
          id: string
          last_visit: string | null
          lifetime_value: number | null
          loyalty_points: number | null
          name: string
          notes: string | null
          phone: string | null
          policy_version_accepted: string | null
          privacy_accepted_at: string | null
          tenant_id: string | null
          terms_accepted_at: string | null
          total_spent: number | null
          updated_at: string | null
          user_id: string
          whatsapp_marketing_consent: boolean
          whatsapp_transactional_consent: boolean
        }
        Insert: {
          allow_marketing?: boolean
          allow_notifications?: boolean
          avatar_url?: string | null
          barber_id?: string | null
          birth_date?: string | null
          birthday_sent?: boolean | null
          cashback_balance?: number
          cashback_used?: number | null
          created_at?: string
          credit_balance?: number | null
          credits?: number | null
          credits_used?: number | null
          deletion_requested_at?: string | null
          deletion_status?: string | null
          email?: string | null
          id?: string
          last_visit?: string | null
          lifetime_value?: number | null
          loyalty_points?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          policy_version_accepted?: string | null
          privacy_accepted_at?: string | null
          tenant_id?: string | null
          terms_accepted_at?: string | null
          total_spent?: number | null
          updated_at?: string | null
          user_id: string
          whatsapp_marketing_consent?: boolean
          whatsapp_transactional_consent?: boolean
        }
        Update: {
          allow_marketing?: boolean
          allow_notifications?: boolean
          avatar_url?: string | null
          barber_id?: string | null
          birth_date?: string | null
          birthday_sent?: boolean | null
          cashback_balance?: number
          cashback_used?: number | null
          created_at?: string
          credit_balance?: number | null
          credits?: number | null
          credits_used?: number | null
          deletion_requested_at?: string | null
          deletion_status?: string | null
          email?: string | null
          id?: string
          last_visit?: string | null
          lifetime_value?: number | null
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          policy_version_accepted?: string | null
          privacy_accepted_at?: string | null
          tenant_id?: string | null
          terms_accepted_at?: string | null
          total_spent?: number | null
          updated_at?: string | null
          user_id?: string
          whatsapp_marketing_consent?: boolean
          whatsapp_transactional_consent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customers_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      financial_adjustment_logs: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          appointment_id: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string
          tenant_id: string | null
          transaction_id: string | null
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          appointment_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason: string
          tenant_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          appointment_id?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string
          tenant_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_adjustment_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustment_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "financial_adjustment_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_adjustment_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_requests: {
        Row: {
          contact_email: string | null
          created_at: string
          customer_id: string | null
          id: string
          ip: string | null
          notes: string | null
          payload: Json
          request_type: string
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          response: Json | null
          status: string
          tenant_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          notes?: string | null
          payload?: Json
          request_type: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          notes?: string | null
          payload?: Json
          request_type?: string
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          response?: Json | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_campaign_participations: {
        Row: {
          campaign_id: string
          created_at: string
          current_value: number
          customer_id: string
          id: string
          notes: string | null
          progress: Json
          redeemed_at: string | null
          reward_granted: Json | null
          target_value: number | null
          tenant_id: string
          unlocked_at: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          current_value?: number
          customer_id: string
          id?: string
          notes?: string | null
          progress?: Json
          redeemed_at?: string | null
          reward_granted?: Json | null
          target_value?: number | null
          tenant_id: string
          unlocked_at?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          current_value?: number
          customer_id?: string
          id?: string
          notes?: string | null
          progress?: Json
          redeemed_at?: string | null
          reward_granted?: Json | null
          target_value?: number | null
          tenant_id?: string
          unlocked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_campaign_participations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "loyalty_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_campaign_templates: {
        Row: {
          benefits: Json
          category: string
          color: string | null
          created_at: string
          default_config: Json
          description: string
          difficulty: string
          icon: string | null
          id: string
          is_featured: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          benefits?: Json
          category: string
          color?: string | null
          created_at?: string
          default_config?: Json
          description: string
          difficulty?: string
          icon?: string | null
          id?: string
          is_featured?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          benefits?: Json
          category?: string
          color?: string | null
          created_at?: string
          default_config?: Json
          description?: string
          difficulty?: string
          icon?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_campaigns: {
        Row: {
          allow_combine: boolean
          allow_stacking: boolean
          badge: string | null
          category: string | null
          color: string | null
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          icon: string | null
          id: string
          image_url: string | null
          limit_per_campaign: number | null
          limit_per_customer: number | null
          message_template: string | null
          name: string
          notify_email: boolean
          notify_portal: boolean
          notify_push: boolean
          notify_whatsapp: boolean
          reward: Json
          rule_type: string
          starts_at: string | null
          status: string
          template_slug: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_combine?: boolean
          allow_stacking?: boolean
          badge?: string | null
          category?: string | null
          color?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          limit_per_campaign?: number | null
          limit_per_customer?: number | null
          message_template?: string | null
          name: string
          notify_email?: boolean
          notify_portal?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          reward?: Json
          rule_type: string
          starts_at?: string | null
          status?: string
          template_slug?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_combine?: boolean
          allow_stacking?: boolean
          badge?: string | null
          category?: string | null
          color?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          limit_per_campaign?: number | null
          limit_per_customer?: number | null
          message_template?: string | null
          name?: string
          notify_email?: boolean
          notify_portal?: boolean
          notify_push?: boolean
          notify_whatsapp?: boolean
          reward?: Json
          rule_type?: string
          starts_at?: string | null
          status?: string
          template_slug?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_campaigns_template_slug_fkey"
            columns: ["template_slug"]
            isOneToOne: false
            referencedRelation: "loyalty_campaign_templates"
            referencedColumns: ["slug"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          appointments_count: number
          barbershop_cost: number
          benefit_description: string
          benefit_type: string
          benefit_value: number
          created_at: string
          customer_id: string
          earned_at: string
          expires_at: string | null
          id: string
          max_benefit_value: number
          redeemed_appointment_id: string | null
          redeemed_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          appointments_count: number
          barbershop_cost?: number
          benefit_description?: string
          benefit_type: string
          benefit_value?: number
          created_at?: string
          customer_id: string
          earned_at?: string
          expires_at?: string | null
          id?: string
          max_benefit_value?: number
          redeemed_appointment_id?: string | null
          redeemed_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          appointments_count?: number
          barbershop_cost?: number
          benefit_description?: string
          benefit_type?: string
          benefit_value?: number
          created_at?: string
          customer_id?: string
          earned_at?: string
          expires_at?: string | null
          id?: string
          max_benefit_value?: number
          redeemed_appointment_id?: string | null
          redeemed_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          appointments_required: number
          benefit_description: string
          benefit_type: string
          benefit_value: number
          created_at: string
          enabled: boolean
          id: string
          max_benefit_value: number
          premium_enabled: boolean
          tenant_id: string
          updated_at: string
          validity_days: number
        }
        Insert: {
          appointments_required?: number
          benefit_description?: string
          benefit_type?: string
          benefit_value?: number
          created_at?: string
          enabled?: boolean
          id?: string
          max_benefit_value?: number
          premium_enabled?: boolean
          tenant_id: string
          updated_at?: string
          validity_days?: number
        }
        Update: {
          appointments_required?: number
          benefit_description?: string
          benefit_type?: string
          benefit_value?: number
          created_at?: string
          enabled?: boolean
          id?: string
          max_benefit_value?: number
          premium_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          barber_id: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          read: boolean | null
          read_at: string | null
          tenant_id: string | null
          title: string
          type: string | null
          unique_key: string | null
          user_id: string
        }
        Insert: {
          barber_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          read?: boolean | null
          read_at?: string | null
          tenant_id?: string | null
          title: string
          type?: string | null
          unique_key?: string | null
          user_id: string
        }
        Update: {
          barber_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          read?: boolean | null
          read_at?: string | null
          tenant_id?: string | null
          title?: string
          type?: string | null
          unique_key?: string | null
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
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      payment_gateway_logs: {
        Row: {
          created_at: string
          event: string
          gateway_id: string | null
          id: string
          message: string | null
          payload: Json | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event: string
          gateway_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          status: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event?: string
          gateway_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateway_logs_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          created_at: string
          credentials: Json
          environment: string
          id: string
          is_active: boolean
          is_primary: boolean
          last_event_at: string | null
          last_payment_at: string | null
          last_sync_at: string | null
          methods: Json
          name: string
          pix_settings: Json
          provider: string
          status: string
          status_message: string | null
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          credentials?: Json
          environment?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_event_at?: string | null
          last_payment_at?: string | null
          last_sync_at?: string | null
          methods?: Json
          name: string
          pix_settings?: Json
          provider: string
          status?: string
          status_message?: string | null
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          credentials?: Json
          environment?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_event_at?: string | null
          last_payment_at?: string | null
          last_sync_at?: string | null
          methods?: Json
          name?: string
          pix_settings?: Json
          provider?: string
          status?: string
          status_message?: string | null
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean | null
          allowed_modules: Json
          automation_limit: number | null
          created_at: string
          description: string | null
          features: Json
          id: string
          is_recommended: boolean
          limits: Json
          max_barbers: number | null
          name: string
          price_monthly: number
          price_yearly: number
          slug: string | null
          stripe_price_id_live: string | null
          stripe_price_id_test: string | null
          tier: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          allowed_modules?: Json
          automation_limit?: number | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_recommended?: boolean
          limits?: Json
          max_barbers?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          slug?: string | null
          stripe_price_id_live?: string | null
          stripe_price_id_test?: string | null
          tier?: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          allowed_modules?: Json
          automation_limit?: number | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_recommended?: boolean
          limits?: Json
          max_barbers?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          slug?: string | null
          stripe_price_id_live?: string | null
          stripe_price_id_test?: string | null
          tier?: number
          updated_at?: string
        }
        Relationships: []
      }
      privacy_consents: {
        Row: {
          accepted_at: string
          accepted_privacy: boolean
          accepted_terms: boolean
          allow_marketing: boolean
          allow_notifications: boolean
          created_at: string
          customer_id: string | null
          id: string
          ip: string | null
          source: string | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string
          accepted_privacy?: boolean
          accepted_terms?: boolean
          allow_marketing?: boolean
          allow_notifications?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          source?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string
          accepted_privacy?: boolean
          accepted_terms?: boolean
          allow_marketing?: boolean
          allow_notifications?: boolean
          created_at?: string
          customer_id?: string | null
          id?: string
          ip?: string | null
          source?: string | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
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
          {
            foreignKeyName: "product_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          avatar_url: string | null
          barber_can_cancel: boolean | null
          barber_can_reschedule: boolean | null
          barbers_range: string | null
          barbershop_logo_url: string | null
          blocked_at: string | null
          business_name: string | null
          cancellation_window_hours: number | null
          cashback_enabled: boolean
          cashback_expiration_days: number | null
          cashback_fixed_value: number | null
          cashback_minimum_amount: number | null
          cashback_percentage: number
          cashback_type: string | null
          commission_base: string
          created_at: string
          effective_plan: string | null
          email: string | null
          font_color: string | null
          font_family: string | null
          font_size: string | null
          free_service_threshold: number | null
          google_maps_url: string | null
          id: string
          logo_url: string | null
          loyalty_mode: string
          opening_date: string | null
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
          selected_plan: string | null
          slug: string | null
          social_links: Json
          status: string | null
          suspension_reason: string | null
          tenant_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          barber_can_cancel?: boolean | null
          barber_can_reschedule?: boolean | null
          barbers_range?: string | null
          barbershop_logo_url?: string | null
          blocked_at?: string | null
          business_name?: string | null
          cancellation_window_hours?: number | null
          cashback_enabled?: boolean
          cashback_expiration_days?: number | null
          cashback_fixed_value?: number | null
          cashback_minimum_amount?: number | null
          cashback_percentage?: number
          cashback_type?: string | null
          commission_base?: string
          created_at?: string
          effective_plan?: string | null
          email?: string | null
          font_color?: string | null
          font_family?: string | null
          font_size?: string | null
          free_service_threshold?: number | null
          google_maps_url?: string | null
          id: string
          logo_url?: string | null
          loyalty_mode?: string
          opening_date?: string | null
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
          selected_plan?: string | null
          slug?: string | null
          social_links?: Json
          status?: string | null
          suspension_reason?: string | null
          tenant_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          barber_can_cancel?: boolean | null
          barber_can_reschedule?: boolean | null
          barbers_range?: string | null
          barbershop_logo_url?: string | null
          blocked_at?: string | null
          business_name?: string | null
          cancellation_window_hours?: number | null
          cashback_enabled?: boolean
          cashback_expiration_days?: number | null
          cashback_fixed_value?: number | null
          cashback_minimum_amount?: number | null
          cashback_percentage?: number
          cashback_type?: string | null
          commission_base?: string
          created_at?: string
          effective_plan?: string | null
          email?: string | null
          font_color?: string | null
          font_family?: string | null
          font_size?: string | null
          free_service_threshold?: number | null
          google_maps_url?: string | null
          id?: string
          logo_url?: string | null
          loyalty_mode?: string
          opening_date?: string | null
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
          selected_plan?: string | null
          slug?: string | null
          social_links?: Json
          status?: string | null
          suspension_reason?: string | null
          tenant_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
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
      refund_audits: {
        Row: {
          changed_by_id: string | null
          changed_by_type: string
          changes: Json | null
          created_at: string | null
          id: string
          new_status: string
          old_status: string | null
          refund_id: string
          tenant_id: string
        }
        Insert: {
          changed_by_id?: string | null
          changed_by_type: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          new_status: string
          old_status?: string | null
          refund_id: string
          tenant_id: string
        }
        Update: {
          changed_by_id?: string | null
          changed_by_type?: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          new_status?: string
          old_status?: string | null
          refund_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_audits_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_audits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          appointment_id: string
          completed_at: string | null
          created_at: string
          customer_id: string
          holder_name: string | null
          id: string
          notes: string | null
          payment_id: string | null
          payment_method: string
          pix_key: string | null
          pix_type: string | null
          processed_at: string | null
          refund_method: string | null
          requested_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          appointment_id: string
          completed_at?: string | null
          created_at?: string
          customer_id: string
          holder_name?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          payment_method: string
          pix_key?: string | null
          pix_type?: string | null
          processed_at?: string | null
          refund_method?: string | null
          requested_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          appointment_id?: string
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          holder_name?: string | null
          id?: string
          notes?: string | null
          payment_id?: string | null
          payment_method?: string
          pix_key?: string | null
          pix_type?: string | null
          processed_at?: string | null
          refund_method?: string | null
          requested_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "refund_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_checkout_sessions: {
        Row: {
          created_at: string
          environment: string
          error_message: string | null
          id: string
          plan_key: string
          status: string
          stripe_checkout_session_id: string | null
          stripe_price_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment: string
          error_message?: string | null
          id?: string
          plan_key: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_price_id: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          error_message?: string | null
          id?: string
          plan_key?: string
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_price_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "service_ratings_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
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
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          name: string
          price: number
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          name: string
          price: number
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          name?: string
          price?: number
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_checks: {
        Row: {
          checked_at: string
          id: number
          latency_ms: number | null
          message: string | null
          service_id: string
          status: string
          success: boolean
        }
        Insert: {
          checked_at?: string
          id?: number
          latency_ms?: number | null
          message?: string | null
          service_id: string
          status: string
          success?: boolean
        }
        Update: {
          checked_at?: string
          id?: number
          latency_ms?: number | null
          message?: string | null
          service_id?: string
          status?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "status_checks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "status_services"
            referencedColumns: ["id"]
          },
        ]
      }
      status_incidents: {
        Row: {
          affected_services: string[]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          resolved_at: string | null
          severity: string
          started_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_services?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_services?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          started_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      status_maintenances: {
        Row: {
          affected_services: string[]
          created_at: string
          description: string | null
          id: string
          impact: string
          scheduled_end: string
          scheduled_start: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_services?: string[]
          created_at?: string
          description?: string | null
          id?: string
          impact?: string
          scheduled_end: string
          scheduled_start: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_services?: string[]
          created_at?: string
          description?: string | null
          id?: string
          impact?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      status_services: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          enabled: boolean
          id: string
          manual_status: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          manual_status?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          manual_status?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subprocessors: {
        Row: {
          active: boolean
          category: string
          country: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          privacy_url: string | null
          purpose: string
          sort_order: number
          updated_at: string
          website_url: string | null
        }
        Insert: {
          active?: boolean
          category: string
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          privacy_url?: string | null
          purpose: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          active?: boolean
          category?: string
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          privacy_url?: string | null
          purpose?: string
          sort_order?: number
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      subscription_card_scans: {
        Row: {
          customer_id: string | null
          id: string
          ip: string | null
          metadata: Json
          reason: string | null
          result: string
          scanned_at: string
          scanned_by: string | null
          subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          customer_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          reason?: string | null
          result: string
          scanned_at?: string
          scanned_by?: string | null
          subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          customer_id?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          reason?: string | null
          result?: string
          scanned_at?: string
          scanned_by?: string | null
          subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_card_scans_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount: number
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          customer_id: string
          discount_amount: number
          due_date: string
          external_ref: string | null
          id: string
          metadata: Json
          original_amount: number | null
          paid_at: string | null
          payment_method: string
          status: string
          subscription_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id: string
          discount_amount?: number
          due_date?: string
          external_ref?: string | null
          id?: string
          metadata?: Json
          original_amount?: number | null
          paid_at?: string | null
          payment_method?: string
          status?: string
          subscription_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string
          discount_amount?: number
          due_date?: string
          external_ref?: string | null
          id?: string
          metadata?: Json
          original_amount?: number | null
          paid_at?: string | null
          payment_method?: string
          status?: string
          subscription_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_loyalty_history: {
        Row: {
          created_at: string
          customer_id: string
          granted_at: string
          id: string
          notes: string | null
          notification_error: string | null
          notification_sent: boolean
          notification_sent_at: string | null
          redeemed_at: string | null
          reward_cycle: number
          reward_description: string | null
          reward_id: string
          status: string
          subscription_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          granted_at?: string
          id?: string
          notes?: string | null
          notification_error?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          redeemed_at?: string | null
          reward_cycle?: number
          reward_description?: string | null
          reward_id: string
          status?: string
          subscription_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          granted_at?: string
          id?: string
          notes?: string | null
          notification_error?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          redeemed_at?: string | null
          reward_cycle?: number
          reward_description?: string | null
          reward_id?: string
          status?: string
          subscription_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_loyalty_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_loyalty_history_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "subscription_loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_loyalty_history_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_loyalty_rewards: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          months_required: number
          reward_metadata: Json
          reward_type: string
          reward_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description: string
          id?: string
          months_required: number
          reward_metadata?: Json
          reward_type: string
          reward_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          months_required?: number
          reward_metadata?: Json
          reward_type?: string
          reward_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plan_benefit_services: {
        Row: {
          active: boolean
          benefit_id: string
          consume_quantity: number
          created_at: string
          id: string
          plan_id: string
          service_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefit_id: string
          consume_quantity?: number
          created_at?: string
          id?: string
          plan_id: string
          service_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefit_id?: string
          consume_quantity?: number
          created_at?: string
          id?: string
          plan_id?: string
          service_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_benefit_services_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "subscription_plan_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_benefit_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_benefit_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_benefits: {
        Row: {
          active: boolean
          benefit_key: string
          benefit_name: string
          created_at: string
          display_order: number
          id: string
          monthly_limit: number
          plan_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefit_key: string
          benefit_name: string
          created_at?: string
          display_order?: number
          id?: string
          monthly_limit: number
          plan_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefit_key?: string
          benefit_name?: string
          created_at?: string
          display_order?: number
          id?: string
          monthly_limit?: number
          plan_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_benefits_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_changes: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          credit_transaction_id: string | null
          customer_id: string
          days_in_cycle: number
          days_remaining: number
          effective_date: string
          id: string
          invoice_id: string | null
          net_amount: number
          new_plan_id: string | null
          new_price: number
          notes: string | null
          old_plan_id: string | null
          old_price: number
          proration_charge: number
          proration_credit: number
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          credit_transaction_id?: string | null
          customer_id: string
          days_in_cycle?: number
          days_remaining?: number
          effective_date?: string
          id?: string
          invoice_id?: string | null
          net_amount?: number
          new_plan_id?: string | null
          new_price?: number
          notes?: string | null
          old_plan_id?: string | null
          old_price?: number
          proration_charge?: number
          proration_credit?: number
          subscription_id: string
          tenant_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          credit_transaction_id?: string | null
          customer_id?: string
          days_in_cycle?: number
          days_remaining?: number
          effective_date?: string
          id?: string
          invoice_id?: string | null
          net_amount?: number
          new_plan_id?: string | null
          new_price?: number
          notes?: string | null
          old_plan_id?: string | null
          old_price?: number
          proration_charge?: number
          proration_credit?: number
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_changes_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_services: {
        Row: {
          created_at: string
          id: string
          max_uses_per_period: number | null
          plan_id: string
          service_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_uses_per_period?: number | null
          plan_id: string
          service_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_uses_per_period?: number | null
          plan_id?: string
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_services_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_plan_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          accumulates_premium_loyalty: boolean
          active: boolean
          agenda_priority: boolean
          allows_product_discount: boolean
          barber_commission_type: string
          barber_commission_value: number
          benefits: Json
          created_at: string
          description: string | null
          display_order: number
          exclusive_days: boolean
          exclusive_hours: boolean
          id: string
          included_benefits: Json
          max_uses_per_month: number | null
          monthly_price: number
          name: string
          participates_cashback: boolean
          participates_traditional_loyalty: boolean
          payment_methods: string[]
          plan_type: string
          preferential_service: boolean
          tenant_id: string
          updated_at: string
          usage_type: string
        }
        Insert: {
          accumulates_premium_loyalty?: boolean
          active?: boolean
          agenda_priority?: boolean
          allows_product_discount?: boolean
          barber_commission_type?: string
          barber_commission_value?: number
          benefits?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          exclusive_days?: boolean
          exclusive_hours?: boolean
          id?: string
          included_benefits?: Json
          max_uses_per_month?: number | null
          monthly_price: number
          name: string
          participates_cashback?: boolean
          participates_traditional_loyalty?: boolean
          payment_methods?: string[]
          plan_type?: string
          preferential_service?: boolean
          tenant_id: string
          updated_at?: string
          usage_type?: string
        }
        Update: {
          accumulates_premium_loyalty?: boolean
          active?: boolean
          agenda_priority?: boolean
          allows_product_discount?: boolean
          barber_commission_type?: string
          barber_commission_value?: number
          benefits?: Json
          created_at?: string
          description?: string | null
          display_order?: number
          exclusive_days?: boolean
          exclusive_hours?: boolean
          id?: string
          included_benefits?: Json
          max_uses_per_month?: number | null
          monthly_price?: number
          name?: string
          participates_cashback?: boolean
          participates_traditional_loyalty?: boolean
          payment_methods?: string[]
          plan_type?: string
          preferential_service?: boolean
          tenant_id?: string
          updated_at?: string
          usage_type?: string
        }
        Relationships: []
      }
      subscription_referrals: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          notes: string | null
          notification_sent: boolean
          notification_sent_at: string | null
          referral_code: string
          referred_customer_id: string
          referrer_customer_id: string
          referrer_subscription_id: string | null
          reward_description: string | null
          reward_granted: boolean
          reward_type: string
          reward_value: number
          status: string
          subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          referral_code: string
          referred_customer_id: string
          referrer_customer_id: string
          referrer_subscription_id?: string | null
          reward_description?: string | null
          reward_granted?: boolean
          reward_type?: string
          reward_value?: number
          status?: string
          subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          referral_code?: string
          referred_customer_id?: string
          referrer_customer_id?: string
          referrer_subscription_id?: string | null
          reward_description?: string | null
          reward_granted?: boolean
          reward_type?: string
          reward_value?: number
          status?: string
          subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_referrals_referred_customer_id_fkey"
            columns: ["referred_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_referrals_referrer_customer_id_fkey"
            columns: ["referrer_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_referrals_referrer_subscription_id_fkey"
            columns: ["referrer_subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_referrals_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_status_logs: {
        Row: {
          changed_at: string
          changed_by: string | null
          customer_id: string | null
          id: string
          metadata: Json
          new_status: string
          notes: string | null
          old_status: string | null
          pause_until: string | null
          reason: string | null
          subscription_id: string
          tenant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json
          new_status: string
          notes?: string | null
          old_status?: string | null
          pause_until?: string | null
          reason?: string | null
          subscription_id: string
          tenant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          customer_id?: string | null
          id?: string
          metadata?: Json
          new_status?: string
          notes?: string | null
          old_status?: string | null
          pause_until?: string | null
          reason?: string | null
          subscription_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_status_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_usage_logs: {
        Row: {
          appointment_id: string | null
          benefit_key: string | null
          benefit_type: string
          consume_quantity: number
          covered_amount: number
          created_at: string
          customer_id: string | null
          extra_amount: number
          id: string
          metadata: Json
          period_end: string | null
          period_start: string | null
          service_id: string | null
          status: string
          subscription_id: string
          subscription_plan_id: string | null
          tenant_id: string
          used_at: string
        }
        Insert: {
          appointment_id?: string | null
          benefit_key?: string | null
          benefit_type?: string
          consume_quantity?: number
          covered_amount?: number
          created_at?: string
          customer_id?: string | null
          extra_amount?: number
          id?: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          service_id?: string | null
          status?: string
          subscription_id: string
          subscription_plan_id?: string | null
          tenant_id: string
          used_at?: string
        }
        Update: {
          appointment_id?: string | null
          benefit_key?: string | null
          benefit_type?: string
          consume_quantity?: number
          covered_amount?: number
          created_at?: string
          customer_id?: string | null
          extra_amount?: number
          id?: string
          metadata?: Json
          period_end?: string | null
          period_start?: string | null
          service_id?: string | null
          status?: string
          subscription_id?: string
          subscription_plan_id?: string | null
          tenant_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_usage_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usage_logs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usage_logs_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "customer_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_usage_logs_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
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
      system_health_settings: {
        Row: {
          alert_emails: string[] | null
          created_at: string | null
          deduplication_minutes: number | null
          id: string
          notify_on_critical_error: boolean | null
          slack_webhook_url: string | null
          updated_at: string | null
        }
        Insert: {
          alert_emails?: string[] | null
          created_at?: string | null
          deduplication_minutes?: number | null
          id?: string
          notify_on_critical_error?: boolean | null
          slack_webhook_url?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_emails?: string[] | null
          created_at?: string | null
          deduplication_minutes?: number | null
          id?: string
          notify_on_critical_error?: boolean | null
          slack_webhook_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      tenant_integrations: {
        Row: {
          active: boolean
          created_at: string
          credentials: Json
          id: string
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credentials?: Json
          id?: string
          provider: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credentials?: Json
          id?: string
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenant_webhooks: {
        Row: {
          active: boolean
          created_at: string
          event: string
          id: string
          name: string
          secret: string | null
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          event?: string
          id?: string
          name: string
          secret?: string | null
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          event?: string
          id?: string
          name?: string
          secret?: string | null
          tenant_id?: string
          updated_at?: string
          url?: string
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
          adjusted_at: string | null
          adjusted_by: string | null
          adjustment_reason: string | null
          amount: number
          appointment_id: string | null
          barber_id: string | null
          cash_amount: number | null
          cashback_amount: number | null
          category: string | null
          created_at: string
          credit_card_amount: number | null
          credits_amount: number | null
          customer_id: string | null
          date: string | null
          debit_card_amount: number | null
          description: string | null
          id: string
          manual_adjustment: boolean | null
          payment_breakdown: Json | null
          payment_method: string | null
          pix_amount: number | null
          tenant_id: string | null
          time: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_reason?: string | null
          amount: number
          appointment_id?: string | null
          barber_id?: string | null
          cash_amount?: number | null
          cashback_amount?: number | null
          category?: string | null
          created_at?: string
          credit_card_amount?: number | null
          credits_amount?: number | null
          customer_id?: string | null
          date?: string | null
          debit_card_amount?: number | null
          description?: string | null
          id?: string
          manual_adjustment?: boolean | null
          payment_breakdown?: Json | null
          payment_method?: string | null
          pix_amount?: number | null
          tenant_id?: string | null
          time?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_reason?: string | null
          amount?: number
          appointment_id?: string | null
          barber_id?: string | null
          cash_amount?: number | null
          cashback_amount?: number | null
          category?: string | null
          created_at?: string
          credit_card_amount?: number | null
          credits_amount?: number | null
          customer_id?: string | null
          date?: string | null
          debit_card_amount?: number | null
          description?: string | null
          id?: string
          manual_adjustment?: boolean | null
          payment_breakdown?: Json | null
          payment_method?: string | null
          pix_amount?: number | null
          tenant_id?: string | null
          time?: string | null
          type?: string
          updated_at?: string | null
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
            foreignKeyName: "transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "transactions_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "wallet_transactions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
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
      whatsapp_conversations: {
        Row: {
          active: boolean | null
          appointment_group_id: string | null
          appointment_id: string | null
          barber_id: string | null
          context: Json | null
          created_at: string | null
          customer_id: string | null
          id: string
          last_action: string | null
          phone: string
          phone_fallback: string | null
          state: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          appointment_group_id?: string | null
          appointment_id?: string | null
          barber_id?: string | null
          context?: Json | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_action?: string | null
          phone: string
          phone_fallback?: string | null
          state: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          appointment_group_id?: string | null
          appointment_id?: string | null
          barber_id?: string | null
          context?: Json | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          last_action?: string | null
          phone?: string
          phone_fallback?: string | null
          state?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_delivery_logs: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          dispatch_id: string | null
          error_message: string | null
          id: string
          payload: Json | null
          response: Json | null
          retry_count: number | null
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          dispatch_id?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          response?: Json | null
          retry_count?: number | null
          status: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          dispatch_id?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          response?: Json | null
          retry_count?: number | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_delivery_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_delivery_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "vw_automation_debug"
            referencedColumns: ["appointment_id"]
          },
          {
            foreignKeyName: "whatsapp_delivery_logs_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "automation_v2_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          barber_id: string | null
          client_token: string | null
          connected: boolean | null
          created_at: string
          id: string
          instance_id: string
          phone: string | null
          provider: string
          server_url: string
          status: string
          tenant_id: string
          token: string
          updated_at: string
          webhook_received_configured_at: string | null
          webhook_received_last_response: Json | null
          webhook_received_url: string | null
          webhook_url: string | null
        }
        Insert: {
          barber_id?: string | null
          client_token?: string | null
          connected?: boolean | null
          created_at?: string
          id?: string
          instance_id: string
          phone?: string | null
          provider?: string
          server_url: string
          status?: string
          tenant_id: string
          token: string
          updated_at?: string
          webhook_received_configured_at?: string | null
          webhook_received_last_response?: Json | null
          webhook_received_url?: string | null
          webhook_url?: string | null
        }
        Update: {
          barber_id?: string | null
          client_token?: string | null
          connected?: boolean | null
          created_at?: string
          id?: string
          instance_id?: string
          phone?: string | null
          provider?: string
          server_url?: string
          status?: string
          tenant_id?: string
          token?: string
          updated_at?: string
          webhook_received_configured_at?: string | null
          webhook_received_last_response?: Json | null
          webhook_received_url?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_barbershop_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "whatsapp_instances"
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
      zapi_integration_logs: {
        Row: {
          action: string
          client_token_masked: string | null
          created_at: string
          endpoint: string | null
          error_message: string | null
          id: string
          instance_id: string | null
          method: string | null
          phone_number: string | null
          request_body: Json | null
          request_payload: Json | null
          response_body: Json | null
          response_payload: Json | null
          response_status: number | null
          status_code: number | null
          tenant_id: string | null
          token_masked: string | null
          webhook_url: string | null
        }
        Insert: {
          action: string
          client_token_masked?: string | null
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          method?: string | null
          phone_number?: string | null
          request_body?: Json | null
          request_payload?: Json | null
          response_body?: Json | null
          response_payload?: Json | null
          response_status?: number | null
          status_code?: number | null
          tenant_id?: string | null
          token_masked?: string | null
          webhook_url?: string | null
        }
        Update: {
          action?: string
          client_token_masked?: string | null
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          instance_id?: string | null
          method?: string | null
          phone_number?: string | null
          request_body?: Json | null
          request_payload?: Json | null
          response_body?: Json | null
          response_payload?: Json | null
          response_status?: number | null
          status_code?: number | null
          tenant_id?: string | null
          token_masked?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_integration_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_webhook_debug: {
        Row: {
          content_type: string | null
          headers_raw: Json | null
          id: string
          integration_id: string | null
          matched_conversation_id: string | null
          message_text: string | null
          method: string | null
          option_id: string | null
          path_params: Json | null
          payload_raw: Json | null
          phone_normalized: string | null
          phone_raw: string | null
          processed: boolean | null
          processing_error: string | null
          query_params: Json | null
          raw_body: string | null
          received_at: string | null
          source: string | null
          tenant_id: string | null
          url: string | null
        }
        Insert: {
          content_type?: string | null
          headers_raw?: Json | null
          id?: string
          integration_id?: string | null
          matched_conversation_id?: string | null
          message_text?: string | null
          method?: string | null
          option_id?: string | null
          path_params?: Json | null
          payload_raw?: Json | null
          phone_normalized?: string | null
          phone_raw?: string | null
          processed?: boolean | null
          processing_error?: string | null
          query_params?: Json | null
          raw_body?: string | null
          received_at?: string | null
          source?: string | null
          tenant_id?: string | null
          url?: string | null
        }
        Update: {
          content_type?: string | null
          headers_raw?: Json | null
          id?: string
          integration_id?: string | null
          matched_conversation_id?: string | null
          message_text?: string | null
          method?: string | null
          option_id?: string | null
          path_params?: Json | null
          payload_raw?: Json | null
          phone_normalized?: string | null
          phone_raw?: string | null
          processed?: boolean | null
          processing_error?: string | null
          query_params?: Json | null
          raw_body?: string | null
          received_at?: string | null
          source?: string | null
          tenant_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_webhook_debug_matched_conversation_id_fkey"
            columns: ["matched_conversation_id"]
            isOneToOne: false
            referencedRelation: "automation_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_webhook_debug_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_webhook_logs: {
        Row: {
          barber_id: string | null
          button_id: string | null
          created_at: string
          error: string | null
          event_type: string | null
          extracted_option: string | null
          extracted_phone: string | null
          flow_type: Database["public"]["Enums"]["automation_flow_type"] | null
          id: string
          ignored: boolean | null
          instance_id: string | null
          metadata: Json | null
          payload: Json
          phone: string | null
          phone_normalized_8: string | null
          phone_raw: string | null
          processed: boolean | null
          reference_message_id: string | null
          selected_option: string | null
          session_id: string | null
          status_code: number | null
          tenant_id: string | null
          type: string | null
        }
        Insert: {
          barber_id?: string | null
          button_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          extracted_option?: string | null
          extracted_phone?: string | null
          flow_type?: Database["public"]["Enums"]["automation_flow_type"] | null
          id?: string
          ignored?: boolean | null
          instance_id?: string | null
          metadata?: Json | null
          payload: Json
          phone?: string | null
          phone_normalized_8?: string | null
          phone_raw?: string | null
          processed?: boolean | null
          reference_message_id?: string | null
          selected_option?: string | null
          session_id?: string | null
          status_code?: number | null
          tenant_id?: string | null
          type?: string | null
        }
        Update: {
          barber_id?: string | null
          button_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string | null
          extracted_option?: string | null
          extracted_phone?: string | null
          flow_type?: Database["public"]["Enums"]["automation_flow_type"] | null
          id?: string
          ignored?: boolean | null
          instance_id?: string | null
          metadata?: Json | null
          payload?: Json
          phone?: string | null
          phone_normalized_8?: string | null
          phone_raw?: string | null
          processed?: boolean | null
          reference_message_id?: string | null
          selected_option?: string | null
          session_id?: string | null
          status_code?: number | null
          tenant_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_webhook_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      barber_rating_stats: {
        Row: {
          avg_rating: number | null
          barber_id: string | null
          tenant_id: string | null
          total_ratings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_automation_debug: {
        Row: {
          appointment_id: string | null
          confirmation_sent: boolean | null
          confirmation_sent_at: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          start_time: string | null
          status: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_commission_for_appointment: {
        Args: { p_appointment_id: string }
        Returns: undefined
      }
      calculate_next_retry: { Args: { attempts: number }; Returns: string }
      cancel_appointment: {
        Args: {
          p_appointment_id: string
          p_cancelled_by: string
          p_changed_by_id?: string
          p_refund_preference?: string
          p_source: string
        }
        Returns: Json
      }
      cancel_appointment_by_token: {
        Args: { token_val: string }
        Returns: boolean
      }
      change_subscription_plan: {
        Args: {
          p_apply_credit_to_wallet?: boolean
          p_new_plan_id: string
          p_notes?: string
          p_payment_method?: string
          p_subscription_id: string
        }
        Returns: Json
      }
      check_appointment_financial_status: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      check_expired_trials: { Args: never; Returns: undefined }
      check_subscription_eligibility: {
        Args: {
          p_customer_id: string
          p_service_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      cleanup_invalid_cashback: { Args: { p_tenant_id: string }; Returns: Json }
      clear_barbershop_financial_data: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      complete_appointment: {
        Args: {
          p_appointment_id: string
          p_changed_by_id?: string
          p_changed_by_type?: string
          p_metadata?: Json
          p_source?: string
        }
        Returns: Json
      }
      consume_subscription_benefit: {
        Args: {
          p_appointment_id: string
          p_covered_amount: number
          p_extra_amount: number
          p_service_id: string
          p_subscription_id: string
        }
        Returns: Json
      }
      consume_subscription_benefits_v2: {
        Args: {
          _appointment_id: string
          _service_id: string
          _subscription_id: string
        }
        Returns: Json
      }
      consume_subscription_use: {
        Args: { p_appointment_id?: string; p_subscription_id: string }
        Returns: Json
      }
      convert_appointment_to_credit: {
        Args: {
          p_amount: number
          p_appointment_id: string
          p_customer_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      create_admin_notification: {
        Args: {
          p_action_url?: string
          p_message?: string
          p_priority?: string
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_tenant_id?: string
          p_title: string
          p_type: string
          p_user_id?: string
        }
        Returns: string
      }
      create_barber_commission_for_appointment: {
        Args: { p_appointment_id: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_barber_id?: string
          p_customer_id?: string
          p_message: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      customer_cancel_request_refund: {
        Args: {
          p_appointment_id: string
          p_holder_name: string
          p_notes?: string
          p_pix_key: string
          p_pix_type: string
          p_source?: string
        }
        Returns: Json
      }
      customer_cancel_return_credit: {
        Args: { p_appointment_id: string; p_source?: string }
        Returns: Json
      }
      customer_cancel_simple: {
        Args: { p_appointment_id: string; p_source?: string }
        Returns: Json
      }
      decrement_product_stock: {
        Args: { amount: number; prod_id: string }
        Returns: undefined
      }
      enqueue_subscription_renewal_reminders: { Args: never; Returns: number }
      expire_loyalty_rewards: { Args: never; Returns: number }
      fn_get_financial_summary: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: Json
      }
      fn_recalculate_customer_loyalty: {
        Args: { p_customer_id: string }
        Returns: number
      }
      generate_subscription_referral_code: { Args: never; Returns: string }
      generate_unique_slug: { Args: { base_name: string }; Returns: string }
      get_active_subscription: {
        Args: { p_customer_id: string }
        Returns: {
          accumulates_premium_loyalty: boolean
          months_active: number
          participates_cashback: boolean
          participates_traditional_loyalty: boolean
          plan_id: string
          started_at: string
          subscription_id: string
          tenant_id: string
        }[]
      }
      get_allowed_modules: { Args: { _tenant: string }; Returns: Json }
      get_appointment_by_management_token: {
        Args: { p_token: string }
        Returns: {
          barber_id: string
          business_name: string
          cancel_token: string
          cancellation_window_hours: number
          customer_id: string
          customer_name: string
          end_time: string
          id: string
          management_token: string
          payment_status: string
          professional_id: string
          professional_name: string
          service_id: string
          service_name: string
          start_time: string
          status: string
          tenant_id: string
          total_price: number
        }[]
      }
      get_appointment_group_by_token: {
        Args: { p_token: string }
        Returns: {
          appointment_id: string
          appointment_status: string
          business_name: string
          business_phone: string
          customer_id: string
          customer_name: string
          end_time: string
          group_id: string
          group_sequence: number
          group_status: string
          management_token: string
          payment_status: string
          professional_id: string
          professional_name: string
          service_amount: number
          service_id: string
          service_name: string
          start_time: string
          tenant_id: string
          total_amount: number
        }[]
      }
      get_barber_appointments: { Args: { p_barber_id: string }; Returns: Json }
      get_barber_commission_summary: {
        Args: {
          p_barber_id: string
          p_end_date?: string
          p_start_date?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_barber_commissions: {
        Args: {
          p_barber_id: string
          p_end_date?: string
          p_start_date?: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: {
          appointment_date: string
          appointment_id: string
          commission_amount: number
          commission_fixed_amount: number
          commission_percentage: number
          commission_type: string
          created_at: string
          customer_id: string
          customer_name: string
          id: string
          paid_at: string
          paid_by: string
          service_amount: number
          service_id: string
          service_name: string
          status: string
        }[]
      }
      get_barber_dashboard_summary: {
        Args: {
          p_barber_id: string
          p_end_date?: string
          p_start_date?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_barber_pending_commissions: {
        Args: {
          p_barber_id: string
          p_end_date?: string
          p_start_date?: string
          p_tenant_id: string
        }
        Returns: {
          appointment_date: string
          appointment_id: string
          commission_amount: number
          created_at: string
          customer_id: string
          customer_name: string
          id: string
          service_amount: number
          service_id: string
          service_name: string
          status: string
        }[]
      }
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
      get_customers_with_birthday_today: {
        Args: { target_day: number; target_month: number }
        Returns: {
          birth_date: string
          id: string
          name: string
          phone: string
          tenant_id: string
        }[]
      }
      get_my_profile_role: { Args: never; Returns: string }
      get_my_tenant_id: { Args: never; Returns: string }
      get_or_create_automation: {
        Args: { p_name?: string; p_tenant_id: string; p_type: string }
        Returns: string
      }
      get_plan_slug_by_stripe_price: {
        Args: { _env: string; _price_id: string }
        Returns: string
      }
      get_server_info: { Args: never; Returns: Json }
      get_subscriber_months: {
        Args: { p_subscription_id: string }
        Returns: number
      }
      get_subscription_benefit_balance: {
        Args: { _subscription_id: string }
        Returns: {
          benefit_key: string
          benefit_name: string
          monthly_limit: number
          remaining: number
          used: number
        }[]
      }
      get_workflow_key_for_event: {
        Args: { p_event_name: string; p_flow_type?: string }
        Returns: string
      }
      grant_subscription_referral_reward: {
        Args: { p_referral_id: string }
        Returns: Json
      }
      grant_subscription_rewards: { Args: never; Returns: number }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_module: {
        Args: { _module_key: string; _tenant_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_coupon_usage: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      is_active_subscriber: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
      is_profile_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_super_admin_user: { Args: never; Returns: boolean }
      pause_customer_subscription: {
        Args: {
          p_notes?: string
          p_pause_until?: string
          p_reason?: string
          p_subscription_id: string
        }
        Returns: Json
      }
      pay_barber_commissions: {
        Args: {
          p_barber_id: string
          p_commission_ids: string[]
          p_paid_by?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      pay_commission_entries: {
        Args: {
          p_amount: number
          p_barber_id: string
          p_entry_ids: string[]
          p_notes?: string
        }
        Returns: Json
      }
      preview_subscription_plan_change: {
        Args: { p_new_plan_id: string; p_subscription_id: string }
        Returns: Json
      }
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
      process_subscription_loyalty_rewards:
        | { Args: never; Returns: Json }
        | {
            Args: { p_tenant_id: string }
            Returns: {
              granted_count: number
              reward_id: string
              subscription_id: string
            }[]
          }
      recalculate_barber_commissions: {
        Args: { p_from?: string; p_tenant_id: string; p_to?: string }
        Returns: number
      }
      recalculate_customer_cashback_balance: {
        Args: { p_customer_id: string }
        Returns: number
      }
      recalculate_customer_credit_balance: {
        Args: { p_customer_id: string }
        Returns: number
      }
      reconcile_automation_logs: { Args: never; Returns: undefined }
      redeem_loyalty_reward: {
        Args: {
          p_applied_cost?: number
          p_appointment_id: string
          p_reward_id: string
        }
        Returns: Json
      }
      redeem_subscription_reward: {
        Args: { p_history_id: string; p_notes?: string }
        Returns: {
          created_at: string
          customer_id: string
          granted_at: string
          id: string
          notes: string | null
          notification_error: string | null
          notification_sent: boolean
          notification_sent_at: string | null
          redeemed_at: string | null
          reward_cycle: number
          reward_description: string | null
          reward_id: string
          status: string
          subscription_id: string
          tenant_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscription_loyalty_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      regenerate_subscription_card_token: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      register_subscription_referral: {
        Args: {
          p_referral_code: string
          p_reward_description?: string
          p_reward_type?: string
          p_reward_value?: number
          p_subscription_id: string
        }
        Returns: Json
      }
      request_appointment_refund: {
        Args: {
          p_account_holder_name: string
          p_amount: number
          p_appointment_id: string
          p_customer_id: string
          p_notes?: string
          p_pix_key: string
          p_pix_key_type: string
          p_tenant_id: string
        }
        Returns: Json
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_changed_by_id?: string
          p_changed_by_type?: string
          p_metadata?: Json
          p_new_end_time: string
          p_new_start_time: string
          p_source?: string
        }
        Returns: Json
      }
      resume_customer_subscription: {
        Args: { p_subscription_id: string }
        Returns: Json
      }
      seed_default_workflows_v2: { Args: never; Returns: undefined }
      seed_subscription_automation_templates: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      seed_subscription_reward_unlocked_template: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      subscription_active_months: {
        Args: { p_subscription_id: string }
        Returns: number
      }
      sync_barbershop_modules: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      update_barber_working_hours: {
        Args: { p_barber_id: string; p_working_hours: Json }
        Returns: boolean
      }
      use_customer_credits: {
        Args: {
          p_amount: number
          p_appointment_id?: string
          p_customer_id: string
        }
        Returns: Json
      }
      validate_subscription_card: {
        Args: { p_log?: boolean; p_scanned_by?: string; p_token: string }
        Returns: Json
      }
      validate_subscription_coupon: {
        Args: { p_code: string; p_plan_price: number; p_tenant_id: string }
        Returns: Json
      }
      validate_subscription_referral_code: {
        Args: {
          p_code: string
          p_new_customer_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "tenant_admin" | "barber" | "client"
      automation_flow_type: "single" | "multi"
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
      automation_flow_type: ["single", "multi"],
      product_sale_status: ["completed", "cancelled", "refunded"],
    },
  },
} as const
