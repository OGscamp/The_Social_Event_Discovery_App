const request = require("supertest");
const express = require("express");
const jwt = require("jsonwebtoken");

jest.mock("../config/db", () => ({ query: jest.fn() }));

const pool = require("../config/db");
const eventsRoutes = require("../routes/events.routes");

const JWT_SECRET = "dev-secret-change-me";

const app = express();
app.use(express.json());
app.use("/events", eventsRoutes);

function makeToken(userId = 1) {
  return jwt.sign({ userId, email: "test@example.com" }, JWT_SECRET, { expiresIn: "1h" });
}

describe("Events API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /events ──────────────────────────────────────────────────────────

  describe("GET /events", () => {
    test("TC-EVT-001: returns all events as array with 200", async () => {
      const mockRows = [
        { event_id: 1, title: "Music Fest", rsvp_count: 3 },
        { event_id: 2, title: "Art Show", rsvp_count: 1 },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockRows });

      const res = await request(app).get("/events");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockRows);
    });

    test("TC-EVT-002: returns 500 on database error", async () => {
      pool.query.mockRejectedValueOnce(new Error("Connection refused"));

      const res = await request(app).get("/events");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Internal server error");
    });
  });

  // ─── GET /events/:id ──────────────────────────────────────────────────────

  describe("GET /events/:id", () => {
    test("TC-EVT-003: returns single event by id with 200", async () => {
      const mockEvent = { event_id: 5, title: "Comedy Night", rsvp_count: 7 };
      pool.query.mockResolvedValueOnce({ rows: [mockEvent] });

      const res = await request(app).get("/events/5");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockEvent);
    });

    test("TC-EVT-004: returns 404 when event does not exist", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get("/events/999");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Event not found");
    });

    test("TC-EVT-005: returns 500 on database error", async () => {
      pool.query.mockRejectedValueOnce(new Error("Timeout"));

      const res = await request(app).get("/events/1");

      expect(res.status).toBe(500);
    });
  });

  // ─── POST /events ─────────────────────────────────────────────────────────

  describe("POST /events", () => {
    test("TC-EVT-006: returns 401 when no token is provided", async () => {
      const res = await request(app)
        .post("/events")
        .send({ title: "Jazz Night", start_time: "2025-08-01T20:00:00Z" });

      expect(res.status).toBe(401);
    });

    test("TC-EVT-007: creates event and returns 201 with event data", async () => {
      const created = { event_id: 10, title: "Jazz Night", start_time: "2025-08-01T20:00:00Z", created_by: 1 };
      pool.query.mockResolvedValueOnce({ rows: [created] });

      const res = await request(app)
        .post("/events")
        .set("Authorization", `Bearer ${makeToken(1)}`)
        .send({ title: "Jazz Night", start_time: "2025-08-01T20:00:00Z" });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe("Jazz Night");
      expect(res.body.event_id).toBe(10);
    });

    test("TC-EVT-008: returns 400 when title is missing", async () => {
      const res = await request(app)
        .post("/events")
        .set("Authorization", `Bearer ${makeToken()}`)
        .send({ start_time: "2025-08-01T20:00:00Z" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    test("TC-EVT-009: returns 400 when start_time is missing", async () => {
      const res = await request(app)
        .post("/events")
        .set("Authorization", `Bearer ${makeToken()}`)
        .send({ title: "Jazz Night" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });
  });

  // ─── PUT /events/:id ──────────────────────────────────────────────────────

  describe("PUT /events/:id", () => {
    test("TC-EVT-010: returns 401 when no token is provided", async () => {
      const res = await request(app)
        .put("/events/1")
        .send({ title: "Updated", start_time: "2025-09-01T18:00:00Z" });

      expect(res.status).toBe(401);
    });

    test("TC-EVT-011: returns 400 when required fields are missing", async () => {
      const res = await request(app)
        .put("/events/1")
        .set("Authorization", `Bearer ${makeToken()}`)
        .send({ description: "No title or start_time" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    test("TC-EVT-012: updates event and returns 200 with updated data", async () => {
      const updated = { event_id: 1, title: "Updated Event", start_time: "2025-09-01T18:00:00Z" };
      pool.query.mockResolvedValueOnce({ rows: [updated] });

      const res = await request(app)
        .put("/events/1")
        .set("Authorization", `Bearer ${makeToken(1)}`)
        .send({ title: "Updated Event", start_time: "2025-09-01T18:00:00Z" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Updated Event");
    });

    test("TC-EVT-013: returns 404 when event not found or not owned by user", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put("/events/99")
        .set("Authorization", `Bearer ${makeToken(1)}`)
        .send({ title: "Ghost Event", start_time: "2025-09-01T18:00:00Z" });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found or unauthorized/i);
    });
  });

  // ─── DELETE /events/:id ───────────────────────────────────────────────────

  describe("DELETE /events/:id", () => {
    test("TC-EVT-014: returns 401 when no token is provided", async () => {
      const res = await request(app).delete("/events/1");

      expect(res.status).toBe(401);
    });

    test("TC-EVT-015: deletes event and returns 204 with no body", async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ event_id: 1 }] });

      const res = await request(app)
        .delete("/events/1")
        .set("Authorization", `Bearer ${makeToken(1)}`);

      expect(res.status).toBe(204);
    });

    test("TC-EVT-016: returns 404 when event not found or not owned by user", async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .delete("/events/99")
        .set("Authorization", `Bearer ${makeToken(1)}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found or unauthorized/i);
    });
  });
});
