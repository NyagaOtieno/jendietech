const express = require("express");
const cors = require("cors");
const path = require("path");
const { execSync } = require("child_process");
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

// ----------------------
// CORS CONFIG (FIXED 🔥)
// ----------------------
const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://jendietech.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow Postman / mobile apps / curl (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn("❌ Blocked by CORS:", origin);
        return callback(new Error("CORS not allowed"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ IMPORTANT: handle preflight globally
app.options("*", cors());

// ----------------------
// Middleware
// ----------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------
// Background Worker
// ----------------------
setInterval(() => {
  runSmsWorkerOnce(20).catch((e) =>
    console.error("SmsWorker crashed:", e)
  );
}, 3000);

console.log("✅ SmsWorker interval started");

// ----------------------
// Debug Hooks
// ----------------------
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
});

// ----------------------
// Static Files
// ----------------------
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
app.use((req, res) => {
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
// Prisma Migrations (Production)
// ----------------------
if (process.env.NODE_ENV === "production") {
  try {
    console.log("🔧 Running Prisma migrations...");

    const prismaJs = path.join(
      __dirname,
      "node_modules",
      "prisma",
      "build",
      "index.js"
    );

    execSync(`node ${prismaJs} migrate deploy`, {
      stdio: "inherit",
    });

    console.log("✅ Migrations applied");
  } catch (err) {
    console.error("❌ Migration error:", err);
  }
}

// ----------------------
// Seed (Development Only)
// ----------------------
if (process.env.NODE_ENV !== "production") {
  try {
    console.log("🌱 Running seed...");
    execSync("node prisma/seed.js", { stdio: "inherit" });
  } catch (err) {
    console.error("❌ Seed error:", err);
  }
}

// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 9000;
app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);