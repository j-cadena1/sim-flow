-- Seed Analytics Data with 90 days of historical requests
-- This creates realistic simulation requests with various statuses, priorities, and time tracking

-- First, let's create some additional projects for variety
INSERT INTO projects (code, name, total_hours, used_hours, status, created_by, created_by_name)
VALUES
  ('AERO-001', 'Aerodynamics Simulation Package', 500, 320, 'Approved', 'b655b96e-50cb-43c2-af6d-89059b1e98bf', 'Charlie Engineer'),
  ('THERM-002', 'Thermal Analysis Suite', 400, 280, 'Approved', 'b655b96e-50cb-43c2-af6d-89059b1e98bf', 'Charlie Engineer'),
  ('STRUCT-003', 'Structural Integrity Tests', 600, 450, 'Approved', 'b655b96e-50cb-43c2-af6d-89059b1e98bf', 'Charlie Engineer'),
  ('CFD-004', 'Computational Fluid Dynamics', 800, 720, 'Approved', 'b655b96e-50cb-43c2-af6d-89059b1e98bf', 'Charlie Engineer'),
  ('CRASH-005', 'Crash Test Simulations', 350, 180, 'Approved', 'b655b96e-50cb-43c2-af6d-89059b1e98bf', 'Charlie Engineer')
ON CONFLICT (code) DO NOTHING;

-- Create historical requests over the past 90 days
-- Week 1 (85-90 days ago) - 5 requests
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Wing Stress Analysis - Boeing 787',
  'Detailed stress analysis for wing structure under various load conditions',
  'Boeing',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'STRUCT-003' LIMIT 1),
  40,
  NOW() - INTERVAL '88 days',
  NOW() - INTERVAL '82 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Wing Stress Analysis - Boeing 787');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Airflow Optimization - Airbus A350',
  'CFD simulation for airflow optimization around fuselage',
  'Airbus',
  'Medium',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'CFD-004' LIMIT 1),
  60,
  NOW() - INTERVAL '87 days',
  NOW() - INTERVAL '80 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Airflow Optimization - Airbus A350');

-- Week 2-3 (70-85 days ago) - 8 requests
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Engine Mount Vibration Analysis',
  'Analyze vibration patterns in engine mounting systems',
  'GE Aviation',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'STRUCT-003' LIMIT 1),
  80,
  NOW() - INTERVAL '82 days',
  NOW() - INTERVAL '75 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Engine Mount Vibration Analysis');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Cabin Pressure Distribution Study',
  'Simulate cabin pressure distribution during flight',
  'Boeing',
  'Medium',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'AERO-001' LIMIT 1),
  35,
  NOW() - INTERVAL '78 days',
  NOW() - INTERVAL '72 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Cabin Pressure Distribution Study');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Heat Dissipation in Avionics Bay',
  'Thermal analysis for electronics cooling systems',
  'Honeywell',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'THERM-002' LIMIT 1),
  50,
  NOW() - INTERVAL '76 days',
  NOW() - INTERVAL '68 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Heat Dissipation in Avionics Bay');

-- Week 4-6 (55-70 days ago) - 12 requests
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Landing Gear Impact Simulation',
  'Simulate landing gear impact forces during touchdown',
  'Boeing',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'CRASH-005' LIMIT 1),
  70,
  NOW() - INTERVAL '68 days',
  NOW() - INTERVAL '58 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Landing Gear Impact Simulation');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Fuel Tank Sloshing Analysis',
  'CFD analysis of fuel movement in wing tanks',
  'Airbus',
  'Medium',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'CFD-004' LIMIT 1),
  45,
  NOW() - INTERVAL '65 days',
  NOW() - INTERVAL '55 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Fuel Tank Sloshing Analysis');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Turbine Blade Stress Test',
  'High-cycle fatigue analysis for turbine blades',
  'Rolls-Royce',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'STRUCT-003' LIMIT 1),
  90,
  NOW() - INTERVAL '62 days',
  NOW() - INTERVAL '50 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Turbine Blade Stress Test');

