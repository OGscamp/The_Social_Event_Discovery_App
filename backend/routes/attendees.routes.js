const express = require("express");
const router = express.Router();
const attendeesController = require("../controllers/attendees.controller");
const authenticateToken = require("../middleware/auth");

router.get("/:eventId/attendees", authenticateToken, attendeesController.getEventAttendees);

module.exports = router;
