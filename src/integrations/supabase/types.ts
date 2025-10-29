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
      admin_actions: {
        Row: {
          action_type: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_user_id: string
        }
        Insert: {
          action_type: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id: string
        }
        Update: {
          action_type?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_user_id?: string
        }
        Relationships: []
      }
      admin_whitelist: {
        Row: {
          added_at: string | null
          added_by: string | null
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          email?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      lead_qualification: {
        Row: {
          city: string
          company_employees: string | null
          company_revenue: string | null
          created_at: string | null
          id: string
          lead_score: number | null
          notes: string | null
          profession: string
          qualified_at: string | null
          updated_at: string | null
          user_id: string
          whatsapp: string
        }
        Insert: {
          city: string
          company_employees?: string | null
          company_revenue?: string | null
          created_at?: string | null
          id?: string
          lead_score?: number | null
          notes?: string | null
          profession: string
          qualified_at?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp: string
        }
        Update: {
          city?: string
          company_employees?: string | null
          company_revenue?: string | null
          created_at?: string | null
          id?: string
          lead_score?: number | null
          notes?: string | null
          profession?: string
          qualified_at?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string
        }
        Relationships: []
      }
      manual_summary_logs: {
        Row: {
          generated_at: string | null
          id: string
          subscription_plan: string | null
          user_id: string
        }
        Insert: {
          generated_at?: string | null
          id?: string
          subscription_plan?: string | null
          user_id: string
        }
        Update: {
          generated_at?: string | null
          id?: string
          subscription_plan?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_summary_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_analytics: {
        Row: {
          created_at: string | null
          date: string
          group_id: string
          group_name: string
          id: string
          message_count: number
          peak_hours: number[] | null
          sentiment: string | null
          top_topics: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          group_id: string
          group_name: string
          id?: string
          message_count: number
          peak_hours?: number[] | null
          sentiment?: string | null
          top_topics?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          group_id?: string
          group_name?: string
          id?: string
          message_count?: number
          peak_hours?: number[] | null
          sentiment?: string | null
          top_topics?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          connection_mode: string
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          last_seen_at: string | null
          manual_groups_limit: number | null
          manual_subscription: boolean | null
          preferred_summary_time: string | null
          selected_groups_count: number | null
          send_summary_to_group: boolean | null
          stripe_customer_id: string | null
          stripe_product_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_plan: string | null
          subscription_status: string | null
          total_summaries_generated: number | null
          updated_at: string | null
          whatsapp_connected: boolean | null
          whatsapp_instance_id: string | null
        }
        Insert: {
          connection_mode?: string
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          manual_groups_limit?: number | null
          manual_subscription?: boolean | null
          preferred_summary_time?: string | null
          selected_groups_count?: number | null
          send_summary_to_group?: boolean | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          total_summaries_generated?: number | null
          updated_at?: string | null
          whatsapp_connected?: boolean | null
          whatsapp_instance_id?: string | null
        }
        Update: {
          connection_mode?: string
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          manual_groups_limit?: number | null
          manual_subscription?: boolean | null
          preferred_summary_time?: string | null
          selected_groups_count?: number | null
          send_summary_to_group?: boolean | null
          stripe_customer_id?: string | null
          stripe_product_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          total_summaries_generated?: number | null
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
      security_audit_logs: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
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
      summary_preferences: {
        Row: {
          created_at: string | null
          enable_smart_alerts: boolean | null
          enterprise_detail_level: string | null
          id: string
          include_sentiment_analysis: boolean | null
          size: string | null
          thematic_focus: string | null
          timezone: string | null
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enable_smart_alerts?: boolean | null
          enterprise_detail_level?: string | null
          id?: string
          include_sentiment_analysis?: boolean | null
          size?: string | null
          thematic_focus?: string | null
          timezone?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enable_smart_alerts?: boolean | null
          enterprise_detail_level?: string | null
          id?: string
          include_sentiment_analysis?: boolean | null
          size?: string | null
          thematic_focus?: string | null
          timezone?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "summary_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          connected_at: string | null
          connection_type: string
          created_at: string | null
          id: string
          instance_id: string
          instance_name: string
          last_connected_at: string | null
          phone_number: string | null
          qr_code: string | null
          qr_code_expires_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          connection_type?: string
          created_at?: string | null
          id?: string
          instance_id: string
          instance_name: string
          last_connected_at?: string | null
          phone_number?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          connection_type?: string
          created_at?: string | null
          id?: string
          instance_id?: string
          instance_name?: string
          last_connected_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      trigger_daily_summaries_manually: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
