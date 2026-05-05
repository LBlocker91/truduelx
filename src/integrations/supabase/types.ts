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
      battle_actions: {
        Row: {
          action_type: string
          actor_slot: number
          actor_user_id: string | null
          battle_id: string
          created_at: string
          id: string
          result: Json
          skill_slug: string | null
          target_slot: number | null
          turn_number: number
        }
        Insert: {
          action_type: string
          actor_slot: number
          actor_user_id?: string | null
          battle_id: string
          created_at?: string
          id?: string
          result?: Json
          skill_slug?: string | null
          target_slot?: number | null
          turn_number: number
        }
        Update: {
          action_type?: string
          actor_slot?: number
          actor_user_id?: string | null
          battle_id?: string
          created_at?: string
          id?: string
          result?: Json
          skill_slug?: string | null
          target_slot?: number | null
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "battle_actions_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battle_participants: {
        Row: {
          battle_id: string
          character_id: string | null
          cooldowns: Json
          energy: number
          hp: number
          id: string
          is_bot: boolean
          max_energy: number
          max_hp: number
          rage: number
          slot: number
          snapshot: Json
          status_effects: Json
          user_id: string | null
        }
        Insert: {
          battle_id: string
          character_id?: string | null
          cooldowns?: Json
          energy: number
          hp: number
          id?: string
          is_bot?: boolean
          max_energy: number
          max_hp: number
          rage?: number
          slot: number
          snapshot: Json
          status_effects?: Json
          user_id?: string | null
        }
        Update: {
          battle_id?: string
          character_id?: string | null
          cooldowns?: Json
          energy?: number
          hp?: number
          id?: string
          is_bot?: boolean
          max_energy?: number
          max_hp?: number
          rage?: number
          slot?: number
          snapshot?: Json
          status_effects?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_participants_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          created_at: string
          current_turn: string | null
          finished_at: string | null
          id: string
          mode: Database["public"]["Enums"]["battle_mode"]
          seed: number
          status: Database["public"]["Enums"]["battle_status"]
          turn_deadline: string | null
          turn_number: number
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          current_turn?: string | null
          finished_at?: string | null
          id?: string
          mode: Database["public"]["Enums"]["battle_mode"]
          seed?: number
          status?: Database["public"]["Enums"]["battle_status"]
          turn_deadline?: string | null
          turn_number?: number
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          current_turn?: string | null
          finished_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["battle_mode"]
          seed?: number
          status?: Database["public"]["Enums"]["battle_status"]
          turn_deadline?: string | null
          turn_number?: number
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: []
      }
      characters: {
        Row: {
          class: Database["public"]["Enums"]["character_class"]
          created_at: string
          dexterity: number
          id: string
          level: number
          name: string
          skill_levels: Json
          skill_points: number
          stat_points: number
          strength: number
          support: number
          technology: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          class: Database["public"]["Enums"]["character_class"]
          created_at?: string
          dexterity?: number
          id?: string
          level?: number
          name: string
          skill_levels?: Json
          skill_points?: number
          stat_points?: number
          strength?: number
          support?: number
          technology?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          class?: Database["public"]["Enums"]["character_class"]
          created_at?: string
          dexterity?: number
          id?: string
          level?: number
          name?: string
          skill_levels?: Json
          skill_points?: number
          stat_points?: number
          strength?: number
          support?: number
          technology?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      inventory: {
        Row: {
          acquired_at: string
          character_id: string
          equipped: boolean
          id: string
          item_id: string
        }
        Insert: {
          acquired_at?: string
          character_id: string
          equipped?: boolean
          id?: string
          item_id: string
        }
        Update: {
          acquired_at?: string
          character_id?: string
          equipped?: boolean
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          class_req: Database["public"]["Enums"]["character_class"] | null
          created_at: string
          defense: number
          description: string | null
          id: string
          level_req: number
          max_damage: number | null
          min_damage: number | null
          name: string
          rarity: Database["public"]["Enums"]["item_rarity"]
          slot: Database["public"]["Enums"]["item_slot"]
          stat_modifiers: Json
        }
        Insert: {
          class_req?: Database["public"]["Enums"]["character_class"] | null
          created_at?: string
          defense?: number
          description?: string | null
          id?: string
          level_req?: number
          max_damage?: number | null
          min_damage?: number | null
          name: string
          rarity?: Database["public"]["Enums"]["item_rarity"]
          slot: Database["public"]["Enums"]["item_slot"]
          stat_modifiers?: Json
        }
        Update: {
          class_req?: Database["public"]["Enums"]["character_class"] | null
          created_at?: string
          defense?: number
          description?: string | null
          id?: string
          level_req?: number
          max_damage?: number | null
          min_damage?: number | null
          name?: string
          rarity?: Database["public"]["Enums"]["item_rarity"]
          slot?: Database["public"]["Enums"]["item_slot"]
          stat_modifiers?: Json
        }
        Relationships: []
      }
      matchmaking_queue: {
        Row: {
          character_id: string
          id: string
          joined_at: string
          mmr: number
          user_id: string
        }
        Insert: {
          character_id: string
          id?: string
          joined_at?: string
          mmr?: number
          user_id: string
        }
        Update: {
          character_id?: string
          id?: string
          joined_at?: string
          mmr?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          elo_rating: number
          id: string
          is_anonymous: boolean
          losses: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          elo_rating?: number
          id?: string
          is_anonymous?: boolean
          losses?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          elo_rating?: number
          id?: string
          is_anonymous?: boolean
          losses?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      skills: {
        Row: {
          base_damage: number
          class: Database["public"]["Enums"]["character_class"]
          cooldown: number
          created_at: string
          description: string | null
          effect: Database["public"]["Enums"]["skill_effect"]
          effect_value: number
          energy_cost: number
          hits: number
          id: string
          max_level: number
          name: string
          scale_stat: Database["public"]["Enums"]["scale_stat"]
          slug: string
          type: Database["public"]["Enums"]["skill_type"]
          unlock_level: number
        }
        Insert: {
          base_damage?: number
          class: Database["public"]["Enums"]["character_class"]
          cooldown?: number
          created_at?: string
          description?: string | null
          effect?: Database["public"]["Enums"]["skill_effect"]
          effect_value?: number
          energy_cost?: number
          hits?: number
          id?: string
          max_level?: number
          name: string
          scale_stat?: Database["public"]["Enums"]["scale_stat"]
          slug: string
          type?: Database["public"]["Enums"]["skill_type"]
          unlock_level?: number
        }
        Update: {
          base_damage?: number
          class?: Database["public"]["Enums"]["character_class"]
          cooldown?: number
          created_at?: string
          description?: string | null
          effect?: Database["public"]["Enums"]["skill_effect"]
          effect_value?: number
          energy_cost?: number
          hits?: number
          id?: string
          max_level?: number
          name?: string
          scale_stat?: Database["public"]["Enums"]["scale_stat"]
          slug?: string
          type?: Database["public"]["Enums"]["skill_type"]
          unlock_level?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_battle_participant: {
        Args: { _battle_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      battle_mode: "pve" | "pvp"
      battle_status: "pending" | "active" | "finished" | "abandoned"
      character_class:
        | "mercenary"
        | "tech-mage"
        | "gunner"
        | "blademaster"
        | "tech-sentinel"
        | "tactician"
        | "shadow-operative"
        | "demolisher"
        | "cyber-warden"
      item_rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
      item_slot:
        | "weapon"
        | "armor"
        | "helmet"
        | "gloves"
        | "boots"
        | "accessory"
      scale_stat: "strength" | "dexterity" | "technology" | "support"
      skill_effect:
        | "none"
        | "stun"
        | "dot"
        | "energy_drain"
        | "buff_attack"
        | "debuff_defense"
        | "heal"
        | "energy_recovery"
        | "defense_buff"
        | "crit_buff"
        | "damage_absorb"
        | "damage_taken_increase"
        | "reflect"
        | "stat_buff_all"
        | "skill_disable"
        | "cooldown_increase"
        | "dodge"
        | "bonus_low_hp"
      skill_type: "physical" | "magical" | "special"
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
      battle_mode: ["pve", "pvp"],
      battle_status: ["pending", "active", "finished", "abandoned"],
      character_class: [
        "mercenary",
        "tech-mage",
        "gunner",
        "blademaster",
        "tech-sentinel",
        "tactician",
        "shadow-operative",
        "demolisher",
        "cyber-warden",
      ],
      item_rarity: ["common", "uncommon", "rare", "epic", "legendary"],
      item_slot: ["weapon", "armor", "helmet", "gloves", "boots", "accessory"],
      scale_stat: ["strength", "dexterity", "technology", "support"],
      skill_effect: [
        "none",
        "stun",
        "dot",
        "energy_drain",
        "buff_attack",
        "debuff_defense",
        "heal",
        "energy_recovery",
        "defense_buff",
        "crit_buff",
        "damage_absorb",
        "damage_taken_increase",
        "reflect",
        "stat_buff_all",
        "skill_disable",
        "cooldown_increase",
        "dodge",
        "bonus_low_hp",
      ],
      skill_type: ["physical", "magical", "special"],
    },
  },
} as const
