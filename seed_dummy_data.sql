SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM interviews;
DELETE FROM interview_statuses;
DELETE FROM application_statuses;
DELETE FROM job_positions;
DELETE FROM users;
DELETE FROM departments;

ALTER TABLE interviews AUTO_INCREMENT = 1;
ALTER TABLE interview_statuses AUTO_INCREMENT = 1;
ALTER TABLE application_statuses AUTO_INCREMENT = 1;
ALTER TABLE job_positions AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE departments AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO departments (id, name, description, created_at, updated_at) VALUES
  (1, 'Admin', 'Administrator sistem recruitment', NOW(), NOW()),
  (2, 'Recruiter', 'Tim recruiter dan talent acquisition', NOW(), NOW()),
  (3, 'Interviewer', 'User interviewer dari tim teknis', NOW(), NOW()),
  (4, 'HR', 'Human resources dan people operations', NOW(), NOW()),
  (5, 'Engineering', 'Tim engineering pemilik lowongan teknis', NOW(), NOW());

INSERT INTO users (id, department_id, full_name, email, password_hash, is_active, created_at, updated_at) VALUES
  (1, 1, 'Super Admin', 'admin@briinternal.local', '$2y$10$dummyhashadmin', 1, NOW(), NOW()),
  (2, 2, 'Sylvia Sylvia', 'sylvia@briinternal.local', '$2y$10$dummyhashsylvia', 1, NOW(), NOW()),
  (3, 2, 'Jessica Adelia', 'jessica@briinternal.local', '$2y$10$dummyhashjessica', 1, NOW(), NOW()),
  (4, 3, 'Mochamad Sumaryo', 'sumaryo@briinternal.local', '$2y$10$dummyhashsumaryo', 1, NOW(), NOW()),
  (5, 3, 'Dito Pratama', 'dito@briinternal.local', '$2y$10$dummyhashdito', 1, NOW(), NOW()),
  (6, 4, 'Indriana Putri', 'indriana@briinternal.local', '$2y$10$dummyhashindriana', 1, NOW(), NOW()),
  (7, 5, 'Adva Nugraha', 'adva@briinternal.local', '$2y$10$dummyhashadva', 1, NOW(), NOW());

INSERT INTO job_positions (id, department_id, title, description, employment_type, `level`, is_active, created_at, updated_at) VALUES
  (1, 5, 'Backend Engineer', 'Mengembangkan API dan layanan internal recruitment', 'Full Time', 'Mid', 1, NOW(), NOW()),
  (2, 5, 'QA Engineer', 'Melakukan testing manual dan automation untuk aplikasi internal', 'Full Time', 'Junior', 1, NOW(), NOW()),
  (3, 5, 'Android Developer', 'Mengembangkan dan maintain aplikasi Android internal', 'Full Time', 'Mid', 1, NOW(), NOW()),
  (4, 5, 'Frontend Engineer', 'Mengembangkan dashboard recruitment berbasis web', 'Contract', 'Senior', 1, NOW(), NOW());

INSERT INTO application_statuses (id, code, name, description, sort_order, is_active, created_at, updated_at) VALUES
  (1, 'applied', 'Applied', 'Kandidat baru melamar', 1, 1, NOW(), NOW()),
  (2, 'screening', 'Screening', 'Sedang screening awal oleh recruiter', 2, 1, NOW(), NOW()),
  (3, 'interview', 'Interview', 'Sedang dalam proses interview', 3, 1, NOW(), NOW()),
  (4, 'offering', 'Offering', 'Sedang proses penawaran', 4, 1, NOW(), NOW()),
  (5, 'hired', 'Hired', 'Kandidat diterima', 5, 1, NOW(), NOW()),
  (6, 'rejected', 'Rejected', 'Kandidat ditolak', 6, 1, NOW(), NOW());

