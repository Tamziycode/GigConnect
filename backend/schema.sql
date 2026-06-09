create database gigconnect;
use gigconnect;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('CLIENT', 'WORKER') NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    title VARCHAR(100) NULL,
    location VARCHAR(255) NULL,
    lat DECIMAL(10,8) NULL,
    lng DECIMAL(11,8) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The index to speed up the location search
CREATE INDEX idx_role_location ON users (role, lat, lng);

CREATE TABLE jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    worker_id INT NULL,
    title VARCHAR(255) NOT NULL,
    job_description TEXT, 
    category VARCHAR(100),
    location VARCHAR(255),
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    budget DECIMAL(10,2) NOT NULL,
    job_status ENUM('OPEN', 'ASSIGNED', 'PAID', 'COMPLETED', 'DISPUTED', 'CANCELLED') DEFAULT 'OPEN',
    client_checkin BOOLEAN DEFAULT FALSE,
    worker_checkin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- In MySQL, you link the Foreign Keys down here
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE SET NULL
); 

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('HELD_IN_ESCROW', 'RELEASED', 'REFUNDED') DEFAULT 'HELD_IN_ESCROW',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    interswitch_ref VARCHAR(255) NULL,
    verified_at TIMESTAMP NULL, 

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    rating TINYINT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE price_index (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    category VARCHAR(255),
    location VARCHAR(255),
    agreed_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);


--Dummy data--

-- 1. INSERT USERS (2 Clients, 3 Workers)
INSERT INTO users (role, name, email, password_hash, title, location, lat, lng) VALUES 
('CLIENT', 'Alice Johnson', 'alice@email.com', 'hashed_pass', NULL, 'University of Ibadan, Oyo State', 7.44430000, 3.89950000),
('CLIENT', 'Bob Smith', 'bob@email.com', 'hashed_pass', NULL, 'Yaba, Lagos State', 6.50950000, 3.37110000),
('WORKER', 'Charlie The Plumber', 'charlie@email.com', 'hashed_pass', 'Plumber', 'Yaba, Lagos State', 6.50900000, 3.37100000),
('WORKER', 'Diana The Spark', 'diana@email.com', 'hashed_pass', 'Electrician', 'University of Ibadan, Oyo State', 7.44400000, 3.89900000),
('WORKER', 'Ethan Woodwork', 'ethan@email.com', 'hashed_pass', 'Carpenter', 'Ikeja, Lagos State', 6.60180000, 3.35150000);

-- 2. INSERT JOBS (Linked to the Users above)
INSERT INTO jobs (client_id, worker_id, title, job_description, category, location, lat, lng, budget, job_status) VALUES 
(1, 4, 'Fix ceiling fan', 'The fan in the living room is making a weird noise.', 'Electrician', 'University of Ibadan, Oyo State', 7.44430000, 3.89950000, 5000.00, 'COMPLETED'),
(2, 3, 'Leaking Kitchen Sink', 'Water pooling under the cabinet.', 'Plumber', 'Yaba, Lagos State', 6.50950000, 3.37110000, 3500.00, 'PAID'),
(1, NULL, 'Build custom shelf', 'Need a wooden bookshelf for my study.', 'Carpenter', 'University of Ibadan, Oyo State', 7.44430000, 3.89950000, 15000.00, 'OPEN'),
(2, 5, 'Fix broken door hinge', 'The front door won''t close properly.', 'Carpenter', 'Yaba, Lagos State', 6.50950000, 3.37110000, 8000.00, 'ASSIGNED'),
(1, 4, 'Wiring issue', 'Sparks coming from the socket.', 'Electrician', 'University of Ibadan, Oyo State', 7.44430000, 3.89950000, 7500.00, 'DISPUTED');

-- 3. INSERT MESSAGES (Simulating chats between clients and workers)
INSERT INTO messages (job_id, sender_id, content) VALUES 
(1, 1, 'Are you on your way? The fan just stopped completely.'),
(1, 4, 'Yes, I am 5 minutes away. Entering UI gate now.'),
(2, 2, 'Please make sure you bring a replacement pipe.'),
(2, 3, 'Already bought it, see you soon.'),
(4, 5, 'Can you send a picture of the broken hinge?');

-- 4. INSERT PAYMENTS (Simulating the Interswitch Escrow logic)
INSERT INTO payments (job_id, amount, status, interswitch_ref) VALUES 
(1, 5000.00, 'RELEASED', 'INT_REF_001_COMPLETED'),
(2, 3500.00, 'HELD_IN_ESCROW', 'INT_REF_002_HELD'),
(4, 8000.00, 'HELD_IN_ESCROW', 'INT_REF_003_HELD'),
(5, 7500.00, 'HELD_IN_ESCROW', 'INT_REF_004_DISPUTE'),
(3, 15000.00, 'REFUNDED', 'INT_REF_005_CANCELLED');

-- 5. INSERT REVIEWS (Ratings left after jobs are done)
INSERT INTO reviews (job_id, reviewer_id, rating, comment) VALUES 
(1, 1, 5, 'Diana was incredibly fast and fixed the fan perfectly. Highly recommend!'),
(1, 4, 5, 'Alice was a great client. Paid on time, very clear instructions.'),
(2, 2, 4, 'Good work on the sink, but arrived about 10 minutes late.'),
(2, 3, 5, 'Smooth job, no issues.'),
(5, 1, 1, 'The socket is still sparking, completely unsafe. I want my money back.');

-- 6. INSERT PRICE INDEX (The historical data for your AI pricing feature)
INSERT INTO price_index (job_id, category, location, agreed_amount) VALUES 
(1, 'Electrician', 'University of Ibadan, Oyo State', 5000.00),
(2, 'Plumber', 'Yaba, Lagos State', 3500.00),
(4, 'Carpenter', 'Yaba, Lagos State', 8000.00),
(5, 'Electrician', 'University of Ibadan, Oyo State', 7500.00),
(1, 'Electrician', 'University of Ibadan, Oyo State', 4800.00); -- Simulating an older, similar job for the AI average