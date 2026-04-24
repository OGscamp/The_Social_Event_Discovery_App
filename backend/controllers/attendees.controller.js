const pool = require("../config/db");

exports.getEventAttendees = async (req, res) => {
  const { eventId } = req.params;
  if (isNaN(parseInt(eventId, 10))) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  try {
    // Check if event exists
    const eventCheck = await pool.query(
      "SELECT event_id FROM events WHERE event_id = $1",
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Fetch attendees
    const result = await pool.query(
      `
      SELECT
        ea.event_id,
        ea.user_id,
        u.display_name,
        ea.status,
        ea.joined_at
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.user_id
      WHERE ea.event_id = $1
      ORDER BY ea.joined_at ASC
      `,
      [eventId]
    );

    return res.json({
      event_id: eventId,
      attendee_count: result.rows.length,
      attendees: result.rows
    });

  } catch (err) {
    console.error("Error fetching attendees:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
