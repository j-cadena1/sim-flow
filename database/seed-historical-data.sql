-- Seed Historical Data for SimRq
-- Generates 90 days of realistic simulation request data

-- Clear existing seed data (but preserve real users and SSO config)
DELETE FROM time_entries;
DELETE FROM comments;
DELETE FROM activity_log;
DELETE FROM discussion_requests;
DELETE FROM title_change_requests;
DELETE FROM requests;

-- Reset project used_hours
UPDATE projects SET used_hours = 0;

DO $$
DECLARE
    -- User IDs
    admin_id UUID;
    alice_id UUID;
    bob_id UUID;
    charlie_id UUID;
    james_id UUID;

    -- Project IDs
    mco_project_id UUID;
    wha_project_id UUID;
    qcr_project_id UUID;

    -- Request variables
    new_request_id UUID;
    request_title TEXT;
    request_desc TEXT;
    request_vendor TEXT;
    request_priority TEXT;
    request_status TEXT;
    request_hours INTEGER;
    request_date TIMESTAMP;
    time_entry_date TIMESTAMP;
    time_hours NUMERIC;

    -- Loop counters
    i INTEGER;
    j INTEGER;
    day_offset INTEGER;
    entries_per_request INTEGER;

    -- Arrays for generating data
    vendors TEXT[] := ARRAY['Fanuc', 'ABB', 'KUKA', 'Universal Robots', 'Yaskawa', 'Omron', 'Siemens', 'Rockwell'];
    titles_mco TEXT[] := ARRAY[
        'Cell Layout Optimization for Welding Station',
        'Robot Path Planning for Assembly Line',
        'Cycle Time Reduction Analysis',
        'Material Flow Simulation',
        'Ergonomic Assessment for Manual Station',
        'Quality Inspection Point Analysis',
        'Buffer Sizing Optimization',
        'Production Line Balancing'
    ];
    titles_wha TEXT[] := ARRAY[
        'AGV Route Optimization',
        'Pick and Place System Design',
        'Warehouse Layout Simulation',
        'Conveyor System Throughput Analysis',
        'Storage Rack Utilization Study',
        'Order Fulfillment Flow Optimization',
        'Automated Sorting System Design',
        'Inventory Movement Pattern Analysis'
    ];
    titles_qcr TEXT[] := ARRAY[
        'Vision System Accuracy Testing',
        'Defect Detection Algorithm Validation',
        'Inspection Cycle Time Analysis',
        'Robot Calibration Verification',
        'Measurement System Analysis',
        'Quality Gate Placement Study',
        'SPC Implementation Simulation',
        'Rework Station Design'
    ];
    descriptions TEXT[] := ARRAY[
        'Detailed analysis required to validate the proposed design changes and ensure production targets are met.',
        'Simulation study to evaluate multiple scenarios and identify the optimal configuration.',
        'Comprehensive review of the current setup with recommendations for improvement.',
        'Feasibility study to assess the technical viability and expected ROI.',
        'Performance validation to ensure the system meets specified requirements.',
        'Bottleneck identification and capacity analysis for the proposed layout.',
        'Throughput optimization study with sensitivity analysis on key parameters.',
        'Risk assessment and mitigation strategy development through simulation.'
    ];
    statuses TEXT[] := ARRAY['Submitted', 'Manager Review', 'Engineering Review', 'In Progress', 'Completed', 'Accepted'];
    priorities TEXT[] := ARRAY['Low', 'Medium', 'High'];
    time_descriptions TEXT[] := ARRAY[
        'Initial model setup and data collection',
        'Building simulation model',
        'Running scenarios and collecting data',
        'Analysis of simulation results',
        'Documentation and report writing',
        'Client meeting and review',
        'Model refinements based on feedback',
        'Final validation runs'
    ];

