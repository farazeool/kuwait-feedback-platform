export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          id: string
          location_id: string
          message: string | null
          organization_id: string
          rating_value: number | null
          resolved_at: string | null
          response_id: string | null
          status: Database["public"]["Enums"]["alert_status"]
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          id?: string
          location_id: string
          message?: string | null
          organization_id: string
          rating_value?: number | null
          resolved_at?: string | null
          response_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          location_id?: string
          message?: string | null
          organization_id?: string
          rating_value?: number | null
          resolved_at?: string | null
          response_id?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_location_organization_fkey"
            columns: ["location_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_database_role: string
          actor_id: string | null
          changed_data: Json
          created_at: string
          id: string
          organization_id: string | null
          record_id: string | null
          request_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_database_role?: string
          actor_id?: string | null
          changed_data?: Json
          created_at?: string
          id?: string
          organization_id?: string | null
          record_id?: string | null
          request_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_database_role?: string
          actor_id?: string | null
          changed_data?: Json
          created_at?: string
          id?: string
          organization_id?: string | null
          record_id?: string | null
          request_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_memberships_location_organization_fkey"
            columns: ["location_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      locations: {
        Row: {
          address_ar: string | null
          address_en: string | null
          area: string
          created_at: string
          created_by: string | null
          governorate: string
          id: string
          name_ar: string
          name_en: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          area?: string
          created_at?: string
          created_by?: string | null
          governorate?: string
          id?: string
          name_ar: string
          name_en: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          area?: string
          created_at?: string
          created_by?: string | null
          governorate?: string
          id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitation_locations: {
        Row: {
          created_at: string
          invitation_id: string
          location_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          invitation_id: string
          location_id: string
          organization_id: string
        }
        Update: {
          created_at?: string
          invitation_id?: string
          location_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitation_locations_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "organization_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitation_locations_scope_fkey"
            columns: ["location_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["membership_scope"]
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          organization_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["membership_scope"]
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["membership_scope"]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["membership_scope"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["membership_scope"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["membership_scope"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_category: string
          created_at: string
          created_by: string | null
          id: string
          name_ar: string
          name_en: string
          phone: string | null
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          business_category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar: string
          name_en: string
          phone?: string | null
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          business_category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          phone?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          platform_role: Database["public"]["Enums"]["app_role"] | null
          preferred_locale: Database["public"]["Enums"]["locale_code"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          platform_role?: Database["public"]["Enums"]["app_role"] | null
          preferred_locale?: Database["public"]["Enums"]["locale_code"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          platform_role?: Database["public"]["Enums"]["app_role"] | null
          preferred_locale?: Database["public"]["Enums"]["locale_code"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      public_submission_rate_limits: {
        Row: {
          created_at: string
          expires_at: string
          fingerprint_hash: string
          request_count: number
          survey_id: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          fingerprint_hash: string
          request_count?: number
          survey_id: string
          updated_at?: string
          window_started_at: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          fingerprint_hash?: string
          request_count?: number
          survey_id?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_submission_rate_limits_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          id: string
          metadata: Json
          organization_id: string
          plan_code: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          plan_code: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          plan_code?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_answer_choices: {
        Row: {
          answer_id: string
          created_at: string
          option_id: string
          question_id: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          option_id: string
          question_id: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          option_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answer_choices_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "survey_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_answer_choices_option_question_fkey"
            columns: ["option_id", "question_id"]
            isOneToOne: false
            referencedRelation: "survey_question_options"
            referencedColumns: ["id", "question_id"]
          },
        ]
      }
      survey_answers: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          question_id: string
          rating_value: number | null
          response_id: string
          survey_id: string
          text_value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          question_id: string
          rating_value?: number | null
          response_id: string
          survey_id: string
          text_value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          question_id?: string
          rating_value?: number | null
          response_id?: string
          survey_id?: string
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_question_survey_fkey"
            columns: ["question_id", "survey_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id", "survey_id"]
          },
          {
            foreignKeyName: "survey_answers_response_scope_fkey"
            columns: ["response_id", "survey_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id", "survey_id", "organization_id"]
          },
        ]
      }
      survey_question_options: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label_ar: string
          label_en: string
          organization_id: string
          position: number
          question_id: string
          survey_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar: string
          label_en: string
          organization_id: string
          position: number
          question_id: string
          survey_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label_ar?: string
          label_en?: string
          organization_id?: string
          position?: number
          question_id?: string
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_question_options_question_survey_fkey"
            columns: ["question_id", "survey_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id", "survey_id"]
          },
          {
            foreignKeyName: "survey_question_options_survey_organization_fkey"
            columns: ["survey_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          allow_multiple: boolean
          created_at: string
          help_text_ar: string | null
          help_text_en: string | null
          id: string
          is_required: boolean
          organization_id: string
          position: number
          prompt_ar: string
          prompt_en: string
          question_type: Database["public"]["Enums"]["question_type"]
          rating_max: number | null
          rating_min: number | null
          status: Database["public"]["Enums"]["survey_status"]
          survey_id: string
          text_max_length: number | null
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          created_at?: string
          help_text_ar?: string | null
          help_text_en?: string | null
          id?: string
          is_required?: boolean
          organization_id: string
          position: number
          prompt_ar: string
          prompt_en: string
          question_type: Database["public"]["Enums"]["question_type"]
          rating_max?: number | null
          rating_min?: number | null
          status?: Database["public"]["Enums"]["survey_status"]
          survey_id: string
          text_max_length?: number | null
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          created_at?: string
          help_text_ar?: string | null
          help_text_en?: string | null
          id?: string
          is_required?: boolean
          organization_id?: string
          position?: number
          prompt_ar?: string
          prompt_en?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          rating_max?: number | null
          rating_min?: number | null
          status?: Database["public"]["Enums"]["survey_status"]
          survey_id?: string
          text_max_length?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_organization_fkey"
            columns: ["survey_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string | null
          locale: Database["public"]["Enums"]["locale_code"]
          location_id: string
          organization_id: string
          overall_rating: number | null
          submitted_at: string
          survey_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          locale: Database["public"]["Enums"]["locale_code"]
          location_id: string
          organization_id: string
          overall_rating?: number | null
          submitted_at?: string
          survey_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          location_id?: string
          organization_id?: string
          overall_rating?: number | null
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_scope_fkey"
            columns: ["survey_id", "organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id", "organization_id", "location_id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          created_by: string | null
          default_locale: Database["public"]["Enums"]["locale_code"]
          description_ar: string | null
          description_en: string | null
          id: string
          location_id: string
          organization_id: string
          public_slug: string
          published_at: string | null
          status: Database["public"]["Enums"]["survey_status"]
          survey_group_id: string
          thank_you_ar: string | null
          thank_you_en: string | null
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_locale?: Database["public"]["Enums"]["locale_code"]
          description_ar?: string | null
          description_en?: string | null
          id?: string
          location_id: string
          organization_id: string
          public_slug?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["survey_status"]
          survey_group_id?: string
          thank_you_ar?: string | null
          thank_you_en?: string | null
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_locale?: Database["public"]["Enums"]["locale_code"]
          description_ar?: string | null
          description_en?: string | null
          id?: string
          location_id?: string
          organization_id?: string
          public_slug?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["survey_status"]
          survey_group_id?: string
          thank_you_ar?: string | null
          thank_you_en?: string | null
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_location_organization_fkey"
            columns: ["location_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      can_access_location: { Args: { p_location_id: string }; Returns: boolean }
      can_access_response: { Args: { p_response_id: string }; Returns: boolean }
      can_manage_alert: { Args: { p_alert_id: string }; Returns: boolean }
      can_manage_location: { Args: { p_location_id: string }; Returns: boolean }
      can_manage_organization: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      can_manage_survey: { Args: { p_survey_id: string }; Returns: boolean }
      can_read_organization: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      can_read_profile: { Args: { p_profile_id: string }; Returns: boolean }
      can_read_survey: { Args: { p_survey_id: string }; Returns: boolean }
      consume_public_submission_rate_limit: {
        Args: {
          p_fingerprint_hash: string
          p_limit?: number
          p_public_slug: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      create_organization_with_first_location: {
        Args: {
          p_address: string
          p_area: string
          p_business_category: string
          p_governorate: string
          p_location_name_ar: string
          p_location_name_en: string
          p_location_slug: string
          p_name_ar: string
          p_name_en: string
          p_phone: string
          p_slug: string
          p_timezone?: string
        }
        Returns: {
          location_id: string
          organization_id: string
        }[]
      }
      duplicate_survey_group: { Args: { p_survey_id: string }; Returns: string }
      get_public_survey: { Args: { p_public_slug: string }; Returns: Json }
      is_platform_admin: { Args: never; Returns: boolean }
      organization_role: {
        Args: { p_organization_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      prepare_organization_invitation: {
        Args: {
          p_email: string
          p_expires_in?: string
          p_location_ids?: string[]
          p_organization_id: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          expires_at: string
          invitation_id: string
          invitation_token: string
        }[]
      }
      revoke_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      save_survey_draft: {
        Args: {
          p_default_locale: Database["public"]["Enums"]["locale_code"]
          p_description_ar: string
          p_description_en: string
          p_location_ids: string[]
          p_organization_id: string
          p_questions: Json
          p_survey_id: string
          p_thank_you_ar: string
          p_thank_you_en: string
          p_title_ar: string
          p_title_en: string
        }
        Returns: string
      }
      submit_protected_survey_response: {
        Args: {
          p_answers: Json
          p_fingerprint_hash: string
          p_idempotency_key: string
          p_locale: Database["public"]["Enums"]["locale_code"]
          p_public_slug: string
        }
        Returns: Json
      }
      submit_public_survey_response: {
        Args: {
          p_answers: Json
          p_idempotency_key?: string
          p_locale: Database["public"]["Enums"]["locale_code"]
          p_public_slug: string
        }
        Returns: string
      }
      transition_survey_group: {
        Args: {
          p_status: Database["public"]["Enums"]["survey_status"]
          p_survey_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      alert_status: "open" | "acknowledged" | "resolved"
      app_role:
        | "platform_admin"
        | "organization_owner"
        | "organization_admin"
        | "location_manager"
        | "analyst"
      entity_status: "active" | "archived"
      locale_code: "en" | "ar"
      membership_scope: "organization" | "locations"
      question_type: "rating" | "multiple_choice" | "text"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "archived"
      survey_status: "draft" | "active" | "archived"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      alert_status: ["open", "acknowledged", "resolved"],
      app_role: [
        "platform_admin",
        "organization_owner",
        "organization_admin",
        "location_manager",
        "analyst",
      ],
      entity_status: ["active", "archived"],
      locale_code: ["en", "ar"],
      membership_scope: ["organization", "locations"],
      question_type: ["rating", "multiple_choice", "text"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "archived",
      ],
      survey_status: ["draft", "active", "archived"],
    },
  },
} as const
