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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          message: string
          strategy: string
          symbol: string | null
        }
        Insert: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          strategy?: string
          symbol?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          strategy?: string
          symbol?: string | null
        }
        Relationships: []
      }
      agent_status: {
        Row: {
          created_at: string
          errors_count: number
          id: string
          is_running: boolean
          last_cycle_at: string | null
          last_heartbeat: string
          total_cycles: number
        }
        Insert: {
          created_at?: string
          errors_count?: number
          id?: string
          is_running?: boolean
          last_cycle_at?: string | null
          last_heartbeat?: string
          total_cycles?: number
        }
        Update: {
          created_at?: string
          errors_count?: number
          id?: string
          is_running?: boolean
          last_cycle_at?: string | null
          last_heartbeat?: string
          total_cycles?: number
        }
        Relationships: []
      }
      ai_trades: {
        Row: {
          ai_confidence: number | null
          ai_reason: string | null
          close_price: number | null
          closed_at: string | null
          id: string
          opened_at: string
          pnl: number | null
          price: number
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_reason?: string | null
          close_price?: number | null
          closed_at?: string | null
          id?: string
          opened_at?: string
          pnl?: number | null
          price: number
          quantity: number
          side: string
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_reason?: string | null
          close_price?: number | null
          closed_at?: string | null
          id?: string
          opened_at?: string
          pnl?: number | null
          price?: number
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
        }
        Relationships: []
      }
      ai_wallet: {
        Row: {
          balance: number
          created_at: string
          id: string
          initial_balance: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      quant_trades: {
        Row: {
          ai_confidence: number | null
          ai_reason: string | null
          close_price: number | null
          closed_at: string | null
          entry_score: number | null
          id: string
          opened_at: string
          partial_exits: Json | null
          peak_price: number | null
          pnl: number | null
          price: number
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          trailing_stop: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_reason?: string | null
          close_price?: number | null
          closed_at?: string | null
          entry_score?: number | null
          id?: string
          opened_at?: string
          partial_exits?: Json | null
          peak_price?: number | null
          pnl?: number | null
          price: number
          quantity: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          trailing_stop?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_reason?: string | null
          close_price?: number | null
          closed_at?: string | null
          entry_score?: number | null
          id?: string
          opened_at?: string
          partial_exits?: Json | null
          peak_price?: number | null
          pnl?: number | null
          price?: number
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          trailing_stop?: number | null
        }
        Relationships: []
      }
      quant_wallet: {
        Row: {
          balance: number
          created_at: string
          id: string
          initial_balance: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      scalping_trades: {
        Row: {
          ai_confidence: number | null
          ai_reason: string | null
          close_price: number | null
          closed_at: string | null
          entry_score: number | null
          id: string
          opened_at: string
          partial_exits: Json | null
          peak_price: number | null
          pnl: number | null
          price: number
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          time_limit_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_reason?: string | null
          close_price?: number | null
          closed_at?: string | null
          entry_score?: number | null
          id?: string
          opened_at?: string
          partial_exits?: Json | null
          peak_price?: number | null
          pnl?: number | null
          price: number
          quantity: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          time_limit_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_reason?: string | null
          close_price?: number | null
          closed_at?: string | null
          entry_score?: number | null
          id?: string
          opened_at?: string
          partial_exits?: Json | null
          peak_price?: number | null
          pnl?: number | null
          price?: number
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          time_limit_at?: string | null
        }
        Relationships: []
      }
      scalping_wallet: {
        Row: {
          balance: number
          created_at: string
          id: string
          initial_balance: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      unified_trades: {
        Row: {
          ai_confidence: number | null
          ai_reason: string | null
          cap_type: string
          close_price: number | null
          closed_at: string | null
          entry_score: number | null
          id: string
          opened_at: string
          partial_exits: Json | null
          peak_price: number | null
          pnl: number | null
          price: number
          quantity: number
          side: string
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          trailing_stop: number | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_reason?: string | null
          cap_type?: string
          close_price?: number | null
          closed_at?: string | null
          entry_score?: number | null
          id?: string
          opened_at?: string
          partial_exits?: Json | null
          peak_price?: number | null
          pnl?: number | null
          price: number
          quantity: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit?: number | null
          trailing_stop?: number | null
        }
        Update: {
          ai_confidence?: number | null
          ai_reason?: string | null
          cap_type?: string
          close_price?: number | null
          closed_at?: string | null
          entry_score?: number | null
          id?: string
          opened_at?: string
          partial_exits?: Json | null
          peak_price?: number | null
          pnl?: number | null
          price?: number
          quantity?: number
          side?: string
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          trailing_stop?: number | null
        }
        Relationships: []
      }
      unified_wallet: {
        Row: {
          balance: number
          created_at: string
          id: string
          initial_balance: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          initial_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_scalping_trades: { Args: never; Returns: undefined }
      cleanup_old_unified_trades: { Args: never; Returns: undefined }
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
