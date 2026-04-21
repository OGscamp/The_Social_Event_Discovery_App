const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");
const authenticateToken = require("../middleware/auth");

const JWT_SECRET = "dev-secret-change-me";

const app = express();
app.get("/protected", authenticateToken, (req, res) => {
  res.json({ ok: true, userId: req.user.userId });
});

describe("authenticateToken middleware", () => {
  test("TC-MW-001: no Authorization header returns 401", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  test("TC-MW-002: malformed token string returns 403", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer bad.token.value");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  test("TC-MW-003: expired token returns 403", async () => {
    const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: "0s" });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("TC-MW-004: token signed with wrong secret returns 403", async () => {
    const token = jwt.sign({ userId: 1 }, "wrong-secret", { expiresIn: "1h" });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test("TC-MW-005: valid token sets req.user and calls next", async () => {
    const token = jwt.sign({ userId: 42, email: "user@test.com" }, JWT_SECRET, { expiresIn: "1h" });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(42);
  });

  test("TC-MW-006: Bearer prefix missing returns 401", async () => {
    const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: "1h" });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", token);
    expect(res.status).toBe(401);
  });
});
