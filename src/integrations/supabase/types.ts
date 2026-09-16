export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      custom_departments: {
        Row: {
          badge_bg: string;
          badge_text: string;
          border_color: string;
          code: string;
          color: string;
          created_at: string;
          description: string;
          full_name: string;
          icon_name: string;
          id: string;
          name: string;
          shift: string | null;
          target_count: number;
          updated_at: string;
        };
        Insert: {
          badge_bg?: string;
          badge_text?: string;
          border_color?: string;
          code?: string;
          color?: string;
          created_at?: string;
          description?: string;
          full_name?: string;
          icon_name?: string;
          id: string;
          name: string;
          shift?: string | null;
          target_count?: number;
          updated_at?: string;
        };
        Update: {
          badge_bg?: string;
          badge_text?: string;
          border_color?: string;
          code?: string;
          color?: string;
          created_at?: string;
          description?: string;
          full_name?: string;
          icon_name?: string;
          id?: string;
          name?: string;
          shift?: string | null;
          target_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      move_history: {
        Row: {
          created_at: string;
          from_dept: string;
          id: string;
          machine_type: string;
          operator_id: string;
          operator_name: string;
          reason: string | null;
          shift: string | null;
          timestamp: string;
          to_dept: string;
        };
        Insert: {
          created_at?: string;
          from_dept: string;
          id: string;
          machine_type?: string;
          operator_id: string;
          operator_name: string;
          reason?: string | null;
          shift?: string | null;
          timestamp?: string;
          to_dept: string;
        };
        Update: {
          created_at?: string;
          from_dept?: string;
          id?: string;
          machine_type?: string;
          operator_id?: string;
          operator_name?: string;
          reason?: string | null;
          shift?: string | null;
          timestamp?: string;
          to_dept?: string;
        };
        Relationships: [];
      };
      operators: {
        Row: {
          absence_reason: string | null;
          created_at: string;
          department_id: string;
          id: string;
          is_vna_only: boolean;
          last_moved_at: string;
          machine_type: string;
          name: string;
          notes: string | null;
          shift: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          absence_reason?: string | null;
          created_at?: string;
          department_id?: string;
          id: string;
          is_vna_only?: boolean;
          last_moved_at?: string;
          machine_type?: string;
          name: string;
          notes?: string | null;
          shift?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          absence_reason?: string | null;
          created_at?: string;
          department_id?: string;
          id?: string;
          is_vna_only?: boolean;
          last_moved_at?: string;
          machine_type?: string;
          name?: string;
          notes?: string | null;
          shift?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shift_templates: {
        Row: {
          active_count: number;
          assignments: Json;
          created_at: string;
          description: string | null;
          id: string;
          is_built_in: boolean;
          name: string;
          operator_count: number;
          shift: string | null;
          updated_at: string;
        };
        Insert: {
          active_count?: number;
          assignments?: Json;
          created_at?: string;
          description?: string | null;
          id: string;
          is_built_in?: boolean;
          name: string;
          operator_count?: number;
          shift?: string | null;
          updated_at?: string;
        };
        Update: {
          active_count?: number;
          assignments?: Json;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_built_in?: boolean;
          name?: string;
          operator_count?: number;
          shift?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
