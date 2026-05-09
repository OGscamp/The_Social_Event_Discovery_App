const axios = require("axios");
const pool = require("../config/db");

function mapLocalEvent(event) {
  return {
    event_id: event.event_id,
    title: event.title,
    description: event.description || null,
    start_time: event.start_time,
    end_time: event.end_time || null,
    location_name: event.location_name || null,
    image: null,
    ticketmaster_url: null,
    category: "Local",
    host_name: "Community",
    rsvp_count: parseInt(event.rsvp_count || 0, 10),
    capacity: event.capacity || null,
    source: "local",
  };
}

exports.getTicketmasterEvents = async (req, res) => {
  // Fall back to local DB events when no Ticketmaster API key is configured
  if (!process.env.TICKETMASTER_API_KEY) {
    try {
      const result = await pool.query(
        `SELECT e.*, COUNT(a.user_id) FILTER (WHERE a.status = 'going') AS rsvp_count
         FROM events e
         LEFT JOIN event_attendees a ON e.event_id = a.event_id
         GROUP BY e.event_id
         ORDER BY e.start_time ASC`
      );
      return res.json(result.rows.map(mapLocalEvent));
    } catch (err) {
      console.error("Local events fallback error:", err.message);
      return res.status(500).json({ error: "Failed to fetch local events" });
    }
  }

  try {
    const {
      keyword,
      city,
      countryCode = "US",
      size = 20,
      classificationName,
      sort = "relevance,desc",
      source = "ticketmaster",
      dmaId,
      latlong,
      radius = 100,
      unit = "miles",
    } = req.query;

    const response = await axios.get(
      "https://app.ticketmaster.com/discovery/v2/events.json",
      {
        params: {
          apikey: process.env.TICKETMASTER_API_KEY,
          ...(keyword ? { keyword } : {}),
          ...(city ? { city } : {}),
          ...(countryCode ? { countryCode } : {}),
          ...(classificationName ? { classificationName } : {}),
          ...(sort ? { sort } : {}),
          ...(source ? { source } : {}),
          ...(dmaId ? { dmaId } : {}),
          ...(latlong ? { latlong } : {}),
          ...(radius ? { radius } : {}),
          ...(unit ? { unit } : {}),
          ...(size ? { size } : {}),
        },
      }
    );

    const rawEvents = response.data._embedded?.events || [];

    const events = rawEvents.map((event) => ({
      event_id: event.id,
      title: event.name,
      description: event.info || event.pleaseNote || null,
      start_time:
        event.dates?.start?.dateTime || event.dates?.start?.localDate || null,
      end_time: null,
      location_name: event._embedded?.venues?.[0]?.name || null,
      image: event.images?.[0]?.url || null,
      ticketmaster_url: event.url || null,
      category: event.classifications?.[0]?.segment?.name || "General",
      host_name: event.promoter?.name || "Ticketmaster",
      rsvp_count: 0,
      source: "ticketmaster",
    }));

    res.json(events);
  } catch (err) {
    console.error("Ticketmaster error:", err.response?.data || err.message);
    const status = err.response?.status ?? 500;
    res.status(status).json({ error: "Failed to fetch Ticketmaster events" });
  }
};

exports.getTicketmasterEventById = async (req, res) => {
  const { id } = req.params;

  // If ID is a plain integer, or no API key, look up the local events table
  const isLocalId = /^\d+$/.test(id);
  if (isLocalId || !process.env.TICKETMASTER_API_KEY) {
    try {
      const result = await pool.query(
        `SELECT e.*, COUNT(a.user_id) FILTER (WHERE a.status = 'going') AS rsvp_count
         FROM events e
         LEFT JOIN event_attendees a ON e.event_id = a.event_id
         WHERE e.event_id = $1
         GROUP BY e.event_id`,
        [id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Event not found" });
      }
      return res.json(mapLocalEvent(result.rows[0]));
    } catch (err) {
      console.error("Local event detail error:", err.message);
      return res.status(500).json({ error: "Failed to fetch event details" });
    }
  }

  try {
    const response = await axios.get(
      `https://app.ticketmaster.com/discovery/v2/events/${id}.json`,
      {
        params: {
          apikey: process.env.TICKETMASTER_API_KEY,
        },
      }
    );

    const event = response.data;

    res.json({
      event_id: event.id,
      title: event.name,
      description: event.info || event.pleaseNote || null,
      start_time:
        event.dates?.start?.dateTime || event.dates?.start?.localDate || null,
      end_time: null,
      location_name: event._embedded?.venues?.[0]?.name || null,
      image: event.images?.[0]?.url || null,
      ticketmaster_url: event.url || null,
      category: event.classifications?.[0]?.segment?.name || "General",
      host_name: event.promoter?.name || "Ticketmaster",
      rsvp_count: 0,
      source: "ticketmaster",
    });
  } catch (err) {
    console.error(
      "Ticketmaster detail error:",
      err.response?.data || err.message
    );
    const status = err.response?.status ?? 500;
    res.status(status).json({ error: "Failed to fetch Ticketmaster event details" });
  }
};