BEGIN
    -- Get user IDs
    SELECT id INTO admin_id FROM users WHERE email = 'qadmin@simflow.local';
    SELECT id INTO alice_id FROM users WHERE email = 'alice@simflow.local';
    SELECT id INTO bob_id FROM users WHERE email = 'bob@simflow.local';
    SELECT id INTO charlie_id FROM users WHERE email = 'charlie@simflow.local';
    SELECT id INTO james_id FROM users WHERE email = 'james@cadenalabs.ca';

    -- Get project IDs
    SELECT id INTO mco_project_id FROM projects WHERE code = '100001-2025';
    SELECT id INTO wha_project_id FROM projects WHERE code = '100002-2025';
    SELECT id INTO qcr_project_id FROM projects WHERE code = '100003-2025';

    -- Generate requests over the past 90 days
    FOR day_offset IN 0..90 LOOP
        -- Create 1-3 requests per day (weighted towards fewer)
        FOR i IN 1..(1 + floor(random() * 2)::INTEGER) LOOP
            -- Randomize request date within the day
            request_date := (CURRENT_DATE - day_offset * INTERVAL '1 day') +
                            (random() * INTERVAL '10 hours') + INTERVAL '8 hours';

            -- Choose project randomly
            CASE (random() * 3)::INTEGER
                WHEN 0 THEN
                    request_title := titles_mco[1 + (random() * (array_length(titles_mco, 1) - 1))::INTEGER];
                    new_request_id := uuid_generate_v4();
                    INSERT INTO requests (id, title, description, vendor, status, priority, created_by, created_by_name, assigned_to, assigned_to_name, estimated_hours, project_id, allocated_hours, created_at, updated_at)
                    VALUES (
                        new_request_id,
                        request_title || ' #' || (100 + day_offset * 3 + i),
                        descriptions[1 + (random() * (array_length(descriptions, 1) - 1))::INTEGER],
                        vendors[1 + (random() * (array_length(vendors, 1) - 1))::INTEGER],
                        CASE
                            WHEN day_offset > 60 THEN 'Completed'
                            WHEN day_offset > 45 THEN statuses[1 + (random() * 6)::INTEGER]
                            WHEN day_offset > 30 THEN statuses[1 + (random() * 5)::INTEGER]
                            WHEN day_offset > 14 THEN statuses[1 + (random() * 4)::INTEGER]
                            ELSE statuses[1 + (random() * 2)::INTEGER]
                        END,
                        priorities[1 + (random() * 2)::INTEGER],
                        CASE (random() * 3)::INTEGER WHEN 0 THEN alice_id WHEN 1 THEN bob_id ELSE james_id END,
                        CASE (random() * 3)::INTEGER WHEN 0 THEN 'Alice User' WHEN 1 THEN 'Bob Manager' ELSE 'James Cadena' END,
                        charlie_id,
                        'Charlie Engineer',
                        10 + (random() * 30)::INTEGER,
                        mco_project_id,
                        8 + (random() * 24)::INTEGER,
                        request_date,
                        request_date + (random() * (90 - day_offset) * INTERVAL '1 day')
                    );
                WHEN 1 THEN
                    request_title := titles_wha[1 + (random() * (array_length(titles_wha, 1) - 1))::INTEGER];
                    new_request_id := uuid_generate_v4();
                    INSERT INTO requests (id, title, description, vendor, status, priority, created_by, created_by_name, assigned_to, assigned_to_name, estimated_hours, project_id, allocated_hours, created_at, updated_at)
                    VALUES (
                        new_request_id,
                        request_title || ' #' || (200 + day_offset * 3 + i),
                        descriptions[1 + (random() * (array_length(descriptions, 1) - 1))::INTEGER],
                        vendors[1 + (random() * (array_length(vendors, 1) - 1))::INTEGER],
                        CASE
                            WHEN day_offset > 60 THEN 'Completed'
                            WHEN day_offset > 45 THEN statuses[1 + (random() * 6)::INTEGER]
                            WHEN day_offset > 30 THEN statuses[1 + (random() * 5)::INTEGER]
                            WHEN day_offset > 14 THEN statuses[1 + (random() * 4)::INTEGER]
                            ELSE statuses[1 + (random() * 2)::INTEGER]
                        END,
                        priorities[1 + (random() * 2)::INTEGER],
                        CASE (random() * 3)::INTEGER WHEN 0 THEN alice_id WHEN 1 THEN bob_id ELSE james_id END,
                        CASE (random() * 3)::INTEGER WHEN 0 THEN 'Alice User' WHEN 1 THEN 'Bob Manager' ELSE 'James Cadena' END,
                        charlie_id,
                        'Charlie Engineer',
                        10 + (random() * 30)::INTEGER,
                        wha_project_id,
                        8 + (random() * 24)::INTEGER,
                        request_date,
                        request_date + (random() * (90 - day_offset) * INTERVAL '1 day')
                    );
                ELSE
                    request_title := titles_qcr[1 + (random() * (array_length(titles_qcr, 1) - 1))::INTEGER];
                    new_request_id := uuid_generate_v4();
                    INSERT INTO requests (id, title, description, vendor, status, priority, created_by, created_by_name, assigned_to, assigned_to_name, estimated_hours, project_id, allocated_hours, created_at, updated_at)
                    VALUES (
                        new_request_id,
                        request_title || ' #' || (300 + day_offset * 3 + i),
                        descriptions[1 + (random() * (array_length(descriptions, 1) - 1))::INTEGER],
                        vendors[1 + (random() * (array_length(vendors, 1) - 1))::INTEGER],
                        CASE
                            WHEN day_offset > 60 THEN 'Completed'
                            WHEN day_offset > 45 THEN statuses[1 + (random() * 6)::INTEGER]
                            WHEN day_offset > 30 THEN statuses[1 + (random() * 5)::INTEGER]
                            WHEN day_offset > 14 THEN statuses[1 + (random() * 4)::INTEGER]
                            ELSE statuses[1 + (random() * 2)::INTEGER]
                        END,
                        priorities[1 + (random() * 2)::INTEGER],
                        CASE (random() * 3)::INTEGER WHEN 0 THEN alice_id WHEN 1 THEN bob_id ELSE james_id END,
                        CASE (random() * 3)::INTEGER WHEN 0 THEN 'Alice User' WHEN 1 THEN 'Bob Manager' ELSE 'James Cadena' END,
                        charlie_id,
                        'Charlie Engineer',
                        10 + (random() * 30)::INTEGER,
                        qcr_project_id,
                        8 + (random() * 24)::INTEGER,
                        request_date,
                        request_date + (random() * (90 - day_offset) * INTERVAL '1 day')
                    );
            END CASE;
        END LOOP;
    END LOOP;

    -- Generate time entries for completed and in-progress requests
    FOR new_request_id, request_date IN
        SELECT id, created_at FROM requests WHERE status IN ('Completed', 'In Progress', 'Engineering Review', 'Accepted')
    LOOP
        -- Add 2-6 time entries per request
        entries_per_request := 2 + (random() * 4)::INTEGER;
        FOR j IN 1..entries_per_request LOOP
            time_entry_date := request_date + (j * INTERVAL '1 day') + (random() * INTERVAL '8 hours');
            time_hours := 1 + (random() * 4)::NUMERIC(5,2);

            INSERT INTO time_entries (request_id, engineer_id, engineer_name, hours, description, created_at, updated_at)
            VALUES (
                new_request_id,
                charlie_id,
                'Charlie Engineer',
                time_hours,
                time_descriptions[1 + (random() * (array_length(time_descriptions, 1) - 1))::INTEGER],
                time_entry_date,
                time_entry_date
            );
        END LOOP;
    END LOOP;

    -- Update project used_hours based on allocated hours
    UPDATE projects p
    SET used_hours = COALESCE((
        SELECT SUM(allocated_hours)
        FROM requests r
        WHERE r.project_id = p.id
          AND r.status NOT IN ('Denied', 'Submitted')
    ), 0);

    RAISE NOTICE 'Seed data generation complete!';
    RAISE NOTICE 'Requests created: %', (SELECT COUNT(*) FROM requests);
    RAISE NOTICE 'Time entries created: %', (SELECT COUNT(*) FROM time_entries);
END $$;

-- Show summary
SELECT 'Requests by Status' as category, status, COUNT(*) as count
FROM requests
GROUP BY status
ORDER BY count DESC;

SELECT 'Requests by Project' as category, p.name, COUNT(*) as count
FROM requests r
JOIN projects p ON r.project_id = p.id
GROUP BY p.name
ORDER BY count DESC;

SELECT 'Time Entries by Month' as category, TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, SUM(hours)::INTEGER as total_hours
FROM time_entries
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY month;

SELECT 'Project Hour Usage' as category, name, code, total_hours, used_hours, (total_hours - used_hours) as available
FROM projects;
