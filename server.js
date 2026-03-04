const express = require("express");
const cors = require("cors");
const path = require("path");
const { execSync } = require("child_process"); // for running Prisma commands
const { runSmsWorkerOnce } = require("./workers/smsWorker");
// ----------------------
// Import Routes
// ----------------------
const jobRoutes = require("./routes/job.routes");
const reportRoutes = require("./routes/report.routes");
const sessionRoutes = require("./routes/session.routes");
const rollcallRoutes = require("./routes/rollcall.routes");
const userRoutes = require("./routes/user.routes");
const authRoutes = require("./routes/auth.routes");
const smsRoutes = require("./routes/sms.routes");

// ----------------------
// Initialize App
// ----------------------
const app = express();

setInterval(() => {
  runSmsWorkerOnce(20).catch((e) => console.error("SmsWorker crashed:", e));
}, 3000);

console.log("✅ SmsWorker interval started");
// ----------------------
// Debug Hooks (Catch Hidden Errors)
// ----------------------
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
});

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
app.use("/api/sessions", sessionRoutes);
app.use("/api/rollcall", rollcallRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sms", smsRoutes);

// ----------------------
// Health Check
// ----------------------
app.get("/", (req, res) => {
  res.json({ message: "🚀 JENDIE Tech API is running!" });
});

// ----------------------
// 404 Handler
// ----------------------
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// ----------------------
// Global Error Handler
// ----------------------
app.use((err, req, res, next) => {
  console.error("🔥 Backend Error:", err.message);
  console.error(err.stack);
  res.status(500).json({
    message: "Server error",
    details: err.message || err,
  });
});


// ----------------------
// Run Prisma Migrations & Safe Seeding
// ----------------------
// ----------------------
// Run Prisma Migrations (ONLY in production)
// ----------------------
if (process.env.NODE_ENV === "production") {
  try {
    console.log("🔧 Running Prisma migrations...");
   const path = require("path");
const { execSync } = require("child_process");

function prismaCli(cmd) {
  const prismaJs = path.join(__dirname, "node_modules", "prisma", "build", "index.js");
  execSync(`node ${prismaJs} ${cmd}`, { stdio: "inherit" });
}

// ✅ Run migrations safely on Alpine
try {
  prismaCli("migrate deploy");
  console.log("✅ Migrations applied");
} catch (e) {
  console.error("❌ Migration error:", e);
  // If you want the server to still start even when migration fails, don't exit
  // process.exit(1);
}
  } catch (err) {
    console.error("❌ Migration error:", err);
  }
}

// ----------------------
// Run Seed (ONLY in development)
// ----------------------
if (process.env.NODE_ENV !== "production") {
  try {
    console.log("🌱 Running seed file...");
    execSync("node prisma/seed.js", { stdio: "inherit" });
  } catch (err) {
    console.error("❌ Seed error:", err);
  }
}


// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
