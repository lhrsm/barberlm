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
      appointments: {
        Row: {
          barber_id: string | null
          cancel_token: string | null
          created_at: string
          customer_id: string | null
          end_time: string
          id: string
          items: Json | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          service_id: string | null
          start_time: string
          status: string | null
          total_price: number | null
          user_id: string
        }
        Insert: {
          barber_id?: string | null
          cancel_token?: string | null
          created_at?: string
          customer_id?: string | null
          end_time: string
          id?: string
          items?: Json | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          service_id?: string | null
          start_time: string
          status?: string | null
          total_price?: number | null
          user_id: string
        }
        Update: {
          barber_id?: string | null
          cancel_token?: string | null
          created_at?: string
          customer_id?: string | null
          end_time?: string
          id?: string
          items?: Json | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
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
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_sales: {
        Row: {
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
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          stock_quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
          stock_quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          stock_quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          business_name: string | null
          cashback_enabled: boolean
          cashback_percentage: number
          created_at: string
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
          role: string | null
          scheduling_mode: string | null
          secondary_color: string | null
          slug: string | null
          updated_at: string
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          cashback_enabled?: boolean
          cashback_percentage?: number
          created_at?: string
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
          role?: string | null
          scheduling_mode?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          cashback_enabled?: boolean
          cashback_percentage?: number
          created_at?: string
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
          role?: string | null
          scheduling_mode?: string | null
          secondary_color?: string | null
          slug?: string | null
          updated_at?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
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
      whatsapp_instances: {
        Row: {
          api_key: string | null
          api_url: string | null
          connection_type: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          qrcode: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          connection_type?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          qrcode?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          connection_type?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          qrcode?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      is_profile_admin: { Args: { _user_id: string }; Returns: boolean }
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
      product_sale_status: ["completed", "cancelled", "refunded"],
    },
  },
} as const
