const express = require("express");
const cors = require("cors");
const path = require("path");

// ----------------------
// Import Routes
// ----------------------
const jobRoutes = require("./routes/job.routes");
const reportRoutes = require("./routes/report.routes");
const sessionRoutes = require("./routes/session.routes");
const rollcallRoutes = require("./routes/rollcall.routes");
const userRoutes = require("./routes/user.routes");   
const authRoutes = require("./routes/auth.routes");   

// ----------------------
// Initialize App
// ----------------------
const app = express();

// ----------------------
// Middleware
// ----------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ----------------------
// API Routes
// ----------------------
app.use("/api/jobs", jobRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/sessions", sessionRoutes);       // Session endpoints
app.use("/api/rollcall", rollcallRoutes);
app.use("/api/users", userRoutes);             // User endpoints
app.use("/api/auth", authRoutes);              // Auth endpoints

// ----------------------
// Health Check
// ----------------------
app.get("/", (req, res) => {
  res.json({ message: "🚀 JENDIE Tech API is running!" });
});

// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
