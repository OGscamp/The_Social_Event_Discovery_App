const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

jest.mock("../config/db", () => ({ query: jest.fn() }));
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2b$10$hashedpassword"),
  compare: jest.fn(),
}));
jest.mock("../config/passport", () => ({
  authenticate: () => (req, res, next) => next(),
  initialize: () => (req, res, next) => next(),
  session: () => (req, res, next) => next(),
}));

const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const authRoutes = require("../routes/auth.routes");

const JWT_SECRET = "dev-secret-change-me";

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

describe("Auth API (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /auth/signup ────────────────────────────────────────────────────

  describe("POST /auth/signup", () => {
    test("TC-AUTH-001: returns 400 when fields are missing", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({ email: "a@b.com" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing fields/i);
    });

    test("TC-AUTH-002: returns 400 when password is shorter than 6 characters", async () => {
      const res = await request(app)
        .post("/auth/signup")
        .send({ name: "Alice", email: "alice@test.com", password: "abc" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/6 characters/i);
    });

    test("TC-AUTH-003: returns 409 when email is already registered", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 5 }] });

      const res = await request(app)
        .post("/auth/signup")
        .send({ name: "Alice", email: "alice@test.com", password: "password123" });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    test("TC-AUTH-004: creates user and returns 201 with token", async () => {
      pool.query
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({
          rows: [{ user_id: 1, email: "alice@test.com", display_name: "Alice" }],
        });

      const res = await request(app)
        .post("/auth/signup")
        .send({ name: "Alice", email: "alice@test.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("alice@test.com");
    });
  });

  // ─── POST /auth/login ─────────────────────────────────────────────────────

  describe("POST /auth/login", () => {
    test("TC-AUTH-005: returns 400 when fields are missing", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ email: "alice@test.com" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing fields/i);
    });

    test("TC-AUTH-006: returns 401 when email is not found", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "ghost@test.com", password: "password123" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/no account found/i);
    });

    test("TC-AUTH-007: returns 401 when account uses Google login only", async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_id: 2, email: "google@test.com", display_name: "Google User", password_hash: null }],
      });

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "google@test.com", password: "anything" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/google login/i);
    });

    test("TC-AUTH-008: returns 401 when password is incorrect", async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_id: 3, email: "alice@test.com", display_name: "Alice", password_hash: "$2b$10$hash" }],
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "alice@test.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/incorrect password/i);
    });

    test("TC-AUTH-009: returns 200 with token on valid credentials", async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_id: 3, email: "alice@test.com", display_name: "Alice", password_hash: "$2b$10$hash" }],
      });
      bcrypt.compare.mockResolvedValueOnce(true);

      const res = await request(app)
        .post("/auth/login")
        .send({ email: "alice@test.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe("alice@test.com");
    });
  });

  // ─── GET /auth/me ─────────────────────────────────────────────────────────

  describe("GET /auth/me", () => {
    test("TC-AUTH-010: returns 401 when no token is provided", async () => {
      const res = await request(app).get("/auth/me");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing token/i);
    });

    test("TC-AUTH-011: returns 401 when token is invalid", async () => {
      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", "Bearer not.a.real.token");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid token/i);
    });

    test("TC-AUTH-012: returns 200 with user record and rsvp summary for a valid token", async () => {
      pool.query
        // user lookup
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              user_id: 7,
              email: "alice@test.com",
              display_name: "Alice Rivera",
              created_at: new Date("2026-01-15T00:00:00Z"),
            },
          ],
        })
        // rsvp summary aggregation
        .mockResolvedValueOnce({
          rows: [
            { status: "going", count: 4 },
            { status: "interested", count: 2 },
            { status: "not_going", count: 1 },
          ],
        });

      const token = jwt.sign({ userId: 7, email: "alice@test.com" }, JWT_SECRET, { expiresIn: "1h" });

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.payload.userId).toBe(7);
      expect(res.body.user).toEqual({
        id: 7,
        email: "alice@test.com",
        name: "Alice Rivera",
        created_at: expect.any(String),
      });
      expect(res.body.rsvp_summary).toEqual({
        going: 4,
        interested: 2,
        not_going: 1,
      });
    });

    test("TC-AUTH-013: returns 404 when the token's user no longer exists", async () => {
      pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const token = jwt.sign({ userId: 999, email: "ghost@test.com" }, JWT_SECRET, { expiresIn: "1h" });

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/user not found/i);
    });

    test("TC-AUTH-014: rsvp_summary defaults to zeros when user has no RSVPs", async () => {
      pool.query
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              user_id: 8,
              email: "new@test.com",
              display_name: "New User",
              created_at: new Date("2026-04-01T00:00:00Z"),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const token = jwt.sign({ userId: 8, email: "new@test.com" }, JWT_SECRET, { expiresIn: "1h" });

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.rsvp_summary).toEqual({
        going: 0,
        interested: 0,
        not_going: 0,
      });
    });

    test("TC-AUTH-015: returns 500 when the database query fails", async () => {
      pool.query.mockRejectedValueOnce(new Error("db down"));

      const token = jwt.sign({ userId: 7, email: "alice@test.com" }, JWT_SECRET, { expiresIn: "1h" });

      // silence expected console.error
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/server error/i);

      errSpy.mockRestore();
    });
  });

  // ─── PATCH /auth/me ───────────────────────────────────────────────────────

  describe("PATCH /auth/me", () => {
    test("TC-AUTH-016: returns 401 when no token is provided", async () => {
      const res = await request(app)
        .patch("/auth/me")
        .send({ name: "New Name" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/missing token/i);
    });

    test("TC-AUTH-017: returns 200 with updated user record on valid request", async () => {
      pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            user_id: 7,
            email: "alice@test.com",
            display_name: "Alice Renamed",
            created_at: new Date("2026-01-15T00:00:00Z"),
          },
        ],
      });

      const token = jwt.sign(
        { userId: 7, email: "alice@test.com" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Alice Renamed" });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user).toEqual({
        id: 7,
        email: "alice@test.com",
        name: "Alice Renamed",
        created_at: expect.any(String),
      });
      // Verify the SQL was parameterized with the trimmed name and the
      // userId from the JWT — not anything from the request body.
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE users[\s\S]*SET display_name/),
        ["Alice Renamed", 7]
      );
    });

    test("TC-AUTH-018: returns 400 when name is missing or whitespace-only", async () => {
      const token = jwt.sign(
        { userId: 7, email: "alice@test.com" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Missing name
      const res1 = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/name is required/i);

      // Whitespace-only name
      const res2 = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "   " });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/cannot be empty/i);

      // No DB call should have been made for either rejection.
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("TC-AUTH-019: returns 400 when name exceeds the length cap", async () => {
      const token = jwt.sign(
        { userId: 7, email: "alice@test.com" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const tooLong = "A".repeat(101);

      const res = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: tooLong });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/100 characters or fewer/i);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("TC-AUTH-020: returns 500 when the database query fails", async () => {
      pool.query.mockRejectedValueOnce(new Error("db down"));

      const token = jwt.sign(
        { userId: 7, email: "alice@test.com" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Alice" });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/server error/i);

      errSpy.mockRestore();
    });
  });
});
