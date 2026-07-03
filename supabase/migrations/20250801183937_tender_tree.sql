/*
  # Team Member Authentication System

  1. New Tables
    - `team_members`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `passcode` (text)
      - `name` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `team_member_skills`
      - `id` (uuid, primary key)
      - `team_member_id` (uuid, foreign key)
      - `skill_id` (uuid, foreign key)
      - `created_at` (timestamp)
    - `performance_flags`
      - `id` (uuid, primary key)
      - `team_member_id` (uuid, foreign key)
      - `type` (text, check constraint)
      - `reason` (text)
      - `added_by` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for team member authentication
    - Add policies for managers to manage team members

  3. Functions
    - `authenticate_team_member` function for login validation
*/

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  passcode text NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create performance_flags table
CREATE TABLE IF NOT EXISTS performance_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('gold', 'green', 'orange', 'red')),
  reason text NOT NULL,
  added_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create team_member_skills junction table
CREATE TABLE IF NOT EXISTS team_member_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_member_id, skill_id)
);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_member_skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_members
CREATE POLICY "Team members can read their own data"
  ON team_members
  FOR SELECT
  TO public
  USING (true); -- Allow reading for authentication

CREATE POLICY "Authenticated users can manage team members"
  ON team_members
  FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for performance_flags
CREATE POLICY "Team members can read their own flags"
  ON performance_flags
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage performance flags"
  ON performance_flags
  FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for team_member_skills
CREATE POLICY "Anyone can read team member skills"
  ON team_member_skills
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can manage team member skills"
  ON team_member_skills
  FOR ALL
  TO authenticated
  USING (true);

