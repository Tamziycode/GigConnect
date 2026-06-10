# GigConnect API

A RESTful backend for a gig economy platform connecting clients with local service workers. Built with Node.js, Express, and MySQL.

The platform handles the full job lifecycle — from posting and hiring through to GPS-verified check-in and escrow payment release — with JWT authentication throughout.

---

## Features

- **JWT Authentication** — Role-based access control for clients and workers
- **Job Lifecycle Management** — Create, assign, and complete jobs with enforced status transitions
- **GPS Check-in Verification** — Worker proximity validated at check-in using the Haversine formula (200m radius)
- **Escrow Payment Flow** — Funds held in escrow via Interswitch and released only after both parties check in
- **Input Validation** — Request validation on all auth routes via express-validator
- **Automated Test Suite** — 30+ integration tests covering auth, jobs, check-in, payments, and security edge cases

---

## Tech Stack

| Layer            | Technology                     |
| ---------------- | ------------------------------ |
| Runtime          | Node.js                        |
| Framework        | Express 5                      |
| Database         | MySQL 2                        |
| Authentication   | JSON Web Tokens (jsonwebtoken) |
| Password Hashing | bcrypt                         |
| Validation       | express-validator              |
| Payment Gateway  | Interswitch                    |
| Testing          | Jest + Supertest               |

---

## Project Structure

```
gigconnect/
├── controllers/
│   ├── authController.js       # Signup, signin, user profile
│   ├── jobsController.js       # Job CRUD, hire, complete, check-in
│   └── paymentsController.js   # Escrow init, release, refund
├── middleware/
│   ├── authMiddleware.js       # JWT verification
│   └── validateMiddleware.js   # Request body validation rules
├── routes/
│   ├── authRoutes.js
│   ├── jobRoutes.js
│   └── paymentRoutes.js
├── db.js                       # MySQL connection pool
├── server.js                   # App entry point
├── gigconnect.test.js          # Integration test suite
├── .env.example                # Required environment variables
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- MySQL 8+

### Installation

```bash
git clone https://github.com/Tamziycode/GigConnect.git

cd backend
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Open `.env` and fill in your database credentials, JWT secret, and Interswitch keys. To generate a secure JWT secret:

```bash
node -e "require('crypto').randomBytes(64).toString('hex')"
```

### Database Setup

Create the database and run the schema:

```bash
mysql -u root -p -e "CREATE DATABASE gigconnect;"
mysql -u root -p gigconnect < schema.sql
```

### Running the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server runs on `http://localhost:5000` by default.

---

## API Reference

### Authentication

| Method | Endpoint              | Access  | Description               |
| ------ | --------------------- | ------- | ------------------------- |
| POST   | `/api/auth/signup`    | Public  | Register a new user       |
| POST   | `/api/auth/signin`    | Public  | Sign in and receive a JWT |
| GET    | `/api/auth/users/:id` | Private | Fetch a user profile      |

### Jobs

| Method | Endpoint                 | Access           | Description                       |
| ------ | ------------------------ | ---------------- | --------------------------------- |
| POST   | `/api/jobs`              | Private          | Create a new job listing          |
| GET    | `/api/jobs`              | Private          | Get all jobs for the current user |
| GET    | `/api/jobs/:id`          | Private          | Get a single job by ID            |
| PUT    | `/api/jobs/:id/hire`     | Private (Client) | Assign a worker to a job          |
| PUT    | `/api/jobs/:id/complete` | Private (Client) | Mark a job as completed           |
| POST   | `/api/jobs/:id/checkin`  | Private          | Record a GPS check-in             |

### Payments

| Method | Endpoint                    | Access  | Description                  |
| ------ | --------------------------- | ------- | ---------------------------- |
| POST   | `/api/payments/escrow`      | Private | Initialize an escrow session |
| POST   | `/api/payments/:id/release` | Private | Release funds to the worker  |
| POST   | `/api/payments/:id/refund`  | Private | Refund funds to the client   |

All private routes require an `Authorization: Bearer <token>` header.

---

## Job Status Flow

```
OPEN → PAID → ASSIGNED → COMPLETED
              ↓
         CANCELLED / DISPUTED → REFUNDED
```

A worker cannot be hired until the client funds escrow (`PAID`). Completion requires both parties to have checked in. Payment release requires the job to be `COMPLETED`.

---

## Running Tests

Ensure your database is running and seeded before running the test suite.

```bash
npm test
```

Tests run sequentially (`--runInBand`) as later test sections depend on state created in earlier ones (e.g. auth tokens from signup are reused in job tests).

---

## Roadmap

- [ ] Frontend client (React)
- [ ] Interswitch live payment integration
- [ ] Worker search and filtering by location and category
- [ ] Dispute resolution workflow
- [ ] Push notifications for job status updates
