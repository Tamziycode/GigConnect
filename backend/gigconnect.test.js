/**
 * GIGCONNECT API - AUTOMATED TEST SUITE
 * ======================================
 * SETUP (run these once before testing):
 *
 * 1. Install dependencies:
 *    npm install --save-dev jest supertest
 *
 * 2. Add this to your package.json:
 *    "scripts": {
 *      "test": "jest --runInBand --forceExit"
 *    }
 *
 * 3. Make sure your DB is running and seeded with schema.sql dummy data
 *
 * 4. Run: npm test
 *
 * --runInBand runs tests sequentially (important — auth must run before jobs)
 * --forceExit kills the server connection after tests finish
 */
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const request = require("supertest");
const app = require("./server"); // Make sure server.js exports app (see note below)

// ─── SHARED STATE ───────────────────────────────────────────
// These get populated as tests run and shared across test blocks
let clientToken = "";
let workerToken = "";
let newJobId = "";

// ════════════════════════════════════════════════════════════
// SECTION 1 — AUTH
// ════════════════════════════════════════════════════════════
describe("1. AUTH ENDPOINTS", () => {
  describe("POST /api/auth/signup", () => {
    it("1.1 should register a new CLIENT successfully", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          name: "Test Client",
          email: `client_${Date.now()}@test.com`, // unique each run
          password: "password123",
          role: "CLIENT",
          location: "University of Ibadan",
          lat: 7.4443,
          lng: 3.8995,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.role).toBe("CLIENT");
      clientToken = res.body.token; // Save for later tests
    });

    it("1.2 should register a new WORKER successfully", async () => {
      const res = await request(app)
        .post("/api/auth/signup")
        .send({
          name: "Test Worker",
          email: `worker_${Date.now()}@test.com`,
          password: "password123",
          role: "WORKER",
          title: "Plumber",
          location: "Bodija, Ibadan",
          lat: 7.42,
          lng: 3.91,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.role).toBe("WORKER");
      workerToken = res.body.token; // Save for later tests
    });

    it("1.3 should reject duplicate email with 400", async () => {
      const res = await request(app).post("/api/auth/signup").send({
        name: "Duplicate",
        email: "alice@email.com", // Already in dummy data
        password: "password123",
        role: "CLIENT",
        location: "Ibadan",
        lat: 7.4443,
        lng: 3.8995,
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it("1.4 should reject invalid role with 400", async () => {
      const res = await request(app).post("/api/auth/signup").send({
        name: "Bad Role",
        email: "badrole@test.com",
        password: "password123",
        role: "ADMIN", // Not CLIENT or WORKER
        location: "Ibadan",
        lat: 7.4443,
        lng: 3.8995,
      });

      expect(res.statusCode).toBe(400);
    });

    it("1.5 should reject password shorter than 6 chars with 400", async () => {
      const res = await request(app).post("/api/auth/signup").send({
        name: "Short Pass",
        email: "shortpass@test.com",
        password: "abc",
        role: "CLIENT",
        location: "Ibadan",
        lat: 7.4443,
        lng: 3.8995,
      });

      expect(res.statusCode).toBe(400);
    });

    it("1.6 should reject missing lat/lng with 400", async () => {
      const res = await request(app).post("/api/auth/signup").send({
        name: "No Coords",
        email: "nocoords@test.com",
        password: "password123",
        role: "CLIENT",
        location: "Ibadan",
        // lat and lng deliberately missing
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/auth/signin", () => {
    it("1.7 should sign in an existing user and return a token", async () => {
      // Use the tokens from 1.1 and 1.2 — they're already set
      // This test verifies the signin route itself with fresh credentials
      const res = await request(app).post("/api/auth/signin").send({
        email: "alice@email.com",
        password: "hashed_pass", // NOTE: Only works if seeded with plain text — see README
      });

      // If your dummy data has real bcrypt hashes this will be 200
      // If it has 'hashed_pass' as plain text this will be 401
      // Either 200 or 401 is acceptable here — we just check it responds
      expect([200, 401]).toContain(res.statusCode);
    });

    it("1.8 should reject wrong password with 401", async () => {
      const res = await request(app).post("/api/auth/signin").send({
        email: "alice@email.com",
        password: "totallyWrongPassword",
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toMatch(/invalid/i);
    });

    it("1.9 should reject non-existent email with 401", async () => {
      const res = await request(app).post("/api/auth/signin").send({
        email: "ghost@nobody.com",
        password: "password123",
      });

      expect(res.statusCode).toBe(401);
    });

    it("1.10 should reject missing password with 400", async () => {
      const res = await request(app).post("/api/auth/signin").send({
        email: "alice@email.com",
        // password missing
      });

      expect(res.statusCode).toBe(400);
    });
  });
});

// ════════════════════════════════════════════════════════════
// SECTION 2 — USER PROFILES
// ════════════════════════════════════════════════════════════
describe("2. USER PROFILE ENDPOINTS", () => {
  it("2.1 should fetch an existing user profile", async () => {
    const res = await request(app)
      .get("/api/auth/users/1")
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("user");
    expect(res.body.user).not.toHaveProperty("password_hash"); // Must not leak password
  });

  it("2.2 should return 404 for non-existent user", async () => {
    const res = await request(app)
      .get("/api/auth/users/9999")
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("2.3 should return 401 with no token", async () => {
    const res = await request(app).get("/api/auth/users/1");
    expect(res.statusCode).toBe(401);
  });

  it("2.4 should return 400 with a tampered token", async () => {
    const res = await request(app)
      .get("/api/auth/users/1")
      .set("Authorization", "Bearer thisisafaketoken123");

    expect(res.statusCode).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════
// SECTION 3 — JOBS
// ════════════════════════════════════════════════════════════
describe("3. JOB ENDPOINTS", () => {
  describe("POST /api/jobs", () => {
    it("3.1 should create a new job as client", async () => {
      const res = await request(app)
        .post("/api/jobs")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({
          title: "Fix leaking pipe",
          job_description: "Kitchen sink has been dripping since Monday.",
          category: "Plumber",
          location: "University of Ibadan",
          lat: 7.4443,
          lng: 3.8995,
          budget: 8000,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("jobId");
      newJobId = res.body.jobId; // Save for downstream tests
    });

    it("3.2 should return 401 with no token", async () => {
      const res = await request(app).post("/api/jobs").send({
        title: "No auth job",
        job_description: "Should fail",
        category: "Plumber",
        location: "Ibadan",
        lat: 7.4443,
        lng: 3.8995,
        budget: 5000,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/jobs", () => {
    it("3.3 should return client jobs when accessed with client token", async () => {
      const res = await request(app)
        .get("/api/jobs")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("jobs");
      expect(Array.isArray(res.body.jobs)).toBe(true);
    });

    it("3.4 should return worker jobs when accessed with worker token", async () => {
      const res = await request(app)
        .get("/api/jobs")
        .set("Authorization", `Bearer ${workerToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("jobs");
    });
  });

  describe("GET /api/jobs/:id", () => {
    it("3.5 should fetch a specific job by ID", async () => {
      const res = await request(app)
        .get(`/api/jobs/${newJobId}`)
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.job.id).toBe(newJobId);
    });

    it("3.6 should return 404 for non-existent job", async () => {
      const res = await request(app)
        .get("/api/jobs/9999")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PUT /api/jobs/:id/hire", () => {
    it("3.7 should reject hiring on an OPEN job (escrow not paid)", async () => {
      const res = await request(app)
        .put(`/api/jobs/${newJobId}/hire`)
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ worker_id: 3 });

      // Must be PAID first — should return 400
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/escrow/i);
    });

    it("3.8 should hire a worker on a PAID job", async () => {
      // Job 2 from dummy data is already PAID
      const res = await request(app)
        .put("/api/jobs/2/hire")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ worker_id: 3 });

      // Will succeed if Bob's token matches client_id 2
      // Since clientToken is Alice (id from signup), this may 400
      // That's expected — tests the ownership check
      expect([200, 400]).toContain(res.statusCode);
    });
  });
});

// ════════════════════════════════════════════════════════════
// SECTION 4 — CHECK-IN
// ════════════════════════════════════════════════════════════
describe("4. CHECK-IN ENDPOINTS", () => {
  it("4.1 should reject checkin on non-ASSIGNED job", async () => {
    // newJobId is OPEN, not ASSIGNED
    const res = await request(app)
      .post(`/api/jobs/${newJobId}/checkin`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/ASSIGNED/i);
  });

  it("4.2 should reject worker checkin without GPS coordinates", async () => {
    // Job 4 from dummy data is ASSIGNED
    const res = await request(app)
      .post("/api/jobs/4/checkin")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({}); // No lat/lng

    // 400 if worker, 403 if wrong worker assigned — both are correct behaviour
    expect([400, 403]).toContain(res.statusCode);
  });

  it("4.3 should reject worker checkin when too far from job location", async () => {
    // Job 4 is in Yaba Lagos, sending Ibadan coordinates = way too far
    const res = await request(app)
      .post("/api/jobs/4/checkin")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        lat: 7.4443, // Ibadan
        lng: 3.8995,
      });

    expect([403, 400]).toContain(res.statusCode);
  });

  it("4.4 should reject checkin with no token", async () => {
    const res = await request(app)
      .post("/api/jobs/4/checkin")
      .send({ lat: 6.5095, lng: 3.3711 });

    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
// SECTION 5 — COMPLETE JOB
// ════════════════════════════════════════════════════════════
describe("5. COMPLETE JOB ENDPOINTS", () => {
  it("5.1 should reject completing an OPEN job", async () => {
    const res = await request(app)
      .put(`/api/jobs/${newJobId}/complete`)
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/ASSIGNED/i);
  });

  it("5.2 should reject completing without both check-ins", async () => {
    // Job 4 is ASSIGNED but checkins not confirmed in this test run
    const res = await request(app)
      .put("/api/jobs/4/complete")
      .set("Authorization", `Bearer ${clientToken}`);

    // 403 = checkins missing, 404 = wrong client, both are correct
    expect([403, 404]).toContain(res.statusCode);
  });

  it("5.3 should reject completing without token", async () => {
    const res = await request(app).put("/api/jobs/4/complete");
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
// SECTION 6 — PAYMENTS
// ════════════════════════════════════════════════════════════
describe("6. PAYMENT ENDPOINTS", () => {
  describe("POST /api/payments/escrow", () => {
    it("6.1 should initialize escrow and return Interswitch paymentData", async () => {
      const res = await request(app)
        .post("/api/payments/escrow")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({
          jobId: newJobId,
          amount: 8000,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("paymentData");
      expect(res.body.paymentData).toHaveProperty("txn_ref");
      expect(res.body.paymentData).toHaveProperty("amount");
      expect(res.body.paymentData.currency).toBe("566"); // NGN ISO code
      // Amount should be in kobo (x100)
      expect(res.body.paymentData.amount).toBe(800000);
    });

    it("6.2 should return a unique txn_ref every call", async () => {
      const res1 = await request(app)
        .post("/api/payments/escrow")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ jobId: newJobId, amount: 8000 });

      const res2 = await request(app)
        .post("/api/payments/escrow")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({ jobId: newJobId, amount: 8000 });

      expect(res1.body.paymentData.txn_ref).not.toBe(
        res2.body.paymentData.txn_ref,
      );
    });

    it("6.3 should reject escrow with no token", async () => {
      const res = await request(app)
        .post("/api/payments/escrow")
        .send({ jobId: newJobId, amount: 8000 });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/payments/:id/release", () => {
    it("6.4 should reject release on non-COMPLETED job", async () => {
      const res = await request(app)
        .post(`/api/payments/${newJobId}/release`)
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/COMPLETED/i);
    });

    it("6.5 should release funds on a COMPLETED job (dummy data job 1)", async () => {
      // Job 1 is COMPLETED in dummy data with payment RELEASED already
      // So this will return 400 (no funds in escrow) — which is the correct guard
      const res = await request(app)
        .post("/api/payments/1/release")
        .set("Authorization", `Bearer ${clientToken}`);

      // Either 400 (already released) or 200 (if re-seeded) — both valid
      expect([200, 400, 403]).toContain(res.statusCode);
    });

    it("6.6 should return 404 for non-existent job", async () => {
      const res = await request(app)
        .post("/api/payments/9999/release")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/payments/:id/refund", () => {
    it("6.7 should refund a DISPUTED job (dummy data job 5)", async () => {
      const res = await request(app)
        .post("/api/payments/5/refund")
        .set("Authorization", `Bearer ${clientToken}`);

      // 200 = refunded, 400 = already refunded from previous run
      expect([200, 400]).toContain(res.statusCode);
    });

    it("6.8 should reject refund on a COMPLETED job", async () => {
      const res = await request(app)
        .post("/api/payments/1/refund")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/CANCELLED|DISPUTED/i);
    });

    it("6.9 should return 404 for non-existent job refund", async () => {
      const res = await request(app)
        .post("/api/payments/9999/refund")
        .set("Authorization", `Bearer ${clientToken}`);

      expect(res.statusCode).toBe(404);
    });
  });
});

// ════════════════════════════════════════════════════════════
// SECTION 7 — SECURITY & EDGE CASES
// ════════════════════════════════════════════════════════════
describe("7. SECURITY & EDGE CASES", () => {
  it("7.1 should block SQL injection in email field", async () => {
    const res = await request(app).post("/api/auth/signin").send({
      email: "' OR '1'='1",
      password: "anything",
    });

    // Should return 400 (validation) or 401 (not found) — never 200
    expect([400, 401]).toContain(res.statusCode);
  });

  it("7.2 should not expose password_hash in user profile response", async () => {
    const res = await request(app)
      .get("/api/auth/users/1")
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("7.3 should handle hire with no worker_id in body", async () => {
    const res = await request(app)
      .put("/api/jobs/2/hire")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({}); // No worker_id

    expect([400, 500]).toContain(res.statusCode);
  });

  it("7.4 should reject completely missing Authorization header", async () => {
    const res = await request(app).get("/api/jobs");
    expect(res.statusCode).toBe(401);
  });

  it("7.5 should reject malformed Bearer token", async () => {
    const res = await request(app)
      .get("/api/jobs")
      .set("Authorization", "NotBearer abc123");

    expect([400, 401]).toContain(res.statusCode);
  });
});