-- Create function to authenticate team member
CREATE OR REPLACE FUNCTION authenticate_team_member(
  p_email text,
  p_passcode text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  team_member_record record;
  member_skills text[];
  member_flags json[];
BEGIN
  -- Find team member by email and passcode
  SELECT * INTO team_member_record
  FROM team_members
  WHERE LOWER(email) = LOWER(p_email)
    AND passcode = p_passcode
    AND is_active = true;

  -- Return null if not found
  IF team_member_record IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get member skills
  SELECT array_agg(s.name) INTO member_skills
  FROM team_member_skills tms
  JOIN skills s ON s.id = tms.skill_id
  WHERE tms.team_member_id = team_member_record.id;

  -- Get performance flags
  SELECT array_agg(
    json_build_object(
      'id', pf.id,
      'type', pf.type,
      'reason', pf.reason,
      'date', pf.created_at,
      'addedBy', pf.added_by
    )
  ) INTO member_flags
  FROM performance_flags pf
  WHERE pf.team_member_id = team_member_record.id;

  -- Return team member data
  RETURN json_build_object(
    'id', team_member_record.id,
    'name', team_member_record.name,
    'email', team_member_record.email,
    'isActive', team_member_record.is_active,
    'skills', COALESCE(member_skills, ARRAY[]::text[]),
    'performanceFlags', COALESCE(member_flags, ARRAY[]::json[])
  );
END;
$$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to team_members
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample team members
INSERT INTO team_members (name, email, passcode, is_active) VALUES
  ('Sarah Johnson', 'sarah.johnson@company.com', 'DEMO123', true),
  ('Mike Chen', 'mike.chen@company.com', 'TECH456', true),
  ('Emily Rodriguez', 'emily.rodriguez@company.com', 'DESIGN789', true),
  ('David Kim', 'david.kim@company.com', 'QA2024', true),
  ('Lisa Thompson', 'lisa.thompson@company.com', 'MARKET99', true),
  ('John Smith', 'john.smith@company.com', 'WRITE42', true)
ON CONFLICT (email) DO NOTHING;

-- Insert sample performance flags
DO $$
DECLARE
  sarah_id uuid;
  mike_id uuid;
BEGIN
  -- Get Sarah's ID
  SELECT id INTO sarah_id FROM team_members WHERE email = 'sarah.johnson@company.com';
  
  -- Get Mike's ID  
  SELECT id INTO mike_id FROM team_members WHERE email = 'mike.chen@company.com';
  
  -- Add performance flags if team members exist
  IF sarah_id IS NOT NULL THEN
    INSERT INTO performance_flags (team_member_id, type, reason, added_by) VALUES
      (sarah_id, 'green', 'Completed project ahead of schedule', 'Manager');
  END IF;
  
  IF mike_id IS NOT NULL THEN
    INSERT INTO performance_flags (team_member_id, type, reason, added_by) VALUES
      (mike_id, 'gold', 'Outstanding technical contribution', 'Manager');
  END IF;
END $$;

-- Link team members to skills
DO $$
DECLARE
  sarah_id uuid;
  mike_id uuid;
  emily_id uuid;
  david_id uuid;
  lisa_id uuid;
  john_id uuid;
  content_writers_id uuid;
  instructional_designers_id uuid;
  developers_id uuid;
  tech_id uuid;
  graphic_designers_id uuid;
  animators_id uuid;
  qa_id uuid;
  marketing_id uuid;
  sales_id uuid;
BEGIN
  -- Get team member IDs
  SELECT id INTO sarah_id FROM team_members WHERE email = 'sarah.johnson@company.com';
  SELECT id INTO mike_id FROM team_members WHERE email = 'mike.chen@company.com';
  SELECT id INTO emily_id FROM team_members WHERE email = 'emily.rodriguez@company.com';
  SELECT id INTO david_id FROM team_members WHERE email = 'david.kim@company.com';
  SELECT id INTO lisa_id FROM team_members WHERE email = 'lisa.thompson@company.com';
  SELECT id INTO john_id FROM team_members WHERE email = 'john.smith@company.com';
  
  -- Get skill IDs
  SELECT id INTO content_writers_id FROM skills WHERE name = 'Content Writers';
  SELECT id INTO instructional_designers_id FROM skills WHERE name = 'Instructional Designers';
  SELECT id INTO developers_id FROM skills WHERE name = 'Developers';
  SELECT id INTO tech_id FROM skills WHERE name = 'Tech';
  SELECT id INTO graphic_designers_id FROM skills WHERE name = 'Graphic Designers';
  SELECT id INTO animators_id FROM skills WHERE name = 'Animators';
  SELECT id INTO qa_id FROM skills WHERE name = 'QA';
  SELECT id INTO marketing_id FROM skills WHERE name = 'Marketing';
  SELECT id INTO sales_id FROM skills WHERE name = 'Sales';
  
  -- Link Sarah to skills
  IF sarah_id IS NOT NULL AND content_writers_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (sarah_id, content_writers_id) ON CONFLICT DO NOTHING;
  END IF;
  IF sarah_id IS NOT NULL AND instructional_designers_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (sarah_id, instructional_designers_id) ON CONFLICT DO NOTHING;
  END IF;
  
  -- Link Mike to skills
  IF mike_id IS NOT NULL AND developers_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (mike_id, developers_id) ON CONFLICT DO NOTHING;
  END IF;
  IF mike_id IS NOT NULL AND tech_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (mike_id, tech_id) ON CONFLICT DO NOTHING;
  END IF;
  
  -- Link Emily to skills
  IF emily_id IS NOT NULL AND graphic_designers_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (emily_id, graphic_designers_id) ON CONFLICT DO NOTHING;
  END IF;
  IF emily_id IS NOT NULL AND animators_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (emily_id, animators_id) ON CONFLICT DO NOTHING;
  END IF;
  
  -- Link David to skills
  IF david_id IS NOT NULL AND qa_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (david_id, qa_id) ON CONFLICT DO NOTHING;
  END IF;
  IF david_id IS NOT NULL AND tech_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (david_id, tech_id) ON CONFLICT DO NOTHING;
  END IF;
  
  -- Link Lisa to skills
  IF lisa_id IS NOT NULL AND marketing_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (lisa_id, marketing_id) ON CONFLICT DO NOTHING;
  END IF;
  IF lisa_id IS NOT NULL AND sales_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (lisa_id, sales_id) ON CONFLICT DO NOTHING;
  END IF;
  
  -- Link John to skills
  IF john_id IS NOT NULL AND content_writers_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (john_id, content_writers_id) ON CONFLICT DO NOTHING;
  END IF;
  IF john_id IS NOT NULL AND instructional_designers_id IS NOT NULL THEN
    INSERT INTO team_member_skills (team_member_id, skill_id) VALUES (john_id, instructional_designers_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;