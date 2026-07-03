/*
  # Initial Schema for Project Management System

  1. New Tables
    - `profiles` - User profiles with skills and roles
    - `categories` - Project categories (eLearning Design, Curriculum Design, etc.)
    - `skills` - Available skills (Content Writers, Developers, etc.)
    - `projects` - Main projects table
    - `stages` - Project stages with hierarchy support
    - `review_rounds` - Review rounds for stages
    - `tasks` - Tasks assigned to team members
    - `team_allocations` - Team member allocations to projects/tasks
    - `user_skills` - Many-to-many relationship between users and skills

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
    - Add policies for team-based access control
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid REFERENCES auth.users(id) PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create skills table
CREATE TABLE IF NOT EXISTS skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create user_skills junction table
CREATE TABLE IF NOT EXISTS user_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id),
  status text DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on-hold', 'completed', 'cancelled')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_by uuid REFERENCES profiles(id),
  parent_id uuid REFERENCES projects(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project_members junction table
CREATE TABLE IF NOT EXISTS project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create stages table
CREATE TABLE IF NOT EXISTS stages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  parent_stage_id uuid REFERENCES stages(id),
  order_index integer DEFAULT 0,
  status text DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'under-review', 'completed')),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create review_rounds table
CREATE TABLE IF NOT EXISTS review_rounds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'approved', 'rejected')),
  start_date date,
  end_date date,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create review_round_reviewers junction table
CREATE TABLE IF NOT EXISTS review_round_reviewers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  review_round_id uuid REFERENCES review_rounds(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_round_id, reviewer_id)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  stage_id uuid REFERENCES stages(id) ON DELETE CASCADE,
  status text DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'under-review', 'completed', 'blocked')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  estimated_hours integer DEFAULT 0,
  actual_hours integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create task_assignees junction table
CREATE TABLE IF NOT EXISTS task_assignees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, assignee_id)
);

-- Create task_skills junction table
CREATE TABLE IF NOT EXISTS task_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES skills(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, skill_id)
);

-- Create team_allocations table
CREATE TABLE IF NOT EXISTS team_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  hours_per_day numeric(4,2) DEFAULT 8.00,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default categories
INSERT INTO categories (name, description, is_default) VALUES
  ('eLearning Design', 'Interactive online learning content and courses', true),
  ('Curriculum Design', 'Educational curriculum and instructional materials', true),
  ('IT Applications', 'Software development and technical solutions', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default skills
INSERT INTO skills (name, description, is_default) VALUES
  ('Content Writers', 'Creating written educational and marketing content', true),
  ('Instructional Designers', 'Designing effective learning experiences', true),
  ('Graphic Designers', 'Visual design and creative assets', true),
  ('Developers', 'Software development and programming', true),
  ('Animators', 'Animation and motion graphics', true),
  ('Tech', 'Technical support and system administration', true),
  ('Sales', 'Sales and business development', true),
  ('Marketing', 'Marketing and promotional activities', true),
  ('QA', 'Quality assurance and testing', true)
ON CONFLICT (name) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_round_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_allocations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Categories policies (public read, authenticated users can add)
CREATE POLICY "Anyone can read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert categories" ON categories FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Skills policies (public read, authenticated users can add)
CREATE POLICY "Anyone can read skills" ON skills FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert skills" ON skills FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- User skills policies
CREATE POLICY "Users can manage own skills" ON user_skills FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can read all user skills" ON user_skills FOR SELECT USING (true);

-- Projects policies
CREATE POLICY "Users can read projects they're members of" ON projects FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = projects.id
  ) OR auth.uid() = created_by
);
CREATE POLICY "Project members can update projects" ON projects FOR UPDATE USING (
  auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = projects.id
  ) OR auth.uid() = created_by
);
CREATE POLICY "Authenticated users can create projects" ON projects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Project members policies
CREATE POLICY "Project members can read project membership" ON project_members FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM project_members pm WHERE pm.project_id = project_members.project_id
  )
);
CREATE POLICY "Project owners can manage members" ON project_members FOR ALL USING (
  auth.uid() IN (
    SELECT created_by FROM projects WHERE id = project_id
  ) OR auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = project_members.project_id AND role IN ('owner', 'manager')
  )
);

-- Stages policies
CREATE POLICY "Project members can read stages" ON stages FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = stages.project_id
  )
);
CREATE POLICY "Project members can manage stages" ON stages FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = stages.project_id
  )
);

-- Review rounds policies
CREATE POLICY "Project members can read review rounds" ON review_rounds FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    WHERE s.id = review_rounds.stage_id
  )
);
CREATE POLICY "Project members can manage review rounds" ON review_rounds FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    WHERE s.id = review_rounds.stage_id
  )
);

-- Review round reviewers policies
CREATE POLICY "Reviewers can read their assignments" ON review_round_reviewers FOR SELECT USING (
  auth.uid() = reviewer_id OR auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    JOIN review_rounds rr ON rr.stage_id = s.id
    WHERE rr.id = review_round_reviewers.review_round_id
  )
);
CREATE POLICY "Project members can manage reviewers" ON review_round_reviewers FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    JOIN review_rounds rr ON rr.stage_id = s.id
    WHERE rr.id = review_round_reviewers.review_round_id
  )
);

-- Tasks policies
CREATE POLICY "Users can read tasks they're assigned to or project members" ON tasks FOR SELECT USING (
  auth.uid() IN (SELECT assignee_id FROM task_assignees WHERE task_id = tasks.id) OR
  auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    WHERE s.id = tasks.stage_id
  )
);
CREATE POLICY "Project members can manage tasks" ON tasks FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    WHERE s.id = tasks.stage_id
  )
);

-- Task assignees policies
CREATE POLICY "Users can read task assignments" ON task_assignees FOR SELECT USING (
  auth.uid() = assignee_id OR auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    JOIN tasks t ON t.stage_id = s.id
    WHERE t.id = task_assignees.task_id
  )
);
CREATE POLICY "Project members can manage task assignments" ON task_assignees FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    JOIN tasks t ON t.stage_id = s.id
    WHERE t.id = task_assignees.task_id
  )
);

-- Task skills policies
CREATE POLICY "Users can read task skills" ON task_skills FOR SELECT USING (true);
CREATE POLICY "Project members can manage task skills" ON task_skills FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM project_members pm 
    JOIN stages s ON s.project_id = pm.project_id 
    JOIN tasks t ON t.stage_id = s.id
    WHERE t.id = task_skills.task_id
  )
);

-- Team allocations policies
CREATE POLICY "Users can read their allocations" ON team_allocations FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = team_allocations.project_id
  )
);
CREATE POLICY "Project members can manage allocations" ON team_allocations FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = team_allocations.project_id
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_parent ON projects(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_stages_project ON stages(project_id);
CREATE INDEX IF NOT EXISTS idx_stages_parent ON stages(parent_stage_id);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(assignee_id);
CREATE INDEX IF NOT EXISTS idx_team_allocations_user ON team_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_team_allocations_project ON team_allocations(project_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stages_updated_at BEFORE UPDATE ON stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_review_rounds_updated_at BEFORE UPDATE ON review_rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_allocations_updated_at BEFORE UPDATE ON team_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();