-- Week 7-9 (40-55 days ago) - 10 requests
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Wing De-icing System Performance',
  'Thermal simulation of wing de-icing effectiveness',
  'Boeing',
  'Medium',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'THERM-002' LIMIT 1),
  38,
  NOW() - INTERVAL '52 days',
  NOW() - INTERVAL '45 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Wing De-icing System Performance');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Cargo Door Seal Pressure Test',
  'Pressure differential analysis for cargo door seals',
  'Airbus',
  'Low',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'AERO-001' LIMIT 1),
  25,
  NOW() - INTERVAL '48 days',
  NOW() - INTERVAL '42 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Cargo Door Seal Pressure Test');

-- Week 10-12 (25-40 days ago) - 15 requests (busy period)
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Composite Panel Fatigue Testing',
  'Long-term fatigue analysis of composite fuselage panels',
  'Boeing',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'STRUCT-003' LIMIT 1),
  65,
  NOW() - INTERVAL '38 days',
  NOW() - INTERVAL '28 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Composite Panel Fatigue Testing');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Nacelle Airflow Optimization',
  'CFD optimization for engine nacelle aerodynamics',
  'GE Aviation',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'CFD-004' LIMIT 1),
  75,
  NOW() - INTERVAL '35 days',
  NOW() - INTERVAL '25 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Nacelle Airflow Optimization');

-- Recent completed requests (10-25 days ago)
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Hydraulic System Pressure Analysis',
  'Simulate hydraulic pressure distribution in flight control systems',
  'Honeywell',
  'Medium',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'AERO-001' LIMIT 1),
  42,
  NOW() - INTERVAL '22 days',
  NOW() - INTERVAL '15 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Hydraulic System Pressure Analysis');

INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Emergency Slide Deployment Simulation',
  'Crash simulation for emergency slide deployment',
  'Boeing',
  'High',
  'Completed',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'CRASH-005' LIMIT 1),
  55,
  NOW() - INTERVAL '18 days',
  NOW() - INTERVAL '10 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Emergency Slide Deployment Simulation');

-- Currently in progress (no completion date)
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Cockpit Window Bird Strike Test',
  'Impact simulation for cockpit windows during bird strike',
  'Airbus',
  'High',
  'In Progress',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'CRASH-005' LIMIT 1),
  50,
  NOW() - INTERVAL '8 days',
  NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Cockpit Window Bird Strike Test');

-- Add time tracking entries for completed requests (realistic hours)
INSERT INTO time_entries (request_id, engineer_id, engineer_name, hours, description, created_at)
SELECT
  r.id,
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  CASE
    WHEN r.priority = 'High' THEN r.allocated_hours * 1.05     -- Slightly over
    WHEN r.priority = 'Medium' THEN r.allocated_hours * 0.95   -- Under budget
    ELSE r.allocated_hours * 0.85                              -- Well under
  END,
  'Simulation execution and analysis completed',
  r.updated_at
FROM requests r
WHERE r.status = 'Completed'
  AND NOT EXISTS (
    SELECT 1 FROM time_entries te WHERE te.request_id = r.id
  );

-- Add some pending review requests
INSERT INTO requests (title, description, vendor, priority, status, created_by, created_by_name, assigned_to, assigned_to_name, project_id, allocated_hours, created_at, updated_at)
SELECT
  'Flap Mechanism Load Analysis',
  'Structural analysis of wing flap deployment mechanism',
  'Boeing',
  'Medium',
  'Engineering Review',
  'fa64b75b-f65c-4128-88a3-82a0b4ab0f9c',
  'Alice User',
  'b655b96e-50cb-43c2-af6d-89059b1e98bf',
  'Charlie Engineer',
  (SELECT id FROM projects WHERE code = 'STRUCT-003' LIMIT 1),
  45,
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM requests WHERE title = 'Flap Mechanism Load Analysis');

-- Summary
SELECT
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN status = 'Engineering Review' THEN 1 END) as pending_review
FROM requests;
