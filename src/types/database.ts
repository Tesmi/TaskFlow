export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProjectRole = 'admin' | 'member'
export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_by?: string
          created_at?: string
        }
      }
      project_members: {
        Row: {
          project_id: string
          user_id: string
          role: ProjectRole
          created_at: string
        }
        Insert: {
          project_id: string
          user_id: string
          role?: ProjectRole
          created_at?: string
        }
        Update: {
          project_id?: string
          user_id?: string
          role?: ProjectRole
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          status: TaskStatus
          assignee_id: string | null
          due_date: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          status?: TaskStatus
          assignee_id?: string | null
          due_date?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          status?: TaskStatus
          assignee_id?: string | null
          due_date?: string | null
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Enums: {
      project_role: ProjectRole
      task_status: TaskStatus
    }
  }
}
