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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          preferred_summary_time: string | null
          selected_groups_count: number | null
          send_summary_to_group: boolean | null
          stripe_customer_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_plan: string | null
          subscription_status: string | null
          updated_at: string | null
          whatsapp_connected: boolean | null
          whatsapp_instance_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          preferred_summary_time?: string | null
          selected_groups_count?: number | null
          send_summary_to_group?: boolean | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          whatsapp_connected?: boolean | null
          whatsapp_instance_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          preferred_summary_time?: string | null
          selected_groups_count?: number | null
          send_summary_to_group?: boolean | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          whatsapp_connected?: boolean | null
          whatsapp_instance_id?: string | null
        }
        Relationships: []
      }
      scheduled_executions: {
        Row: {
          created_at: string | null
          details: Json | null
          errors_count: number | null
          execution_time: string | null
          id: string
          status: string
          summaries_generated: number | null
          users_processed: number | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          errors_count?: number | null
          execution_time?: string | null
          id?: string
          status: string
          summaries_generated?: number | null
          users_processed?: number | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          errors_count?: number | null
          execution_time?: string | null
          id?: string
          status?: string
          summaries_generated?: number | null
          users_processed?: number | null
        }
        Relationships: []
      }
      summaries: {
        Row: {
          created_at: string | null
          group_id: string
          group_name: string
          id: string
          message_count: number | null
          summary_date: string
          summary_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          group_name: string
          id?: string
          message_count?: number | null
          summary_date?: string
          summary_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          group_name?: string
          id?: string
          message_count?: number | null
          summary_date?: string
          summary_text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      summary_deliveries: {
        Row: {
          created_at: string | null
          error_message: string | null
          evolution_message_id: string | null
          group_id: string
          id: string
          sent_at: string | null
          status: string
          summary_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          evolution_message_id?: string | null
          group_id: string
          id?: string
          sent_at?: string | null
          status?: string
          summary_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          evolution_message_id?: string | null
          group_id?: string
          id?: string
          sent_at?: string | null
          status?: string
          summary_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summary_deliveries_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          connected_at: string | null
          created_at: string | null
          id: string
          instance_id: string
          instance_name: string
          phone_number: string | null
          qr_code: string | null
          qr_code_expires_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_id: string
          instance_name: string
          phone_number?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string
          instance_name?: string
          phone_number?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          created_at: string | null
          group_id: string
          group_image: string | null
          group_name: string
          id: string
          is_selected: boolean | null
          participant_count: number | null
          updated_at: string | null
          user_id: string
          whatsapp_connection_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          group_image?: string | null
          group_name: string
          id?: string
          is_selected?: boolean | null
          participant_count?: number | null
          updated_at?: string | null
          user_id: string
          whatsapp_connection_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          group_image?: string | null
          group_name?: string
          id?: string
          is_selected?: boolean | null
          participant_count?: number | null
          updated_at?: string | null
          user_id?: string
          whatsapp_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      trigger_daily_summaries_manually: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