INSERT INTO interview_statuses (id, code, name, description, sort_order, is_active, created_at, updated_at) VALUES
  (1, 'scheduled', 'Scheduled', 'Interview sudah dijadwalkan', 1, 1, NOW(), NOW()),
  (2, 'on_process', 'On Process', 'Interview sedang berlangsung atau menunggu hasil', 2, 1, NOW(), NOW()),
  (3, 'passed', 'Passed', 'Kandidat lolos tahap interview', 3, 1, NOW(), NOW()),
  (4, 'failed', 'Failed', 'Kandidat tidak lolos tahap interview', 4, 1, NOW(), NOW()),
  (5, 'cancelled', 'Cancelled', 'Interview dibatalkan', 5, 1, NOW(), NOW()),
  (6, 'rescheduled', 'Rescheduled', 'Interview dijadwalkan ulang', 6, 1, NOW(), NOW());

INSERT INTO interviews (
  id,
  candidate_name,
  candidate_email,
  candidate_phone,
  job_position_id,
  pic_user_id,
  host_user_id,
  status_id,
  interview_type,
  scheduled_at,
  finished_at,
  meeting_link,
  interview_location,
  notes,
  created_at,
  updated_at
) VALUES
  (
    1,
    'Henry Daniel',
    'henry.daniel@mail.com',
    '081200000001',
    1,
    2,
    4,
    4,
    'Technical Interview',
    '2026-03-13 18:30:00',
    '2026-03-13 19:30:00',
    'https://meet.google.com/henry-backend',
    'Google Meet',
    'Candidate missed technical preparation.',
    NOW(),
    NOW()
  ),
  (
    2,
    'Sofyan Turtusi',
    'sofyan.turtusi@mail.com',
    '081200000002',
    2,
    2,
    7,
    2,
    'User Interview',
    '2026-03-13 10:00:00',
    '2026-03-13 11:00:00',
    'https://meet.google.com/sofyan-qa',
    'Google Meet',
    'Waiting for final feedback from user.',
    NOW(),
    NOW()
  ),
  (
    3,
    'Chelint Claudia',
    'chelint.claudia@mail.com',
    '081200000003',
    2,
    2,
    7,
    2,
    'Technical Interview',
    '2026-03-13 13:30:00',
    '2026-03-13 14:30:00',
    'https://meet.google.com/chelint-qa',
    'Google Meet',
    'Strong manual testing background.',
    NOW(),
    NOW()
  ),
  (
    4,
    'Oki Sultan',
    'oki.sultan@mail.com',
    '081200000004',
    3,
    3,
    5,
    2,
    'Technical Interview',
    '2026-03-13 14:00:00',
    '2026-03-13 15:00:00',
    'https://meet.google.com/oki-android',
    'Google Meet',
    'Need follow-up on coding exercise.',
    NOW(),
    NOW()
  ),
  (
    5,
    'Robert Andreas',
    'robert.andreas@mail.com',
    '081200000005',
    1,
    3,
    4,
    2,
    'HR Interview',
    '2026-03-13 16:00:00',
    '2026-03-13 16:45:00',
    'https://meet.google.com/robert-backend',
    'Google Meet',
    'Strong API design experience.',
    NOW(),
    NOW()
  ),
  (
    6,
    'Nadia Kirana',
    'nadia.kirana@mail.com',
    '081200000006',
    4,
    2,
    6,
    1,
    'Final Interview',
    '2026-03-18 09:00:00',
    NULL,
    'https://meet.google.com/nadia-frontend',
    'Google Meet',
    'Prepare portfolio review and stakeholder discussion.',
    NOW(),
    NOW()
  ),
  (
    7,
    'Fikri Ramadhan',
    'fikri.ramadhan@mail.com',
    '081200000007',
    1,
    3,
    4,
    6,
    'Technical Interview',
    '2026-03-19 13:00:00',
    NULL,
    'https://meet.google.com/fikri-backend',
    'Google Meet',
    'Candidate requested reschedule due to current employer meeting.',
    NOW(),
    NOW()
  ),
  (
    8,
    'Alya Putri',
    'alya.putri@mail.com',
    '081200000008',
    2,
    2,
    7,
    3,
    'User Interview',
    '2026-03-12 15:00:00',
    '2026-03-12 15:50:00',
    'https://meet.google.com/alya-qa',
    'Google Meet',
    'Passed. Ready to move to final decision.',
    NOW(),
    NOW()
  );
