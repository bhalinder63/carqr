// src/server.js
// Main Express application entry point

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false })); // Security headers
app.use(cors()); // Allow cross-origin requests
app.use(morgan("dev")); // Request logging

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Required for Twilio webhooks

// Serve static files (QR code images, CSS, JS)
app.use(express.static(path.join(__dirname, "../public")));

// ─── RATE LIMITERS ───────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const callLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many call requests. Please wait a few minutes.",
  },
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── ROUTES ──────────────────────────────────────────────────────────

// API routes
app.use("/api/cars", apiLimiter, require("./routes/cars"));

// Twilio call webhook routes — call/request gets strict limiting
app.use("/call/request", callLimiter);
app.use("/call", require("./routes/calls"));

// Public contact page (stranger sees this after scanning)
app.use("/contact", contactLimiter, require("./routes/contact"));

// Print-ready tag page
app.use("/print-tag", require("./routes/printTag"));

// Home page — simple registration form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ─── START SERVER ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   RingMyRide Server                  ║
  ║   Running on http://localhost:${PORT}   ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
