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

    test("TC-AUTH-012: returns 200 with payload for a valid token", async () => {
      const token = jwt.sign({ userId: 7, email: "alice@test.com" }, JWT_SECRET, { expiresIn: "1h" });

      const res = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.payload.userId).toBe(7);
    });
  });
});
