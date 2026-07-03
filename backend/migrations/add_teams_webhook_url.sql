-- Add Power Automate webhook URL per team (Teams group chat notifications)
ALTER TABLE teams
  ADD COLUMN teams_webhook_url VARCHAR(2048) NULL DEFAULT NULL
  COMMENT 'Power Automate HTTP webhook URL for this team''s Teams group chat';
