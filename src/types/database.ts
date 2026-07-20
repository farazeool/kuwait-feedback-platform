// Generated-style Supabase database contract derived from local migrations.
// Run `npm run db:types` against the official Docker-backed local stack to
// refresh this file once a container runtime is available.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type AppRole =
  | "platform_admin"
  | "organization_owner"
  | "organization_admin"
  | "location_manager"
  | "analyst";
type EntityStatus = "active" | "archived";
type SurveyStatus = "draft" | "active" | "archived";
type QuestionType = "rating" | "multiple_choice" | "text";
type LocaleCode = "en" | "ar";
type AlertStatus = "open" | "acknowledged" | "resolved";
type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "archived";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          preferred_locale: LocaleCode;
          platform_role: AppRole | null;
          status: EntityStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          preferred_locale?: LocaleCode;
          platform_role?: AppRole | null;
          status?: EntityStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          slug: string;
          name_en: string;
          name_ar: string;
          timezone: string;
          status: EntityStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name_en: string;
          name_ar: string;
          timezone?: string;
          status?: EntityStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          status: EntityStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          status?: EntityStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["organization_memberships"]["Insert"]
        >;
        Relationships: [];
      };
      locations: {
        Row: {
          id: string;
          organization_id: string;
          slug: string;
          name_en: string;
          name_ar: string;
          address_en: string | null;
          address_ar: string | null;
          timezone: string;
          status: EntityStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          slug: string;
          name_en: string;
          name_ar: string;
          address_en?: string | null;
          address_ar?: string | null;
          timezone?: string;
          status?: EntityStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["locations"]["Insert"]>;
        Relationships: [];
      };
      location_memberships: {
        Row: {
          id: string;
          location_id: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          status: EntityStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          location_id: string;
          organization_id: string;
          user_id: string;
          role: AppRole;
          status?: EntityStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["location_memberships"]["Insert"]
        >;
        Relationships: [];
      };
      surveys: {
        Row: {
          id: string;
          organization_id: string;
          location_id: string;
          public_slug: string;
          title_en: string;
          title_ar: string;
          description_en: string | null;
          description_ar: string | null;
          status: SurveyStatus;
          default_locale: LocaleCode;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          location_id: string;
          public_slug?: string;
          title_en: string;
          title_ar: string;
          description_en?: string | null;
          description_ar?: string | null;
          status?: SurveyStatus;
          default_locale?: LocaleCode;
          published_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["surveys"]["Insert"]>;
        Relationships: [];
      };
      survey_questions: {
        Row: {
          id: string;
          survey_id: string;
          organization_id: string;
          position: number;
          question_type: QuestionType;
          status: SurveyStatus;
          prompt_en: string;
          prompt_ar: string;
          is_required: boolean;
          rating_min: number | null;
          rating_max: number | null;
          allow_multiple: boolean;
          text_max_length: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          survey_id: string;
          organization_id: string;
          position: number;
          question_type: QuestionType;
          status?: SurveyStatus;
          prompt_en: string;
          prompt_ar: string;
          is_required?: boolean;
          rating_min?: number | null;
          rating_max?: number | null;
          allow_multiple?: boolean;
          text_max_length?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["survey_questions"]["Insert"]
        >;
        Relationships: [];
      };
      survey_question_options: {
        Row: {
          id: string;
          question_id: string;
          survey_id: string;
          organization_id: string;
          position: number;
          label_en: string;
          label_ar: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          survey_id: string;
          organization_id: string;
          position: number;
          label_en: string;
          label_ar: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["survey_question_options"]["Insert"]
        >;
        Relationships: [];
      };
      survey_responses: {
        Row: {
          id: string;
          survey_id: string;
          organization_id: string;
          location_id: string;
          locale: LocaleCode;
          overall_rating: number | null;
          idempotency_key: string | null;
          submitted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          survey_id: string;
          organization_id: string;
          location_id: string;
          locale: LocaleCode;
          overall_rating?: number | null;
          idempotency_key?: string | null;
          submitted_at?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["survey_responses"]["Insert"]
        >;
        Relationships: [];
      };
      survey_answers: {
        Row: {
          id: string;
          response_id: string;
          survey_id: string;
          organization_id: string;
          question_id: string;
          rating_value: number | null;
          text_value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          response_id: string;
          survey_id: string;
          organization_id: string;
          question_id: string;
          rating_value?: number | null;
          text_value?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["survey_answers"]["Insert"]
        >;
        Relationships: [];
      };
      survey_answer_choices: {
        Row: {
          answer_id: string;
          option_id: string;
          question_id: string;
          created_at: string;
        };
        Insert: {
          answer_id: string;
          option_id: string;
          question_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["survey_answer_choices"]["Insert"]
        >;
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          organization_id: string;
          location_id: string;
          response_id: string | null;
          alert_type: string;
          status: AlertStatus;
          rating_value: number | null;
          threshold_value: number | null;
          message: string | null;
          acknowledged_by: string | null;
          acknowledged_at: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          location_id: string;
          response_id?: string | null;
          alert_type: string;
          status?: AlertStatus;
          rating_value?: number | null;
          threshold_value?: number | null;
          message?: string | null;
          acknowledged_by?: string | null;
          acknowledged_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string | null;
          actor_id: string | null;
          actor_database_role: string;
          action: string;
          table_name: string;
          record_id: string | null;
          request_id: string | null;
          changed_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          actor_database_role?: string;
          action: string;
          table_name: string;
          record_id?: string | null;
          request_id?: string | null;
          changed_data?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["audit_logs"]["Insert"]
        >;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          organization_id: string;
          status: SubscriptionStatus;
          plan_code: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          trial_ends_at: string | null;
          current_period_starts_at: string | null;
          current_period_ends_at: string | null;
          canceled_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          status?: SubscriptionStatus;
          plan_code: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          trial_ends_at?: string | null;
          current_period_starts_at?: string | null;
          current_period_ends_at?: string | null;
          canceled_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscriptions"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_platform_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      organization_role: {
        Args: { p_organization_id: string };
        Returns: AppRole | null;
      };
      can_read_organization: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      can_manage_organization: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      can_access_location: {
        Args: { p_location_id: string };
        Returns: boolean;
      };
      can_manage_location: {
        Args: { p_location_id: string };
        Returns: boolean;
      };
      can_read_survey: {
        Args: { p_survey_id: string };
        Returns: boolean;
      };
      can_manage_survey: {
        Args: { p_survey_id: string };
        Returns: boolean;
      };
      can_access_response: {
        Args: { p_response_id: string };
        Returns: boolean;
      };
      can_manage_alert: {
        Args: { p_alert_id: string };
        Returns: boolean;
      };
      can_read_profile: {
        Args: { p_profile_id: string };
        Returns: boolean;
      };
      get_public_survey: {
        Args: { p_public_slug: string };
        Returns: Json;
      };
      submit_public_survey_response: {
        Args: {
          p_public_slug: string;
          p_locale: LocaleCode;
          p_answers: Json;
          p_idempotency_key?: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: AppRole;
      entity_status: EntityStatus;
      survey_status: SurveyStatus;
      question_type: QuestionType;
      locale_code: LocaleCode;
      alert_status: AlertStatus;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Row"];

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Insert"];

export type TablesUpdate<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Update"];

export type Enums<
  EnumName extends keyof Database["public"]["Enums"],
> = Database["public"]["Enums"][EnumName];
