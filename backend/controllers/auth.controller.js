const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await pool.query(
      "SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await pool.query(
      `INSERT INTO users (email, display_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id, email, display_name`,
      [email, name, passwordHash]
    );

    const userRow = created.rows[0];

    const token = jwt.sign(
      { userId: userRow.user_id, email: userRow.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(201).json({
      message: "User created",
      token,
      user: { id: userRow.user_id, name: userRow.display_name, email: userRow.email },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      `SELECT user_id, email, display_name, password_hash
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "No account found with this email." });
    }

    const userRow = result.rows[0];

    if (!userRow.password_hash) {
      return res.status(401).json({ error: "This account uses Google Login. Please use 'Continue with Google'." });
    }

    const ok = await bcrypt.compare(password, userRow.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }

    const token = jwt.sign(
      { userId: userRow.user_id, email: userRow.email },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      message: "Login successful",
      token,
      user: { id: userRow.user_id, name: userRow.display_name, email: userRow.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.googleCallback = (req, res) => {
  const token = jwt.sign(
    { userId: req.user.user_id, email: req.user.email },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
  
  const userJson = JSON.stringify({
    id: req.user.user_id,
    name: req.user.display_name,
    email: req.user.email
  });
  
  res.redirect(`http://localhost:8080/login?token=${token}&user=${encodeURIComponent(userJson)}`);
};

exports.getMe = async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const userResult = await pool.query(
      `SELECT user_id, email, display_name, created_at
       FROM users
       WHERE user_id = $1`,
      [payload.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRow = userResult.rows[0];

    const summaryResult = await pool.query(
      `SELECT status, COUNT(*)::INT AS count
       FROM event_attendees
       WHERE user_id = $1
       GROUP BY status`,
      [payload.userId]
    );

    const rsvpSummary = { going: 0, interested: 0, not_going: 0 };
    for (const row of summaryResult.rows) {
      if (row.status in rsvpSummary) {
        rsvpSummary[row.status] = row.count;
      }
    }

    return res.json({
      ok: true,
      payload,
      user: {
        id: userRow.user_id,
        email: userRow.email,
        name: userRow.display_name,
        created_at: userRow.created_at,
      },
      rsvp_summary: rsvpSummary,
    });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

// PATCH /auth/me
// Updates the authenticated user's display name. Closes BUG-S3-006: until
// this endpoint existed the Edit Profile modal saved optimistically to
// localStorage only and was overwritten on the next /auth/me fetch.
const NAME_MAX_LENGTH = 100;

exports.updateMe = async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { name } = req.body || {};

  if (typeof name !== "string") {
    return res.status(400).json({ error: "Name is required" });
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({ error: "Name cannot be empty" });
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    return res
      .status(400)
      .json({ error: `Name must be ${NAME_MAX_LENGTH} characters or fewer` });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET display_name = $1
       WHERE user_id = $2
       RETURNING user_id, email, display_name, created_at`,
      [trimmed, payload.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRow = result.rows[0];
    return res.json({
      ok: true,
      user: {
        id: userRow.user_id,
        email: userRow.email,
        name: userRow.display_name,
        created_at: userRow.created_at,
      },
    });
  } catch (err) {
    console.error("updateMe error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
