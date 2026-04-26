const pool = require("../config/db");

const VALID_STATUSES = ["going", "interested", "not_going"];

exports.rsvpToEvent = async (req, res) => {
  const { eventId } = req.params;
  if (isNaN(parseInt(eventId, 10))) {
    return res.status(400).json({ error: "Invalid ID" });
  }
  const { status } = req.body;
  const user_id = req.user.userId;

  if (!user_id) {
    return res.status(400).json({ error: "user_id is required" });
  }

  const finalStatus = status || "going";

  if (!VALID_STATUSES.includes(finalStatus)) {
    return res.status(400).json({ error: "Invalid RSVP status" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      "SELECT capacity FROM events WHERE event_id = $1 FOR SHARE",
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Event not found" });
    }

    const capacity = eventResult.rows[0].capacity;

    const currentRSVPResult = await client.query(
      "SELECT status FROM event_attendees WHERE event_id = $1 AND user_id = $2",
      [eventId, user_id]
    );
    const wasGoing = currentRSVPResult.rows.length > 0 && currentRSVPResult.rows[0].status === "going";

    const countResult = await client.query(
      `
      SELECT COUNT(*)::INT AS going_count
      FROM event_attendees
      WHERE event_id = $1
        AND status = 'going'
      `,
      [eventId]
    );

    let currentGoingCount = countResult.rows[0].going_count;

    if (finalStatus === "going" && !wasGoing && capacity !== null) {
      if (currentGoingCount >= capacity) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: "Event is at full capacity",
          capacity,
          going_count: currentGoingCount,
        });
      }
    }

    const result = await client.query(
      `
      INSERT INTO event_attendees (event_id, user_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, user_id)
      DO UPDATE SET status = EXCLUDED.status, joined_at = NOW()
      RETURNING event_id, user_id, status, joined_at
      `,
      [eventId, user_id, finalStatus]
    );

    const rsvp = result.rows[0];

    let newGoingCount = currentGoingCount;
    if (finalStatus === "going" && !wasGoing) {
      newGoingCount++;
    } else if (finalStatus !== "going" && wasGoing) {
      newGoingCount--;
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: "RSVP saved",
      rsvp,
      attendee_count: newGoingCount,
      capacity,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating RSVP:", err);
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
};

exports.getRSVPStatus = async (req, res) => {
  const { eventId, userId } = req.params;
  if (isNaN(parseInt(eventId, 10)) || isNaN(parseInt(userId, 10))) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const result = await pool.query(
      `
      SELECT status
      FROM event_attendees
      WHERE event_id = $1 AND user_id = $2
      `,
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "RSVP not found" });
    }

    return res.json({
      event_id: eventId,
      user_id: userId,
      status: result.rows[0].status,
    });
  } catch (err) {
    console.error("Error fetching RSVP status:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAttendees = async (req, res) => {
  const { eventId } = req.params;
  if (isNaN(parseInt(eventId, 10))) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    const result = await pool.query(
      "SELECT user_id, status, joined_at FROM event_attendees WHERE event_id = $1",
      [eventId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching attendees:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteRSVP = async (req, res) => {
  const { eventId, userId } = req.params;
  if (isNaN(parseInt(eventId, 10)) || isNaN(parseInt(userId, 10))) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  if (parseInt(userId) !== req.user.userId) {
    return res.status(403).json({ error: "Unauthorized to delete this RSVP" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM event_attendees WHERE event_id = $1 AND user_id = $2 RETURNING *",
      [eventId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "RSVP not found" });
    }

    return res.status(204).send();
  } catch (err) {
    console.error("Error deleting RSVP:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
