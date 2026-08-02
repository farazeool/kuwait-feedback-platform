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
      alert_configurations: {
        Row: {
          comparison_window_days: number
          created_at: string
          deduplication_minutes: number
          evaluation_window_hours: number
          id: string
          is_active: boolean
          location_id: string | null
          minimum_sample_count: number
          organization_id: string
          rule_type: Database["public"]["Enums"]["alert_rule_type"]
          severity: Database["public"]["Enums"]["alert_severity"]
          threshold_value: number
          updated_at: string
        }
        Insert: {
          comparison_window_days?: number
          created_at?: string
          deduplication_minutes?: number
          evaluation_window_hours?: number
          id?: string
          is_active?: boolean
          location_id?: string | null
          minimum_sample_count?: number
          organization_id: string
          rule_type: Database["public"]["Enums"]["alert_rule_type"]
          severity?: Database["public"]["Enums"]["alert_severity"]
          threshold_value: number
          updated_at?: string
        }
        Update: {
          comparison_window_days?: number
          created_at?: string
          deduplication_minutes?: number
          evaluation_window_hours?: number
          id?: string
          is_active?: boolean
          location_id?: string | null
          minimum_sample_count?: number
          organization_id?: string
          rule_type?: Database["public"]["Enums"]["alert_rule_type"]
          severity?: Database["public"]["Enums"]["alert_severity"]
          threshold_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_configurations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          assigned_to: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          location_id: string
          message: string | null
          organization_id: string
          rating_value: number | null
          resolution_note: string | null
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
          assigned_to?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          location_id: string
          message?: string | null
          organization_id: string
          rating_value?: number | null
          resolution_note?: string | null
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
          assigned_to?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          location_id?: string
          message?: string | null
          organization_id?: string
          rating_value?: number | null
          resolution_note?: string | null
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
      campaigns: {
        Row: {
          channel: Database["public"]["Enums"]["response_channel"]
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          name_ar: string
          name_en: string
          organization_id: string
          starts_at: string | null
          status: Database["public"]["Enums"]["entity_status"]
          survey_id: string
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["response_channel"]
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name_ar: string
          name_en: string
          organization_id: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          survey_id: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["response_channel"]
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_survey_scope_fkey"
            columns: ["survey_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      concern_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          position: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      corrective_action_attachments: {
        Row: {
          corrective_action_id: string
          description: string | null
          file_name: string
          file_type: string
          id: string
          organization_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          verification_comments: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          corrective_action_id: string
          description?: string | null
          file_name: string
          file_type: string
          id?: string
          organization_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          verification_comments?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          corrective_action_id?: string
          description?: string | null
          file_name?: string
          file_type?: string
          id?: string
          organization_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verification_comments?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_action_attachments_corrective_action_id_fkey"
            columns: ["corrective_action_id"]
            isOneToOne: false
            referencedRelation: "corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_action_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_action_comments: {
        Row: {
          author_id: string
          comment: string
          corrective_action_id: string
          created_at: string
          id: string
          organization_id: string
        }
        Insert: {
          author_id: string
          comment: string
          corrective_action_id: string
          created_at?: string
          id?: string
          organization_id: string
        }
        Update: {
          author_id?: string
          comment?: string
          corrective_action_id?: string
          created_at?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrective_action_comments_corrective_action_id_fkey"
            columns: ["corrective_action_id"]
            isOneToOne: false
            referencedRelation: "corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_action_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_action_status_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          corrective_action_id: string
          id: string
          new_status: Database["public"]["Enums"]["corrective_action_status"]
          organization_id: string
          previous_status:
            | Database["public"]["Enums"]["corrective_action_status"]
            | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          corrective_action_id: string
          id?: string
          new_status: Database["public"]["Enums"]["corrective_action_status"]
          organization_id: string
          previous_status?:
            | Database["public"]["Enums"]["corrective_action_status"]
            | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          corrective_action_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["corrective_action_status"]
          organization_id?: string
          previous_status?:
            | Database["public"]["Enums"]["corrective_action_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_action_status_history_corrective_action_id_fkey"
            columns: ["corrective_action_id"]
            isOneToOne: false
            referencedRelation: "corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_action_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      corrective_actions: {
        Row: {
          action_description: string
          assigned_owner_id: string
          branch_id: string | null
          closure_approval:
            | Database["public"]["Enums"]["closure_approval"]
            | null
          closure_approved_at: string | null
          closure_approved_by: string | null
          closure_date: string | null
          completion_date: string | null
          controlled_record_reference: string | null
          created_at: string
          created_by: string
          department_id: string | null
          due_date: string
          effectiveness_result:
            | Database["public"]["Enums"]["effectiveness_result"]
            | null
          effectiveness_review_date: string | null
          effectiveness_review_notes: string | null
          id: string
          internal_notes: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["corrective_action_priority"]
          problem: string
          related_alert_id: string | null
          root_cause: string
          source_response_id: string | null
          status: Database["public"]["Enums"]["corrective_action_status"]
          target_completion_date: string
          updated_at: string
          verification_comments: string | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action_description: string
          assigned_owner_id: string
          branch_id?: string | null
          closure_approval?:
            | Database["public"]["Enums"]["closure_approval"]
            | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          closure_date?: string | null
          completion_date?: string | null
          controlled_record_reference?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          due_date: string
          effectiveness_result?:
            | Database["public"]["Enums"]["effectiveness_result"]
            | null
          effectiveness_review_date?: string | null
          effectiveness_review_notes?: string | null
          id?: string
          internal_notes?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["corrective_action_priority"]
          problem: string
          related_alert_id?: string | null
          root_cause: string
          source_response_id?: string | null
          status?: Database["public"]["Enums"]["corrective_action_status"]
          target_completion_date: string
          updated_at?: string
          verification_comments?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action_description?: string
          assigned_owner_id?: string
          branch_id?: string | null
          closure_approval?:
            | Database["public"]["Enums"]["closure_approval"]
            | null
          closure_approved_at?: string | null
          closure_approved_by?: string | null
          closure_date?: string | null
          completion_date?: string | null
          controlled_record_reference?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          due_date?: string
          effectiveness_result?:
            | Database["public"]["Enums"]["effectiveness_result"]
            | null
          effectiveness_review_date?: string | null
          effectiveness_review_notes?: string | null
          id?: string
          internal_notes?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["corrective_action_priority"]
          problem?: string
          related_alert_id?: string | null
          root_cause?: string
          source_response_id?: string | null
          status?: Database["public"]["Enums"]["corrective_action_status"]
          target_completion_date?: string
          updated_at?: string
          verification_comments?: string | null
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrective_actions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_related_alert_id_fkey"
            columns: ["related_alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrective_actions_source_response_id_fkey"
            columns: ["source_response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          name_ar: string
          name_en: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          name_ar: string
          name_en: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_location_organization_fkey"
            columns: ["location_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      distribution_assignments: {
        Row: {
          assigned_employee_id: string | null
          assigned_location_id: string | null
          assigned_touchpoint_id: string | null
          campaign_id: string | null
          click_count: number
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_clicked_at: string | null
          last_response_at: string | null
          metadata: Json
          organization_id: string
          public_token: string
          response_count: number
          revoked_at: string | null
          status: string
          subject_id: string | null
          subject_type: string | null
          survey_id: string | null
          template_id: string
          updated_at: string
        }
        Insert: {
          assigned_employee_id?: string | null
          assigned_location_id?: string | null
          assigned_touchpoint_id?: string | null
          campaign_id?: string | null
          click_count?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_clicked_at?: string | null
          last_response_at?: string | null
          metadata?: Json
          organization_id: string
          public_token?: string
          response_count?: number
          revoked_at?: string | null
          status?: string
          subject_id?: string | null
          subject_type?: string | null
          survey_id?: string | null
          template_id: string
          updated_at?: string
        }
        Update: {
          assigned_employee_id?: string | null
          assigned_location_id?: string | null
          assigned_touchpoint_id?: string | null
          campaign_id?: string | null
          click_count?: number
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_clicked_at?: string | null
          last_response_at?: string | null
          metadata?: Json
          organization_id?: string
          public_token?: string
          response_count?: number
          revoked_at?: string | null
          status?: string
          subject_id?: string | null
          subject_type?: string | null
          survey_id?: string | null
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "da_survey_org_fkey"
            columns: ["survey_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "da_template_org_fkey"
            columns: ["template_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "distribution_templates"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "distribution_assignments_assigned_location_id_fkey"
            columns: ["assigned_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_assignments_assigned_touchpoint_id_fkey"
            columns: ["assigned_touchpoint_id"]
            isOneToOne: false
            referencedRelation: "touchpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_link_events: {
        Row: {
          assignment_id: string | null
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          organization_id: string
          referer: string | null
          response_id: string | null
          user_agent: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
          referer?: string | null
          response_id?: string | null
          user_agent?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          referer?: string | null
          response_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_link_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "distribution_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_link_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_link_events_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_templates: {
        Row: {
          channel: Database["public"]["Enums"]["response_channel"]
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          organization_id: string
          render_config: Json
          template_name: string
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["response_channel"]
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id: string
          render_config?: Json
          template_name: string
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["response_channel"]
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          organization_id?: string
          render_config?: Json
          template_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      effectiveness_review: {
        Row: {
          comments: string | null
          corrective_action_id: string
          created_at: string
          follow_up_notes: string | null
          follow_up_required: boolean
          id: string
          organization_id: string
          result: Database["public"]["Enums"]["effectiveness_result"]
          review_date: string
          reviewer_id: string | null
          updated_at: string
        }
        Insert: {
          comments?: string | null
          corrective_action_id: string
          created_at?: string
          follow_up_notes?: string | null
          follow_up_required?: boolean
          id?: string
          organization_id: string
          result: Database["public"]["Enums"]["effectiveness_result"]
          review_date?: string
          reviewer_id?: string | null
          updated_at?: string
        }
        Update: {
          comments?: string | null
          corrective_action_id?: string
          created_at?: string
          follow_up_notes?: string | null
          follow_up_required?: boolean
          id?: string
          organization_id?: string
          result?: Database["public"]["Enums"]["effectiveness_result"]
          review_date?: string
          reviewer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "effectiveness_review_corrective_action_id_fkey"
            columns: ["corrective_action_id"]
            isOneToOne: false
            referencedRelation: "corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effectiveness_review_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "effectiveness_review_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          auto_assign_investigation: boolean
          auto_create_alert: boolean
          auto_notify_manager: boolean
          created_at: string
          id: string
          is_active: boolean
          keywords: string[] | null
          location_id: string | null
          organization_id: string
          severity: Database["public"]["Enums"]["alert_severity"]
          survey_id: string | null
          threshold_value: number | null
          trigger_type: Database["public"]["Enums"]["escalation_trigger"]
          updated_at: string
        }
        Insert: {
          auto_assign_investigation?: boolean
          auto_create_alert?: boolean
          auto_notify_manager?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          location_id?: string | null
          organization_id: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          survey_id?: string | null
          threshold_value?: number | null
          trigger_type: Database["public"]["Enums"]["escalation_trigger"]
          updated_at?: string
        }
        Update: {
          auto_assign_investigation?: boolean
          auto_create_alert?: boolean
          auto_notify_manager?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          location_id?: string | null
          organization_id?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          survey_id?: string | null
          threshold_value?: number | null
          trigger_type?: Database["public"]["Enums"]["escalation_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["evidence_entity_type"]
          file_name: string
          file_type: Database["public"]["Enums"]["evidence_file_type"]
          id: string
          organization_id: string
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
          verification_comments: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["evidence_entity_type"]
          file_name: string
          file_type: Database["public"]["Enums"]["evidence_file_type"]
          id?: string
          organization_id: string
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verification_comments?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["evidence_entity_type"]
          file_name?: string
          file_type?: Database["public"]["Enums"]["evidence_file_type"]
          id?: string
          organization_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
          verification_comments?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_rating_nonces: {
        Row: {
          assignment_id: string
          consumed_at: string | null
          expires_at: string
          issued_at: string
          nonce_hash: string
        }
        Insert: {
          assignment_id: string
          consumed_at?: string | null
          expires_at: string
          issued_at?: string
          nonce_hash: string
        }
        Update: {
          assignment_id?: string
          consumed_at?: string | null
          expires_at?: string
          issued_at?: string
          nonce_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_rating_nonces_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "distribution_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_rating_rate_limits: {
        Row: {
          assignment_id: string
          expires_at: string
          fingerprint_hash: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          assignment_id: string
          expires_at: string
          fingerprint_hash: string
          request_count?: number
          window_started_at: string
        }
        Update: {
          assignment_id?: string
          expires_at?: string
          fingerprint_hash?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_rating_rate_limits_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "distribution_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_alerts: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          investigation_id: string
          organization_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          investigation_id: string
          organization_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          investigation_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_alerts_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_alerts_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_alerts_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_attachments: {
        Row: {
          description: string | null
          evidence_category: string | null
          file_name: string
          file_type: string
          id: string
          investigation_id: string
          organization_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          description?: string | null
          evidence_category?: string | null
          file_name: string
          file_type: string
          id?: string
          investigation_id: string
          organization_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          description?: string | null
          evidence_category?: string | null
          file_name?: string
          file_type?: string
          id?: string
          investigation_id?: string
          organization_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_attachments_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_comments: {
        Row: {
          author_id: string | null
          comment: string
          created_at: string
          event_type: string
          id: string
          investigation_id: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          comment: string
          created_at?: string
          event_type?: string
          id?: string
          investigation_id: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          comment?: string
          created_at?: string
          event_type?: string
          id?: string
          investigation_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_comments_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_corrective_actions: {
        Row: {
          corrective_action_id: string
          created_at: string
          id: string
          investigation_id: string
          organization_id: string
        }
        Insert: {
          corrective_action_id: string
          created_at?: string
          id?: string
          investigation_id: string
          organization_id: string
        }
        Update: {
          corrective_action_id?: string
          created_at?: string
          id?: string
          investigation_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_ca_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_corrective_actions_corrective_action_id_fkey"
            columns: ["corrective_action_id"]
            isOneToOne: false
            referencedRelation: "corrective_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_corrective_actions_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_corrective_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_responses: {
        Row: {
          created_at: string
          id: string
          investigation_id: string
          organization_id: string
          response_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investigation_id: string
          organization_id: string
          response_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investigation_id?: string
          organization_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigation_responses_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_responses_organization_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_responses_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      investigation_status_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string
          id: string
          investigation_id: string
          new_status: Database["public"]["Enums"]["investigation_status"]
          organization_id: string
          previous_status:
            | Database["public"]["Enums"]["investigation_status"]
            | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by: string
          id?: string
          investigation_id: string
          new_status: Database["public"]["Enums"]["investigation_status"]
          organization_id: string
          previous_status?:
            | Database["public"]["Enums"]["investigation_status"]
            | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string
          id?: string
          investigation_id?: string
          new_status?: Database["public"]["Enums"]["investigation_status"]
          organization_id?: string
          previous_status?:
            | Database["public"]["Enums"]["investigation_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "investigation_status_history_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "investigations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigation_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investigations: {
        Row: {
          branch_id: string
          closed_at: string | null
          controlled_record_references: string[]
          created_at: string
          created_by: string
          department_id: string | null
          description: string | null
          escalation_decision: Database["public"]["Enums"]["escalation_decision"]
          evidence_reviewed: string | null
          findings: string | null
          id: string
          inspection_records: Json
          internal_notes: string | null
          investigated_at: string
          investigator_id: string
          organization_id: string
          product_category_id: string | null
          product_id: string | null
          product_name: string | null
          receiving_records: Json
          recommendation: string | null
          repeated_complaints: boolean
          repeated_complaints_notes: string | null
          root_cause: string | null
          status: Database["public"]["Enums"]["investigation_status"]
          supplier_information: Json
          temperature_records: Json
          timeline: Json
          title: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          controlled_record_references?: string[]
          created_at?: string
          created_by: string
          department_id?: string | null
          description?: string | null
          escalation_decision?: Database["public"]["Enums"]["escalation_decision"]
          evidence_reviewed?: string | null
          findings?: string | null
          id?: string
          inspection_records?: Json
          internal_notes?: string | null
          investigated_at: string
          investigator_id: string
          organization_id: string
          product_category_id?: string | null
          product_id?: string | null
          product_name?: string | null
          receiving_records?: Json
          recommendation?: string | null
          repeated_complaints?: boolean
          repeated_complaints_notes?: string | null
          root_cause?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          supplier_information?: Json
          temperature_records?: Json
          timeline?: Json
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          controlled_record_references?: string[]
          created_at?: string
          created_by?: string
          department_id?: string | null
          description?: string | null
          escalation_decision?: Database["public"]["Enums"]["escalation_decision"]
          evidence_reviewed?: string | null
          findings?: string | null
          id?: string
          inspection_records?: Json
          internal_notes?: string | null
          investigated_at?: string
          investigator_id?: string
          organization_id?: string
          product_category_id?: string | null
          product_id?: string | null
          product_name?: string | null
          receiving_records?: Json
          recommendation?: string | null
          repeated_complaints?: boolean
          repeated_complaints_notes?: string | null
          root_cause?: string | null
          status?: Database["public"]["Enums"]["investigation_status"]
          supplier_information?: Json
          temperature_records?: Json
          timeline?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investigations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_branch_organization_fkey"
            columns: ["branch_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "investigations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investigations_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "concern_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_rate_limits: {
        Row: {
          action: string
          email_hash: string
          expires_at: string
          organization_id: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          action: string
          email_hash: string
          expires_at: string
          organization_id: string
          request_count?: number
          window_started_at: string
        }
        Update: {
          action?: string
          email_hash?: string
          expires_at?: string
          organization_id?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_rate_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_config_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          id: string
          kiosk_device_id: string
          new_status: Database["public"]["Enums"]["kiosk_status"] | null
          new_survey_id: string | null
          organization_id: string
          previous_status: Database["public"]["Enums"]["kiosk_status"] | null
          previous_survey_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          kiosk_device_id: string
          new_status?: Database["public"]["Enums"]["kiosk_status"] | null
          new_survey_id?: string | null
          organization_id: string
          previous_status?: Database["public"]["Enums"]["kiosk_status"] | null
          previous_survey_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          kiosk_device_id?: string
          new_status?: Database["public"]["Enums"]["kiosk_status"] | null
          new_survey_id?: string | null
          organization_id?: string
          previous_status?: Database["public"]["Enums"]["kiosk_status"] | null
          previous_survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_config_history_kiosk_device_id_fkey"
            columns: ["kiosk_device_id"]
            isOneToOne: false
            referencedRelation: "kiosk_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_config_history_new_survey_id_fkey"
            columns: ["new_survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_config_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_config_history_previous_survey_id_fkey"
            columns: ["previous_survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_devices: {
        Row: {
          access_token: string
          app_version: string | null
          branding: Json
          channel: Database["public"]["Enums"]["kiosk_channel"]
          created_at: string
          created_by: string | null
          default_language: string
          device_identifier: string | null
          device_model: string | null
          device_name: string
          id: string
          idle_timeout_seconds: number
          last_response_at: string | null
          last_seen_at: string | null
          location_id: string
          notes: string | null
          organization_id: string
          os_version: string | null
          status: Database["public"]["Enums"]["kiosk_status"]
          survey_id: string | null
          total_responses: number
          updated_at: string
        }
        Insert: {
          access_token?: string
          app_version?: string | null
          branding?: Json
          channel?: Database["public"]["Enums"]["kiosk_channel"]
          created_at?: string
          created_by?: string | null
          default_language?: string
          device_identifier?: string | null
          device_model?: string | null
          device_name: string
          id?: string
          idle_timeout_seconds?: number
          last_response_at?: string | null
          last_seen_at?: string | null
          location_id: string
          notes?: string | null
          organization_id: string
          os_version?: string | null
          status?: Database["public"]["Enums"]["kiosk_status"]
          survey_id?: string | null
          total_responses?: number
          updated_at?: string
        }
        Update: {
          access_token?: string
          app_version?: string | null
          branding?: Json
          channel?: Database["public"]["Enums"]["kiosk_channel"]
          created_at?: string
          created_by?: string | null
          default_language?: string
          device_identifier?: string | null
          device_model?: string | null
          device_name?: string
          id?: string
          idle_timeout_seconds?: number
          last_response_at?: string | null
          last_seen_at?: string | null
          location_id?: string
          notes?: string | null
          organization_id?: string
          os_version?: string | null
          status?: Database["public"]["Enums"]["kiosk_status"]
          survey_id?: string | null
          total_responses?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_devices_location_fk"
            columns: ["location_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "kiosk_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_devices_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metric: Database["public"]["Enums"]["kpi_metric"]
          negative_max: number
          organization_id: string
          satisfied_min: number
          updated_at: string
          zero_response_handling: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric: Database["public"]["Enums"]["kpi_metric"]
          negative_max: number
          organization_id: string
          satisfied_min: number
          updated_at?: string
          zero_response_handling?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metric?: Database["public"]["Enums"]["kpi_metric"]
          negative_max?: number
          organization_id?: string
          satisfied_min?: number
          updated_at?: string
          zero_response_handling?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_organization_id_fkey"
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
          email: string | null
          governorate: string
          id: string
          inherits_timezone: boolean
          name_ar: string
          name_en: string
          opening_hours: Json
          organization_id: string
          phone: string | null
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
          email?: string | null
          governorate?: string
          id?: string
          inherits_timezone?: boolean
          name_ar: string
          name_en: string
          opening_hours?: Json
          organization_id: string
          phone?: string | null
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
          email?: string | null
          governorate?: string
          id?: string
          inherits_timezone?: boolean
          name_ar?: string
          name_en?: string
          opening_hours?: Json
          organization_id?: string
          phone?: string | null
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
          delivery_attempts: number
          delivery_error_code: string | null
          delivery_status: Database["public"]["Enums"]["invitation_delivery_status"]
          email: string
          expires_at: string
          id: string
          invited_by: string
          last_delivery_at: string | null
          locale: Database["public"]["Enums"]["locale_code"]
          organization_id: string
          personal_message: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["membership_scope"]
          superseded_by: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          delivery_attempts?: number
          delivery_error_code?: string | null
          delivery_status?: Database["public"]["Enums"]["invitation_delivery_status"]
          email: string
          expires_at: string
          id?: string
          invited_by: string
          last_delivery_at?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          organization_id: string
          personal_message?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["membership_scope"]
          superseded_by?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          delivery_attempts?: number
          delivery_error_code?: string | null
          delivery_status?: Database["public"]["Enums"]["invitation_delivery_status"]
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          last_delivery_at?: string | null
          locale?: Database["public"]["Enums"]["locale_code"]
          organization_id?: string
          personal_message?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["membership_scope"]
          superseded_by?: string | null
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
          {
            foreignKeyName: "organization_invitations_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "organization_invitations"
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
          accent_color: string
          business_category: string
          created_at: string
          created_by: string | null
          dark_logo_path: string | null
          date_format: string
          default_locale: Database["public"]["Enums"]["locale_code"]
          default_thank_you_ar: string | null
          default_thank_you_en: string | null
          description_ar: string | null
          description_en: string | null
          email: string | null
          footer_text_ar: string | null
          footer_text_en: string | null
          icon_logo_path: string | null
          id: string
          logo_path: string | null
          name_ar: string
          name_en: string
          number_format: string
          phone: string | null
          primary_color: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          support_email: string | null
          support_phone: string | null
          survey_header_style: string
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          accent_color?: string
          business_category?: string
          created_at?: string
          created_by?: string | null
          dark_logo_path?: string | null
          date_format?: string
          default_locale?: Database["public"]["Enums"]["locale_code"]
          default_thank_you_ar?: string | null
          default_thank_you_en?: string | null
          description_ar?: string | null
          description_en?: string | null
          email?: string | null
          footer_text_ar?: string | null
          footer_text_en?: string | null
          icon_logo_path?: string | null
          id?: string
          logo_path?: string | null
          name_ar: string
          name_en: string
          number_format?: string
          phone?: string | null
          primary_color?: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          support_email?: string | null
          support_phone?: string | null
          survey_header_style?: string
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          accent_color?: string
          business_category?: string
          created_at?: string
          created_by?: string | null
          dark_logo_path?: string | null
          date_format?: string
          default_locale?: Database["public"]["Enums"]["locale_code"]
          default_thank_you_ar?: string | null
          default_thank_you_en?: string | null
          description_ar?: string | null
          description_en?: string | null
          email?: string | null
          footer_text_ar?: string | null
          footer_text_en?: string | null
          icon_logo_path?: string | null
          id?: string
          logo_path?: string | null
          name_ar?: string
          name_en?: string
          number_format?: string
          phone?: string | null
          primary_color?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          support_email?: string | null
          support_phone?: string | null
          survey_header_style?: string
          timezone?: string
          updated_at?: string
          website?: string | null
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
      rating_events: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          ip_hash: string | null
          nonce_ref: string
          organization_id: string
          rating: number
          user_agent: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          nonce_ref: string
          organization_id: string
          rating: number
          user_agent?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          nonce_ref?: string
          organization_id?: string
          rating?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rating_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "distribution_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_scale_points: {
        Row: {
          label_ar: string
          label_en: string
          position: number
          scale_key: string
          value: number
        }
        Insert: {
          label_ar: string
          label_en: string
          position: number
          scale_key: string
          value: number
        }
        Update: {
          label_ar?: string
          label_en?: string
          position?: number
          scale_key?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "rating_scale_points_scale_key_fkey"
            columns: ["scale_key"]
            isOneToOne: false
            referencedRelation: "rating_scales"
            referencedColumns: ["key"]
          },
        ]
      }
      rating_scales: {
        Row: {
          created_at: string
          is_active: boolean
          key: string
          name_ar: string
          name_en: string
          negative_max: number
          satisfied_min: number
          scale_max: number
          scale_min: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          key: string
          name_ar: string
          name_en: string
          negative_max: number
          satisfied_min: number
          scale_max: number
          scale_min: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          key?: string
          name_ar?: string
          name_en?: string
          negative_max?: number
          satisfied_min?: number
          scale_max?: number
          scale_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      response_concerns: {
        Row: {
          concern_category_id: string
          created_at: string
          id: string
          is_primary: boolean
          organization_id: string
          response_id: string
          survey_id: string
        }
        Insert: {
          concern_category_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          organization_id: string
          response_id: string
          survey_id: string
        }
        Update: {
          concern_category_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          organization_id?: string
          response_id?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_concerns_concern_category_id_fkey"
            columns: ["concern_category_id"]
            isOneToOne: false
            referencedRelation: "concern_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_concerns_response_scope_fkey"
            columns: ["response_id", "survey_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id", "survey_id", "organization_id"]
          },
        ]
      }
      response_internal_notes: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          note: string
          organization_id: string
          response_id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          note: string
          organization_id: string
          response_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          note?: string
          organization_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_internal_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_internal_notes_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      response_review_audit: {
        Row: {
          actor_id: string
          controlled_record_reason: string | null
          controlled_record_reference: string | null
          controlled_record_type:
            | Database["public"]["Enums"]["controlled_record_type"]
            | null
          follow_up_details: string | null
          id: string
          new_status: Database["public"]["Enums"]["response_workflow_status"]
          organization_id: string
          outcome_summary: string | null
          previous_status:
            | Database["public"]["Enums"]["response_workflow_status"]
            | null
          recorded_at: string
          response_id: string
        }
        Insert: {
          actor_id: string
          controlled_record_reason?: string | null
          controlled_record_reference?: string | null
          controlled_record_type?:
            | Database["public"]["Enums"]["controlled_record_type"]
            | null
          follow_up_details?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["response_workflow_status"]
          organization_id: string
          outcome_summary?: string | null
          previous_status?:
            | Database["public"]["Enums"]["response_workflow_status"]
            | null
          recorded_at?: string
          response_id: string
        }
        Update: {
          actor_id?: string
          controlled_record_reason?: string | null
          controlled_record_reference?: string | null
          controlled_record_type?:
            | Database["public"]["Enums"]["controlled_record_type"]
            | null
          follow_up_details?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["response_workflow_status"]
          organization_id?: string
          outcome_summary?: string | null
          previous_status?:
            | Database["public"]["Enums"]["response_workflow_status"]
            | null
          recorded_at?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_review_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_review_audit_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      response_status_history: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["response_workflow_status"]
          organization_id: string
          previous_status:
            | Database["public"]["Enums"]["response_workflow_status"]
            | null
          reason: string | null
          response_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["response_workflow_status"]
          organization_id: string
          previous_status?:
            | Database["public"]["Enums"]["response_workflow_status"]
            | null
          reason?: string | null
          response_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["response_workflow_status"]
          organization_id?: string
          previous_status?:
            | Database["public"]["Enums"]["response_workflow_status"]
            | null
          reason?: string | null
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "response_status_history_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
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
          concern_category_id: string | null
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
          concern_category_id?: string | null
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
          concern_category_id?: string | null
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
            foreignKeyName: "survey_question_options_concern_category_id_fkey"
            columns: ["concern_category_id"]
            isOneToOne: false
            referencedRelation: "concern_categories"
            referencedColumns: ["id"]
          },
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
          rating_scale: string | null
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
          rating_scale?: string | null
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
          rating_scale?: string | null
          status?: Database["public"]["Enums"]["survey_status"]
          survey_id?: string
          text_max_length?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_rating_scale_fkey"
            columns: ["rating_scale"]
            isOneToOne: false
            referencedRelation: "rating_scales"
            referencedColumns: ["key"]
          },
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
          assigned_to: string | null
          campaign_id: string | null
          channel: Database["public"]["Enums"]["response_channel"]
          controlled_record_opened_by: string | null
          controlled_record_outcome_summary: string | null
          controlled_record_recorded_at: string | null
          controlled_record_recorded_by: string | null
          controlled_record_reference: string | null
          controlled_record_status: string | null
          controlled_record_type:
            | Database["public"]["Enums"]["controlled_record_type"]
            | null
          created_at: string
          department_id: string | null
          distribution_assignment_id: string | null
          employee_reference: string | null
          feedback_mode: Database["public"]["Enums"]["feedback_mode"]
          had_followup: boolean
          id: string
          idempotency_key: string | null
          interaction_reference: string | null
          internal_tags: string[]
          locale: Database["public"]["Enums"]["locale_code"]
          location_id: string
          organization_id: string
          overall_rating: number | null
          resolved_at: string | null
          reviewed_at: string | null
          source_identifier: string | null
          submitted_at: string
          survey_id: string
          touchpoint_id: string | null
          updated_at: string
          workflow_status: Database["public"]["Enums"]["response_workflow_status"]
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["response_channel"]
          controlled_record_opened_by?: string | null
          controlled_record_outcome_summary?: string | null
          controlled_record_recorded_at?: string | null
          controlled_record_recorded_by?: string | null
          controlled_record_reference?: string | null
          controlled_record_status?: string | null
          controlled_record_type?:
            | Database["public"]["Enums"]["controlled_record_type"]
            | null
          created_at?: string
          department_id?: string | null
          distribution_assignment_id?: string | null
          employee_reference?: string | null
          feedback_mode?: Database["public"]["Enums"]["feedback_mode"]
          had_followup?: boolean
          id?: string
          idempotency_key?: string | null
          interaction_reference?: string | null
          internal_tags?: string[]
          locale: Database["public"]["Enums"]["locale_code"]
          location_id: string
          organization_id: string
          overall_rating?: number | null
          resolved_at?: string | null
          reviewed_at?: string | null
          source_identifier?: string | null
          submitted_at?: string
          survey_id: string
          touchpoint_id?: string | null
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["response_workflow_status"]
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel?: Database["public"]["Enums"]["response_channel"]
          controlled_record_opened_by?: string | null
          controlled_record_outcome_summary?: string | null
          controlled_record_recorded_at?: string | null
          controlled_record_recorded_by?: string | null
          controlled_record_reference?: string | null
          controlled_record_status?: string | null
          controlled_record_type?:
            | Database["public"]["Enums"]["controlled_record_type"]
            | null
          created_at?: string
          department_id?: string | null
          distribution_assignment_id?: string | null
          employee_reference?: string | null
          feedback_mode?: Database["public"]["Enums"]["feedback_mode"]
          had_followup?: boolean
          id?: string
          idempotency_key?: string | null
          interaction_reference?: string | null
          internal_tags?: string[]
          locale?: Database["public"]["Enums"]["locale_code"]
          location_id?: string
          organization_id?: string
          overall_rating?: number | null
          resolved_at?: string | null
          reviewed_at?: string | null
          source_identifier?: string | null
          submitted_at?: string
          survey_id?: string
          touchpoint_id?: string | null
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["response_workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_department_scope_fkey"
            columns: ["department_id", "organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "organization_id", "location_id"]
          },
          {
            foreignKeyName: "survey_responses_distribution_assignment_id_fkey"
            columns: ["distribution_assignment_id"]
            isOneToOne: false
            referencedRelation: "distribution_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_scope_fkey"
            columns: ["survey_id", "organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id", "organization_id", "location_id"]
          },
          {
            foreignKeyName: "survey_responses_touchpoint_scope_fkey"
            columns: ["touchpoint_id", "organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "touchpoints"
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
          escalation_enabled: boolean
          escalation_keywords: string[] | null
          escalation_threshold: number | null
          id: string
          location_id: string
          organization_id: string
          public_slug: string
          published_at: string | null
          quick_feedback_categories: Json
          quick_feedback_enabled: boolean
          quick_feedback_negative_threshold: number
          quick_feedback_positive_threshold: number
          quick_feedback_rating_style: string
          status: Database["public"]["Enums"]["survey_status"]
          survey_group_id: string
          survey_type: Database["public"]["Enums"]["survey_type"]
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
          escalation_enabled?: boolean
          escalation_keywords?: string[] | null
          escalation_threshold?: number | null
          id?: string
          location_id: string
          organization_id: string
          public_slug?: string
          published_at?: string | null
          quick_feedback_categories?: Json
          quick_feedback_enabled?: boolean
          quick_feedback_negative_threshold?: number
          quick_feedback_positive_threshold?: number
          quick_feedback_rating_style?: string
          status?: Database["public"]["Enums"]["survey_status"]
          survey_group_id?: string
          survey_type?: Database["public"]["Enums"]["survey_type"]
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
          escalation_enabled?: boolean
          escalation_keywords?: string[] | null
          escalation_threshold?: number | null
          id?: string
          location_id?: string
          organization_id?: string
          public_slug?: string
          published_at?: string | null
          quick_feedback_categories?: Json
          quick_feedback_enabled?: boolean
          quick_feedback_negative_threshold?: number
          quick_feedback_positive_threshold?: number
          quick_feedback_rating_style?: string
          status?: Database["public"]["Enums"]["survey_status"]
          survey_group_id?: string
          survey_type?: Database["public"]["Enums"]["survey_type"]
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
      touchpoints: {
        Row: {
          channel: Database["public"]["Enums"]["response_channel"]
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          location_id: string
          name_ar: string
          name_en: string
          organization_id: string
          public_token: string
          slug: string
          status: Database["public"]["Enums"]["entity_status"]
          survey_id: string | null
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["response_channel"]
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          location_id: string
          name_ar: string
          name_en: string
          organization_id: string
          public_token?: string
          slug: string
          status?: Database["public"]["Enums"]["entity_status"]
          survey_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["response_channel"]
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          location_id?: string
          name_ar?: string
          name_en?: string
          organization_id?: string
          public_token?: string
          slug?: string
          status?: Database["public"]["Enums"]["entity_status"]
          survey_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "touchpoints_department_scope_fkey"
            columns: ["department_id", "organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "organization_id", "location_id"]
          },
          {
            foreignKeyName: "touchpoints_survey_scope_fkey"
            columns: ["survey_id", "organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id", "organization_id", "location_id"]
          },
        ]
      }
      verification: {
        Row: {
          comments: string | null
          created_at: string
          evidence_id: string
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["verification_status"]
          verified_at: string
          verifier_id: string | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          evidence_id: string
          id?: string
          organization_id: string
          status: Database["public"]["Enums"]["verification_status"]
          verified_at?: string
          verifier_id?: string | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          evidence_id?: string
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_verifier_id_fkey"
            columns: ["verifier_id"]
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
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      assert_analytics_scope:
        | {
            Args: {
              p_end_at: string
              p_location_id?: string
              p_organization_id: string
              p_start_at: string
              p_survey_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_channel: string
              p_department_id: string
              p_end_at: string
              p_location_id: string
              p_organization_id: string
              p_start_at: string
              p_survey_id: string
              p_touchpoint_id: string
            }
            Returns: undefined
          }
      bulk_create_distribution_assignments: {
        Args: {
          p_campaign_id?: string
          p_employee_ids?: string[]
          p_location_ids?: string[]
          p_organization_id: string
          p_survey_id: string
          p_template_id: string
        }
        Returns: number
      }
      can_access_location: { Args: { p_location_id: string }; Returns: boolean }
      can_access_response: { Args: { p_response_id: string }; Returns: boolean }
      can_manage_alert: { Args: { p_alert_id: string }; Returns: boolean }
      can_manage_location: { Args: { p_location_id: string }; Returns: boolean }
      can_manage_organization: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      can_manage_response: { Args: { p_response_id: string }; Returns: boolean }
      can_manage_survey: { Args: { p_survey_id: string }; Returns: boolean }
      can_read_organization: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      can_read_profile: { Args: { p_profile_id: string }; Returns: boolean }
      can_read_survey: { Args: { p_survey_id: string }; Returns: boolean }
      consume_invitation_rate_limit: {
        Args: { p_action: string; p_email: string; p_organization_id: string }
        Returns: undefined
      }
      consume_public_submission_rate_limit: {
        Args: {
          p_fingerprint_hash: string
          p_limit?: number
          p_public_slug: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      consume_rating_rate_limit: {
        Args: {
          p_assignment_id: string
          p_fingerprint_hash: string
          p_limit?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      consume_token_click_rate_limit: {
        Args: {
          p_fingerprint: string
          p_max_clicks: number
          p_public_token: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      create_department: {
        Args: {
          p_location_id: string
          p_name_ar: string
          p_name_en: string
          p_organization_id: string
          p_slug: string
        }
        Returns: string
      }
      create_kiosk_device: {
        Args: {
          p_device_identifier?: string
          p_device_name: string
          p_location_id: string
          p_notes?: string
          p_organization_id: string
          p_survey_id?: string
        }
        Returns: string
      }
      create_location_v2: {
        Args: {
          p_address_ar: string
          p_address_en: string
          p_area: string
          p_email: string
          p_governorate: string
          p_inherits_timezone: boolean
          p_name_ar: string
          p_name_en: string
          p_opening_hours: Json
          p_organization_id: string
          p_phone: string
          p_slug: string
          p_timezone?: string
        }
        Returns: string
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
      create_rating_scale: {
        Args: {
          p_key: string
          p_name_ar: string
          p_name_en: string
          p_negative_max: number
          p_satisfied_min: number
          p_scale_max: number
          p_scale_min: number
        }
        Returns: string
      }
      create_touchpoint: {
        Args: {
          p_channel: Database["public"]["Enums"]["response_channel"]
          p_department_id: string
          p_location_id: string
          p_name_ar: string
          p_name_en: string
          p_organization_id: string
          p_slug: string
          p_survey_id?: string
        }
        Returns: string
      }
      deactivate_own_account: { Args: never; Returns: undefined }
      duplicate_survey_group: { Args: { p_survey_id: string }; Returns: string }
      evaluate_kpi_alert_rules: {
        Args: { p_organization_id: string }
        Returns: number
      }
      get_alert_severity_breakdown: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_alert_summary: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_alert_trigger_breakdown: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_analytics_overview: {
        Args: {
          p_alert_status?: Database["public"]["Enums"]["alert_status"]
          p_bucket?: string
          p_channel?: string
          p_end_at: string
          p_feedback_mode?: Database["public"]["Enums"]["feedback_mode"]
          p_location_id?: string
          p_organization_id: string
          p_rating_max?: number
          p_rating_min?: number
          p_start_at: string
          p_survey_id?: string
        }
        Returns: Json
      }
      get_branch_ranking: {
        Args: {
          p_end_at: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_concern_response_trends: {
        Args: {
          p_bucket?: string
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_concern_trend: {
        Args: {
          p_department_id?: string
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
          p_survey_id?: string
        }
        Returns: Json
      }
      get_controlled_record_references: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_corrective_action_effectiveness: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_corrective_action_stats: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_corrective_action_verification: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_department_ranking: {
        Args: {
          p_end_at: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_distribution_analytics: {
        Args: {
          p_campaign_id?: string
          p_channel?: string
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
          p_template_id?: string
        }
        Returns: Json
      }
      get_followup_records: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_invitation_public: { Args: { p_token: string }; Returns: Json }
      get_kiosk_config: {
        Args: { p_access_token: string }
        Returns: {
          branding: Json
          default_language: string
          device_id: string
          device_name: string
          idle_timeout_seconds: number
          last_config_change: string
          status: Database["public"]["Enums"]["kiosk_status"]
          survey_public_slug: string
        }[]
      }
      get_kpi_dashboard: {
        Args: {
          p_channel?: string
          p_end_at: string
          p_feedback_mode?: Database["public"]["Enums"]["feedback_mode"]
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
          p_survey_id?: string
        }
        Returns: Json
      }
      get_management_decisions: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_platform_overview: { Args: never; Returns: Json }
      get_public_survey: { Args: { p_public_slug: string }; Returns: Json }
      get_quick_feedback_analytics: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_review_summary: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      get_signature_badge: { Args: { p_public_token: string }; Returns: Json }
      get_signature_subject_report: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
          p_subject_type?: string
          p_template_id?: string
        }
        Returns: Json
      }
      get_survey_question_analytics: {
        Args: {
          p_end_at: string
          p_start_at: string
          p_survey_id: string
          p_text_limit?: number
          p_text_offset?: number
        }
        Returns: Json
      }
      get_target_status: {
        Args: {
          p_end_at: string
          p_location_id?: string
          p_organization_id: string
          p_start_at: string
        }
        Returns: Json
      }
      is_platform_admin: { Args: never; Returns: boolean }
      issue_rating_nonce: {
        Args: { p_fingerprint_hash?: string; p_public_token: string }
        Returns: Json
      }
      list_kiosk_devices: {
        Args: {
          p_location_id?: string
          p_organization_id: string
          p_status?: Database["public"]["Enums"]["kiosk_status"]
        }
        Returns: {
          app_version: string
          branding: Json
          channel: Database["public"]["Enums"]["kiosk_channel"]
          created_at: string
          default_language: string
          device_identifier: string
          device_model: string
          device_name: string
          id: string
          idle_timeout_seconds: number
          last_response_at: string
          last_seen_at: string
          location_id: string
          location_name_ar: string
          location_name_en: string
          notes: string
          organization_id: string
          os_version: string
          status: Database["public"]["Enums"]["kiosk_status"]
          survey_id: string
          survey_title_ar: string
          survey_title_en: string
          total_responses: number
          updated_at: string
        }[]
      }
      list_team_invitations: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      list_team_members: {
        Args: {
          p_location_id?: string
          p_organization_id: string
          p_page?: number
          p_page_size?: number
          p_role?: Database["public"]["Enums"]["app_role"]
          p_search?: string
        }
        Returns: Json
      }
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
      prepare_organization_invitation_v2: {
        Args: {
          p_email: string
          p_expires_in?: string
          p_locale?: Database["public"]["Enums"]["locale_code"]
          p_location_ids?: string[]
          p_organization_id: string
          p_personal_message?: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: {
          expires_at: string
          invitation_id: string
          invitation_token: string
        }[]
      }
      record_data_export: {
        Args: {
          p_export_type: string
          p_filters?: Json
          p_organization_id: string
        }
        Returns: undefined
      }
      record_distribution_click: {
        Args: {
          p_ip_address?: string
          p_public_token: string
          p_referer?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      record_distribution_conversion: {
        Args: { p_public_token: string; p_response_id: string }
        Returns: undefined
      }
      record_invitation_acceptance_failure: {
        Args: { p_reason: string; p_token: string }
        Returns: undefined
      }
      record_invitation_delivery: {
        Args: {
          p_error_code?: string
          p_invitation_id: string
          p_status: Database["public"]["Enums"]["invitation_delivery_status"]
        }
        Returns: undefined
      }
      record_kiosk_response: {
        Args: { p_access_token: string }
        Returns: boolean
      }
      record_rating: {
        Args: {
          p_fingerprint_hash?: string
          p_nonce: string
          p_public_token: string
          p_rating: number
          p_user_agent?: string
        }
        Returns: Json
      }
      remove_organization_member: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      resend_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          expires_at: string
          invitation_id: string
          invitation_token: string
          invited_email: string
          invited_locale: Database["public"]["Enums"]["locale_code"]
          invited_role: Database["public"]["Enums"]["app_role"]
          personal_message: string
        }[]
      }
      resolve_kiosk_attribution: {
        Args: { p_access_token: string }
        Returns: {
          channel: Database["public"]["Enums"]["kiosk_channel"]
          device_id: string
          location_id: string
          organization_id: string
          status: Database["public"]["Enums"]["kiosk_status"]
          survey_id: string
        }[]
      }
      revoke_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      save_quick_feedback_config: {
        Args: {
          p_follow_up_enabled?: boolean
          p_is_enabled: boolean
          p_negative_threshold?: number
          p_positive_threshold?: number
          p_rating_style?: string
          p_show_comment_field?: boolean
          p_survey_id: string
        }
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
          p_survey_type?: Database["public"]["Enums"]["survey_type"]
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
          p_campaign_id?: string
          p_channel?: Database["public"]["Enums"]["response_channel"]
          p_distribution_public_token?: string
          p_employee_reference?: string
          p_feedback_mode?: Database["public"]["Enums"]["feedback_mode"]
          p_fingerprint_hash: string
          p_idempotency_key: string
          p_interaction_reference?: string
          p_locale: Database["public"]["Enums"]["locale_code"]
          p_public_slug: string
          p_quick_categories?: Json
          p_quick_rating?: number
          p_source_identifier?: string
          p_touchpoint_token?: string
        }
        Returns: Json
      }
      submit_public_survey_response: {
        Args: {
          p_answers: Json
          p_campaign_id?: string
          p_channel?: Database["public"]["Enums"]["response_channel"]
          p_distribution_public_token?: string
          p_employee_reference?: string
          p_feedback_mode?: Database["public"]["Enums"]["feedback_mode"]
          p_idempotency_key?: string
          p_interaction_reference?: string
          p_locale: Database["public"]["Enums"]["locale_code"]
          p_public_slug: string
          p_quick_categories?: Json
          p_quick_rating?: number
          p_source_identifier?: string
          p_touchpoint_token?: string
        }
        Returns: string
      }
      transfer_organization_ownership: {
        Args: { p_organization_id: string; p_target_membership_id: string }
        Returns: undefined
      }
      transition_survey_group: {
        Args: {
          p_status: Database["public"]["Enums"]["survey_status"]
          p_survey_id: string
        }
        Returns: undefined
      }
      update_alert_workflow: {
        Args: {
          p_alert_id: string
          p_assigned_to?: string
          p_resolution_note?: string
          p_status: Database["public"]["Enums"]["alert_status"]
        }
        Returns: undefined
      }
      update_department: {
        Args: {
          p_department_id: string
          p_location_id: string
          p_name_ar: string
          p_name_en: string
          p_organization_id: string
          p_slug: string
          p_status: string
        }
        Returns: undefined
      }
      update_kiosk_device: {
        Args: {
          p_branding?: Json
          p_change_reason?: string
          p_clear_survey?: boolean
          p_default_language?: string
          p_device_id: string
          p_device_name?: string
          p_idle_timeout_seconds?: number
          p_notes?: string
          p_status?: Database["public"]["Enums"]["kiosk_status"]
          p_survey_id?: string
        }
        Returns: boolean
      }
      update_kiosk_heartbeat: {
        Args: {
          p_access_token: string
          p_app_version?: string
          p_device_model?: string
          p_os_version?: string
        }
        Returns: boolean
      }
      update_location_v2: {
        Args: {
          p_address_ar: string
          p_address_en: string
          p_area: string
          p_email: string
          p_governorate: string
          p_inherits_timezone: boolean
          p_location_id: string
          p_name_ar: string
          p_name_en: string
          p_opening_hours: Json
          p_phone: string
          p_slug: string
          p_status: Database["public"]["Enums"]["entity_status"]
          p_timezone: string
        }
        Returns: undefined
      }
      update_organization_branding: {
        Args: {
          p_accent_color: string
          p_dark_logo_path: string
          p_default_thank_you_ar: string
          p_default_thank_you_en: string
          p_footer_text_ar: string
          p_footer_text_en: string
          p_icon_logo_path: string
          p_logo_path: string
          p_organization_id: string
          p_primary_color: string
          p_survey_header_style: string
        }
        Returns: undefined
      }
      update_organization_member: {
        Args: {
          p_location_ids?: string[]
          p_membership_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_status?: Database["public"]["Enums"]["entity_status"]
        }
        Returns: undefined
      }
      update_organization_settings: {
        Args: {
          p_business_category: string
          p_date_format: string
          p_default_locale: Database["public"]["Enums"]["locale_code"]
          p_description_ar: string
          p_description_en: string
          p_email: string
          p_name_ar: string
          p_name_en: string
          p_number_format: string
          p_organization_id: string
          p_phone: string
          p_slug: string
          p_support_email: string
          p_support_phone: string
          p_website: string
        }
        Returns: undefined
      }
      update_own_profile: {
        Args: {
          p_display_name: string
          p_locale: Database["public"]["Enums"]["locale_code"]
        }
        Returns: undefined
      }
      update_rating_scale: {
        Args: {
          p_is_active: boolean
          p_key: string
          p_name_ar: string
          p_name_en: string
          p_negative_max: number
          p_satisfied_min: number
          p_scale_max: number
          p_scale_min: number
        }
        Returns: undefined
      }
      update_response_workflow: {
        Args: {
          p_assigned_to?: string
          p_controlled_record_reason?: string
          p_controlled_record_reference?: string
          p_controlled_record_type?: Database["public"]["Enums"]["controlled_record_type"]
          p_follow_up_details?: string
          p_note?: string
          p_outcome_summary?: string
          p_response_id: string
          p_status: Database["public"]["Enums"]["response_workflow_status"]
          p_tags?: string[]
        }
        Returns: undefined
      }
      update_touchpoint: {
        Args: {
          p_channel: Database["public"]["Enums"]["response_channel"]
          p_department_id: string
          p_location_id: string
          p_name_ar: string
          p_name_en: string
          p_organization_id: string
          p_slug: string
          p_status: string
          p_survey_id?: string
          p_touchpoint_id: string
        }
        Returns: undefined
      }
      user_can_access_location: {
        Args: { p_location_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      alert_rule_type:
        | "satisfaction_threshold"
        | "negative_feedback_threshold"
        | "concern_frequency_threshold"
        | "sudden_decline"
      alert_severity: "low" | "medium" | "high" | "critical"
      alert_status: "open" | "acknowledged" | "resolved" | "dismissed"
      app_role:
        | "platform_admin"
        | "organization_owner"
        | "organization_admin"
        | "location_manager"
        | "analyst"
        | "quality_manager"
        | "senior_management"
      closure_approval: "pending" | "approved" | "rejected"
      controlled_record_type: "investigation" | "ncr" | "capa"
      corrective_action_priority: "low" | "medium" | "high" | "critical"
      corrective_action_status:
        | "draft"
        | "open"
        | "in_progress"
        | "pending_verification"
        | "verified"
        | "effectiveness_review"
        | "closed"
        | "rejected"
      effectiveness_result:
        | "effective"
        | "partially_effective"
        | "not_effective"
      entity_status: "active" | "archived"
      escalation_decision:
        | "none"
        | "quality_manager"
        | "senior_management"
        | "platform_admin"
      escalation_trigger: "rating_threshold" | "keywords" | "negative_sentiment"
      evidence_entity_type:
        | "corrective_action"
        | "investigation"
        | "response"
        | "alert"
      evidence_file_type:
        | "photo"
        | "pdf"
        | "checklist"
        | "training_record"
        | "maintenance_record"
        | "supplier_document"
        | "other"
      feedback_mode: "standard" | "quick"
      investigation_status:
        | "draft"
        | "active"
        | "waiting_verification"
        | "closed"
      invitation_delivery_status: "pending" | "captured" | "sent" | "failed"
      kiosk_channel: "kiosk" | "tablet" | "qr"
      kiosk_status:
        | "pending_activation"
        | "active"
        | "paused"
        | "maintenance"
        | "offline"
        | "revoked"
        | "archived"
      kpi_metric:
        | "satisfaction_pct"
        | "negative_feedback_pct"
        | "main_concern"
        | "response_count"
        | "average_rating"
      locale_code: "en" | "ar"
      membership_scope: "organization" | "locations"
      question_type: "rating" | "multiple_choice" | "text"
      response_channel:
        | "qr"
        | "email"
        | "kiosk"
        | "web"
        | "walk_in"
        | "website"
        | "phone"
        | "whatsapp"
        | "tablet"
        | "sms"
      response_workflow_status:
        | "monitor_only"
        | "branch_followup"
        | "controlled_investigation"
        | "immediate_escalation"
      signature_layout: "horizontal" | "vertical" | "minimal" | "branded"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "archived"
      survey_status: "draft" | "active" | "archived"
      survey_type: "generic" | "fresh_produce"
      verification_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "more_evidence_required"
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
      alert_rule_type: [
        "satisfaction_threshold",
        "negative_feedback_threshold",
        "concern_frequency_threshold",
        "sudden_decline",
      ],
      alert_severity: ["low", "medium", "high", "critical"],
      alert_status: ["open", "acknowledged", "resolved", "dismissed"],
      app_role: [
        "platform_admin",
        "organization_owner",
        "organization_admin",
        "location_manager",
        "analyst",
        "quality_manager",
        "senior_management",
      ],
      closure_approval: ["pending", "approved", "rejected"],
      controlled_record_type: ["investigation", "ncr", "capa"],
      corrective_action_priority: ["low", "medium", "high", "critical"],
      corrective_action_status: [
        "draft",
        "open",
        "in_progress",
        "pending_verification",
        "verified",
        "effectiveness_review",
        "closed",
        "rejected",
      ],
      effectiveness_result: [
        "effective",
        "partially_effective",
        "not_effective",
      ],
      entity_status: ["active", "archived"],
      escalation_decision: [
        "none",
        "quality_manager",
        "senior_management",
        "platform_admin",
      ],
      escalation_trigger: [
        "rating_threshold",
        "keywords",
        "negative_sentiment",
      ],
      evidence_entity_type: [
        "corrective_action",
        "investigation",
        "response",
        "alert",
      ],
      evidence_file_type: [
        "photo",
        "pdf",
        "checklist",
        "training_record",
        "maintenance_record",
        "supplier_document",
        "other",
      ],
      feedback_mode: ["standard", "quick"],
      investigation_status: [
        "draft",
        "active",
        "waiting_verification",
        "closed",
      ],
      invitation_delivery_status: ["pending", "captured", "sent", "failed"],
      kiosk_channel: ["kiosk", "tablet", "qr"],
      kiosk_status: [
        "pending_activation",
        "active",
        "paused",
        "maintenance",
        "offline",
        "revoked",
        "archived",
      ],
      kpi_metric: [
        "satisfaction_pct",
        "negative_feedback_pct",
        "main_concern",
        "response_count",
        "average_rating",
      ],
      locale_code: ["en", "ar"],
      membership_scope: ["organization", "locations"],
      question_type: ["rating", "multiple_choice", "text"],
      response_channel: [
        "qr",
        "email",
        "kiosk",
        "web",
        "walk_in",
        "website",
        "phone",
        "whatsapp",
        "tablet",
        "sms",
      ],
      response_workflow_status: [
        "monitor_only",
        "branch_followup",
        "controlled_investigation",
        "immediate_escalation",
      ],
      signature_layout: ["horizontal", "vertical", "minimal", "branded"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "archived",
      ],
      survey_status: ["draft", "active", "archived"],
      survey_type: ["generic", "fresh_produce"],
      verification_status: [
        "pending",
        "accepted",
        "rejected",
        "more_evidence_required",
      ],
    },
  },
} as const
