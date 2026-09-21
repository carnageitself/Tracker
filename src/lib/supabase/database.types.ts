/**
 * Hand-maintained to match supabase/migrations/0001_init.sql.
 * Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type LeadSource = "manual" | "google" | "calendly";

export type LeadRow = {
  id: string;
  owner_id: string;
  full_name: string;
  phone: string;
  email: string;
  source: LeadSource;
  /** Provider event id; keeps re-imports idempotent. Null for manual leads. */
  external_id: string | null;
  lead_date: string;
  follow_up: string | null;
  mg1: string | null;
  mg2: string | null;
  meet_in_person: string | null;
  pv: string | null;
  pv_amount: number;
  starter_pack: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type LeadInsert = Omit<LeadRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type LeadUpdate = Partial<LeadInsert>;

export type ProfileRow = {
  id: string;
  email: string;
  created_at: string;
};

export type ListShareRow = {
  owner_id: string;
  shared_with_id: string;
  can_edit: boolean;
  created_at: string;
};

export type CalendarProvider = "google" | "calendly";

export type CalendarConnectionRow = {
  user_id: string;
  provider: CalendarProvider;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  account_email: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: { id: string; email: string; created_at?: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      list_shares: {
        Row: ListShareRow;
        Insert: {
          owner_id: string;
          shared_with_id: string;
          can_edit?: boolean;
          created_at?: string;
        };
        Update: Partial<ListShareRow>;
        Relationships: [];
      };
      calendar_connections: {
        Row: CalendarConnectionRow;
        Insert: Partial<CalendarConnectionRow> & {
          user_id: string;
          provider: CalendarProvider;
        };
        Update: Partial<CalendarConnectionRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      share_list_with_email: {
        Args: { target_email: string; allow_edit?: boolean };
        Returns: void;
      };
      can_view_list: { Args: { list_owner: string }; Returns: boolean };
      can_edit_list: { Args: { list_owner: string }; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
