const express = require("express");
const cors = require("cors");
const path = require("path");
const { execSync } = require("child_process");
const { runSmsWorkerOnce } = require("./workers/smsWorker");

// ----------------------
// Routes
// ----------------------
const jobRoutes = require("./routes/job.routes");
const reportRoutes = require("./routes/report.routes");
const sessionRoutes = require("./routes/session.routes");
const rollcallRoutes = require("./routes/rollcall.routes");
const userRoutes = require("./routes/user.routes");
const authRoutes = require("./routes/auth.routes");
const smsRoutes = require("./routes/sms.routes");

// ----------------------
// App Init
// ----------------------
const app = express();
app.set("trust proxy", 1);

// ----------------------
// CORS FIX (FINAL VERSION)
// ----------------------
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:8080",

  "https://jendietech.vercel.app",
  "https://technician-jz3w.vercel.app"
];

const corsOptions = {
  origin: (origin, callback) => {
    // allow server-to-server / postman
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS BLOCKED:", origin);
    return callback(null, false); // IMPORTANT: do NOT throw error
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With"
  ],

  credentials: true,
};

// Apply CORS globally
app.use(cors(corsOptions));

// IMPORTANT: handle preflight correctly
app.options("*", cors(corsOptions));

// ----------------------
// Middleware
// ----------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------------------
// Static Files
// ----------------------
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ----------------------
// Health Check (IMPORTANT FOR DEBUG)
// ----------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy 🚀"
  });
});

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
// 404 Handler
// ----------------------
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

// ----------------------
// Global Error Handler
// ----------------------
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  res.status(500).json({
    success: false,
    message: "Server error",
    details: err.message
  });
});

// ----------------------
// Background Worker
// ----------------------
setInterval(() => {
  runSmsWorkerOnce(20).catch((err) => {
    console.error("SMS Worker Error:", err);
  });
}, 3000);

console.log("✅ SMS Worker started");

// ----------------------
// Prisma Production Migration
// ----------------------
if (process.env.NODE_ENV === "production") {
  try {
    console.log("🔧 Running migrations...");

    const prismaJs = path.join(
      __dirname,
      "node_modules",
      "prisma",
      "build",
      "index.js"
    );

    execSync(`node ${prismaJs} migrate deploy`, {
      stdio: "inherit"
    });

    console.log("✅ Migrations complete");
  } catch (err) {
    console.error("❌ Migration error:", err);
  }
}

// ----------------------
// Seed (dev only)
// ----------------------
if (process.env.NODE_ENV !== "production") {
  try {
    console.log("🌱 Running seed...");
    execSync("node prisma/seed.js", {
      stdio: "inherit"
    });
  } catch (err) {
    console.error("❌ Seed error:", err);
  }
}

// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 9000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});