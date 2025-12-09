-- Add password column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Update existing users with default passwords (hashed with bcrypt, salt rounds: 10)
-- qAdmin: admin123
UPDATE users SET password_hash = '$2b$10$oTh9EogqkPkBWT.9Y0hEKOfW5Wfe2RdfTsucyJizYk1cN23VsY7ie' WHERE email = 'qadmin@sim-rq.local';

-- Alice (End-User): user123
UPDATE users SET password_hash = '$2b$10$lMDP35A/sQxhLCJbgVPGkOjPY9lRMUBMO7MzRRLHLkZJ2RX6e2mee' WHERE email = 'alice@sim-rq.local';

-- Bob (Manager): manager123
UPDATE users SET password_hash = '$2b$10$tNgQPQGmKIVU6E467EKbIed/1Kqbh.D99q/izl2yZ6DSZoqfqmmUS' WHERE email = 'bob@sim-rq.local';

-- Charlie (Engineer): engineer123
UPDATE users SET password_hash = '$2b$10$ZqaYJK.tKOidGRV0OsSGtu9lUCt7J4.sWRKe2Zq8K9JnHv9y04ghy' WHERE email = 'charlie@sim-rq.local';

-- Make password_hash required for new users
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
