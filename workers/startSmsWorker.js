const { runSmsWorkerOnce } = require("./smsWorker");

setInterval(() => {
  runSmsWorkerOnce().catch((e) => console.error("SMS worker error:", e));
}, 30_000);

console.log("✅ SMS Worker running (every 30s)");