-- Migration 0003: Seed 10 diverse local events for demo
-- created_by is intentionally NULL (no seed user required)

INSERT INTO events (title, description, location_name, start_time, end_time, capacity) VALUES
('Live Coding Workshop: React Hooks', 'Join us for a hands-on session on advanced React patterns and the latest hooks. Perfect for senior students.', 'CSUF TSU Pavilion - Room 201', CURRENT_TIMESTAMP + interval '2 hours', CURRENT_TIMESTAMP + interval '4 hours', 30),

('CSUF Basketball: Titans vs. Long Beach', 'Catch the live action at the stadium. Free for students with ID!', 'Titan Gym, Fullerton', CURRENT_TIMESTAMP + interval '5 hours', CURRENT_TIMESTAMP + interval '8 hours', 100),

('Algorithm Mastery Study Group', 'Preparing for technical interviews? Join our peer study group to solve LeetCode hards together.', 'Pollak Library, 4th Floor', CURRENT_TIMESTAMP + interval '2 days', CURRENT_TIMESTAMP + interval '2 days 2 hours', 15),

('Sunset Rooftop Yoga', 'A relaxing sunset yoga session for all skill levels. Bring your own mat and some water.', 'Downtown Fullerton - Sky Terrace', CURRENT_TIMESTAMP + interval '3 days 18 hours', CURRENT_TIMESTAMP + interval '3 days 20 hours', 25),

('Coffee & Career Chat: Tech Internships', 'Network with local alumni and get tips on landing your first internship in the industry.', 'Coffee Code, Fullerton', CURRENT_TIMESTAMP + interval '5 days 10 hours', CURRENT_TIMESTAMP + interval '5 days 12 hours', 40),

('Fullstack Development Hackathon', 'A 24-hour hackathon to build social impact apps. Prizes for best design and best backend.', 'Virtual - Zoom', CURRENT_TIMESTAMP + interval '7 days', CURRENT_TIMESTAMP + interval '8 days', 150),

('Acoustic Night: Local Artists', 'Come support local music talent at an intimate unplugged session in the village.', 'The Continental Room', CURRENT_TIMESTAMP + interval '10 days 19 hours', CURRENT_TIMESTAMP + interval '10 days 23 hours', 50),

('Intro to Blockchain & Web3', 'A beginner-friendly talk about decentralized finance and smart contracts.', 'Innovation Hub, Tech Park', CURRENT_TIMESTAMP + interval '14 days 14 hours', CURRENT_TIMESTAMP + interval '14 days 16 hours', 60),

('Weekly Hike: Fullerton Loop', 'Get some fresh air and exercise! Meeting at the trailhead for the 3-mile loop.', 'Fullerton Courthouse Trailhead', CURRENT_TIMESTAMP + interval '21 days 8 hours', CURRENT_TIMESTAMP + interval '21 days 11 hours', 20),

('End of Semester Pizza Party', 'Celebrate the end of the semester with free pizza and games. Everyone is welcome!', 'Student Union Lawn', CURRENT_TIMESTAMP + interval '30 days 12 hours', CURRENT_TIMESTAMP + interval '30 days 15 hours', 200);
