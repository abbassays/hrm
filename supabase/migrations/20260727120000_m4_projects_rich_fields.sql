-- Add rich fields to the overtime projects table.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tech_stack TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS url TEXT;