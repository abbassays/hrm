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
      bank_details: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          created_at: string
          employee_id: string
          iban: string | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          employee_id: string
          iban?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          employee_id?: string
          iban?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_details_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          employee_id: string
          file_name: string
          id: string
          is_active: boolean
          note: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          employee_id: string
          file_name: string
          id?: string
          is_active?: boolean
          note?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          employee_id?: string
          file_name?: string
          id?: string
          is_active?: boolean
          note?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          doc_type: string
          employee_id: string
          file_name: string | null
          id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          doc_type: string
          employee_id: string
          file_name?: string | null
          id?: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          doc_type?: string
          employee_id?: string
          file_name?: string | null
          id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          accepted_at: string | null
          account_status: Database["public"]["Enums"]["account_status"]
          activated_at: string | null
          address: string | null
          city: string | null
          cnic: string | null
          consent_at: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          emergency_contact: string | null
          full_name: string | null
          id: string
          invited_at: string | null
          phone: string | null
          postal_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          account_status?: Database["public"]["Enums"]["account_status"]
          activated_at?: string | null
          address?: string | null
          city?: string | null
          cnic?: string | null
          consent_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          emergency_contact?: string | null
          full_name?: string | null
          id: string
          invited_at?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          account_status?: Database["public"]["Enums"]["account_status"]
          activated_at?: string | null
          address?: string | null
          city?: string | null
          cnic?: string | null
          consent_at?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          emergency_contact?: string | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          phone?: string | null
          postal_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      employment_details: {
        Row: {
          base_salary: number | null
          created_at: string
          department: string | null
          designation: string | null
          employee_id: string
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          leave_pool_days_override: number | null
          medical_accrual_monthly_override: number | null
          medical_cap_override: number | null
          ot_multiplier_override: number | null
          updated_at: string
          working_hours: number | null
        }
        Insert: {
          base_salary?: number | null
          created_at?: string
          department?: string | null
          designation?: string | null
          employee_id: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          leave_pool_days_override?: number | null
          medical_accrual_monthly_override?: number | null
          medical_cap_override?: number | null
          ot_multiplier_override?: number | null
          updated_at?: string
          working_hours?: number | null
        }
        Update: {
          base_salary?: number | null
          created_at?: string
          department?: string | null
          designation?: string | null
          employee_id?: string
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          leave_pool_days_override?: number | null
          medical_accrual_monthly_override?: number | null
          medical_cap_override?: number | null
          ot_multiplier_override?: number | null
          updated_at?: string
          working_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_details_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          num_days: number
          reason: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          num_days: number
          reason: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          num_days?: number
          reason?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_claim_files: {
        Row: {
          claim_id: string
          file_name: string | null
          id: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          claim_id: string
          file_name?: string | null
          id?: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          claim_id?: string
          file_name?: string | null
          id?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_claim_files_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "medical_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_claims: {
        Row: {
          amount: number
          claim_for: Database["public"]["Enums"]["medical_for"]
          created_at: string
          description: string
          employee_id: string
          expense_date: string
          id: string
          payroll_run_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          claim_for: Database["public"]["Enums"]["medical_for"]
          created_at?: string
          description: string
          employee_id: string
          expense_date: string
          id?: string
          payroll_run_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          claim_for?: Database["public"]["Enums"]["medical_for"]
          created_at?: string
          description?: string
          employee_id?: string
          expense_date?: string
          id?: string
          payroll_run_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_claims_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_claims_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_claims_run_fk"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_email_template: {
        Row: {
          body_html: string
          id: boolean
          subject: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_html: string
          id?: boolean
          subject: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_html?: string
          id?: boolean
          subject?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_email_template_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_logs: {
        Row: {
          created_at: string
          employee_id: string
          hours: number
          id: string
          payroll_run_id: string | null
          project_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          task: string
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          hours: number
          id?: string
          payroll_run_id?: string | null
          project_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          task: string
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          hours?: number
          id?: string
          payroll_run_id?: string | null
          project_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          task?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_logs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_logs_run_fk"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_exports: {
        Row: {
          exported_at: string
          exported_by: string | null
          file_path: string | null
          id: string
          run_id: string
        }
        Insert: {
          exported_at?: string
          exported_by?: string | null
          file_path?: string | null
          id?: string
          run_id: string
        }
        Update: {
          exported_at?: string
          exported_by?: string | null
          file_path?: string | null
          id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_exports_exported_by_fkey"
            columns: ["exported_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_exports_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          days_in_month: number
          id: string
          locked_at: string | null
          locked_by: string | null
          period_month: string
          status: Database["public"]["Enums"]["payroll_status"]
          total_payroll: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_in_month: number
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          period_month: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_payroll?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_in_month?: number
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          period_month?: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_payroll?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          id: boolean
          leave_pool_days: number
          medical_accrual_monthly: number
          medical_cap: number
          ot_multiplier_default: number
          tax_rate_percent: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          leave_pool_days?: number
          medical_accrual_monthly?: number
          medical_cap?: number
          ot_multiplier_default?: number
          tax_rate_percent?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          leave_pool_days?: number
          medical_accrual_monthly?: number
          medical_cap?: number
          ot_multiplier_default?: number
          tax_rate_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      payslips: {
        Row: {
          base_salary: number
          created_at: string
          currency_balance: string | null
          custom_fields: Json
          days_in_month: number
          days_worked: number
          designation: string | null
          employee_id: string
          id: string
          medical: number
          notification_attempts: number
          notification_last_error: string | null
          notification_sent_at: string | null
          notification_status: Database["public"]["Enums"]["notification_status"]
          overtime_hours: number
          overtime_hours_override: number | null
          overtime_multiplier: number | null
          overtime_pay: number
          overtime_rate: number
          payroll_run_id: string
          period_month: string
          tax_deduction: number
          total_base: number
          total_pay: number
          unpaid_leave_days: number
        }
        Insert: {
          base_salary: number
          created_at?: string
          currency_balance?: string | null
          custom_fields?: Json
          days_in_month: number
          days_worked: number
          designation?: string | null
          employee_id: string
          id?: string
          medical?: number
          notification_attempts?: number
          notification_last_error?: string | null
          notification_sent_at?: string | null
          notification_status?: Database["public"]["Enums"]["notification_status"]
          overtime_hours?: number
          overtime_hours_override?: number | null
          overtime_multiplier?: number | null
          overtime_pay?: number
          overtime_rate?: number
          payroll_run_id: string
          period_month: string
          tax_deduction?: number
          total_base: number
          total_pay: number
          unpaid_leave_days?: number
        }
        Update: {
          base_salary?: number
          created_at?: string
          currency_balance?: string | null
          custom_fields?: Json
          days_in_month?: number
          days_worked?: number
          designation?: string | null
          employee_id?: string
          id?: string
          medical?: number
          notification_attempts?: number
          notification_last_error?: string | null
          notification_sent_at?: string | null
          notification_status?: Database["public"]["Enums"]["notification_status"]
          overtime_hours?: number
          overtime_hours_override?: number | null
          overtime_multiplier?: number | null
          overtime_pay?: number
          overtime_rate?: number
          payroll_run_id?: string
          period_month?: string
          tax_deduction?: number
          total_base?: number
          total_pay?: number
          unpaid_leave_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          category: Database["public"]["Enums"]["policy_category"]
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["policy_category"]
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["policy_category"]
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      policy_acknowledgments: {
        Row: {
          acknowledged_at: string
          employee_id: string
          id: string
          policy_version_id: string
        }
        Insert: {
          acknowledged_at?: string
          employee_id: string
          id?: string
          policy_version_id: string
        }
        Update: {
          acknowledged_at?: string
          employee_id?: string
          id?: string
          policy_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgments_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_reconciliations: {
        Row: {
          policy_id: string
          reconciled_at: string
          reconciled_by: string | null
          reconciled_version_id: string
        }
        Insert: {
          policy_id: string
          reconciled_at?: string
          reconciled_by?: string | null
          reconciled_version_id: string
        }
        Update: {
          policy_id?: string
          reconciled_at?: string
          reconciled_by?: string | null
          reconciled_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_reconciliations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: true
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_reconciliations_reconciled_by_fkey"
            columns: ["reconciled_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_reconciliations_reconciled_version_id_fkey"
            columns: ["reconciled_version_id"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_versions: {
        Row: {
          body_html: string
          id: string
          is_active: boolean
          policy_id: string
          published_at: string
          version: number
        }
        Insert: {
          body_html: string
          id?: string
          is_active?: boolean
          policy_id: string
          published_at?: string
          version: number
        }
        Update: {
          body_html?: string
          id?: string
          is_active?: boolean
          policy_id?: string
          published_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          tech_stack: string[]
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          tech_stack?: string[]
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          tech_stack?: string[]
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      socials: {
        Row: {
          created_at: string
          employee_id: string
          github_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          github_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          github_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "socials_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          id: boolean
          reimbursements_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          reimbursements_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          reimbursements_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_onboarding: { Args: never; Returns: undefined }
      calculate_payroll: { Args: { p_run_id: string }; Returns: undefined }
      create_policy: {
        Args: {
          p_body_html: string
          p_category: Database["public"]["Enums"]["policy_category"]
          p_title: string
        }
        Returns: {
          category: Database["public"]["Enums"]["policy_category"]
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "policies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dashboard_summary: { Args: never; Returns: Json }
      employees_by_status: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      employees_near_medical_cap: {
        Args: { threshold?: number }
        Returns: {
          employee_id: string
          full_name: string
          spent: number
        }[]
      }
      ensure_current_run: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      leave_balance: {
        Args: { p_employee: string; p_year?: number }
        Returns: {
          pool_total: number
          remaining: number
          used: number
        }[]
      }
      leave_balances_all: {
        Args: { year?: number }
        Returns: {
          employee_id: string
          full_name: string
          pool: number
          remaining: number
          used: number
        }[]
      }
      lock_payroll: { Args: { p_run_id: string }; Returns: undefined }
      medical_balance: {
        Args: { p_employee: string }
        Returns: {
          accrued: number
          available: number
          cap: number
          monthly_accrual: number
          spent: number
        }[]
      }
      payroll_cycle_cost: { Args: { run_id: string }; Returns: number }
      pending_approvals: {
        Args: never
        Returns: {
          amount: number
          employee_id: string
          employee_name: string
          item_id: string
          kind: string
          submitted_at: string
          summary: string
        }[]
      }
      policy_compliance: {
        Args: never
        Returns: {
          acknowledged: boolean
          acknowledged_at: string
          employee_id: string
          full_name: string
          policy_id: string
          policy_version_id: string
          title: string
          version: number
        }[]
      }
      publish_policy_version: {
        Args: { p_body_html: string; p_policy_id: string }
        Returns: {
          body_html: string
          id: string
          is_active: boolean
          policy_id: string
          published_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "policy_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_is_locked: { Args: { p_run_id: string }; Returns: boolean }
      submit_onboarding: { Args: never; Returns: undefined }
      unlock_payroll: { Args: { p_run_id: string }; Returns: undefined }
      upload_contract: {
        Args: {
          p_employee_id: string
          p_file_name: string
          p_note?: string
          p_storage_path: string
        }
        Returns: {
          employee_id: string
          file_name: string
          id: string
          is_active: boolean
          note: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "contracts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_status: "invited" | "onboarding" | "active"
      employment_type: "full_time" | "part_time" | "contract" | "internship"
      leave_type: "paid" | "sick" | "unpaid" | "half_day"
      medical_for: "self" | "parent" | "spouse" | "child"
      notification_status: "pending" | "sent" | "failed"
      payroll_status: "open" | "locked"
      policy_category: "leave" | "medical" | "overtime" | "general"
      request_status: "pending" | "approved" | "rejected"
      service_type:
        | "consultation"
        | "hospitalization"
        | "medication"
        | "lab_diagnostics"
        | "emergency"
        | "dental"
        | "vision"
      user_role: "admin" | "employee"
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
      account_status: ["invited", "onboarding", "active"],
      employment_type: ["full_time", "part_time", "contract", "internship"],
      leave_type: ["paid", "sick", "unpaid", "half_day"],
      medical_for: ["self", "parent", "spouse", "child"],
      notification_status: ["pending", "sent", "failed"],
      payroll_status: ["open", "locked"],
      policy_category: ["leave", "medical", "overtime", "general"],
      request_status: ["pending", "approved", "rejected"],
      service_type: [
        "consultation",
        "hospitalization",
        "medication",
        "lab_diagnostics",
        "emergency",
        "dental",
        "vision",
      ],
      user_role: ["admin", "employee"],
    },
  },
} as const
