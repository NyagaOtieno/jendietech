const express = require("express"); 
const cors = require("cors");

const jobRoutes = require("./routes/job.routes");
const reportRoutes = require("./routes/report.routes");
const sessionRoutes = require("./routes/session.routes");
const rollcallRoutes = require("./routes/rollcall.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/jobs", jobRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/rollcall", rollcallRoutes);

// ✅ Use Railway's assigned port or fallback to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
