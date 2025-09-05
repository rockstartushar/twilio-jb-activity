require("dotenv").config(); 
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use("/public", express.static("public"));

const {
  TWILIO_SID,
  TWILIO_TOKEN,
  MSID,
  TWILIO_FROM,
  STATUS_CB,
  BASE_URL = "",
  PORT = 3000
} = process.env;

if (!TWILIO_SID || !TWILIO_TOKEN) {
  console.error("❌ Missing required environment variables (TWILIO_SID, TWILIO_TOKEN)");
  process.exit(1);
}

const client = twilio(TWILIO_SID, TWILIO_TOKEN);

/**
 * Utility: Timestamped logger
 */
function log(scope, ...args) {
  console.log(`[${new Date().toISOString()}] [${scope}]`, ...args);
}

/**
 * Health check
 */
app.get("/", (_, res) => {
  log("HEALTH", "Ping received");
  res.send("Twilio JB Activity: OK");
});

/**
 * Serve config.json
 */
app.get("/config.json", (_, res) => {
  log("CONFIG", "Serving config.json");
  try {
    let cfg = fs.readFileSync("./config/config.json", "utf8");
    cfg = cfg.replace(/{{Endpoint}}/g, BASE_URL);
    res.setHeader("Content-Type", "application/json");
    res.send(cfg);
  } catch (err) {
    log("CONFIG ERROR", err);
    res.status(500).json({ error: "Failed to load config.json" });
  }
});

/**
 * Serve UI
 */
app.get("/ui", (_, res) => {
  log("UI", "Serving index.html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/**
 * Lifecycle routes
 */
["save", "publish", "validate", "stop"].forEach((action) => {
  app.post(`/${action}`, (req, res) => {
    log("LIFECYCLE", `${action} called`, req.body);
    res.json({ status: "ok", action });
  });
});

/**
 * Execute: send SMS / WhatsApp
 */
app.post("/execute", async (req, res) => {
  log("EXECUTE", "Incoming request", req.body);

  try {
    const inArgs = (req.body && req.body.inArguments) || [];
    const to = getArg(inArgs, "to");
    const body = getArg(inArgs, "body") || "Hello from Twilio!";
    const channel = (getArg(inArgs, "channel") || "sms").toLowerCase();

    if (!to) {
      log("EXECUTE ERROR", "Missing recipient phone number");
      return res.status(400).json({ branchResult: "error", error: "Missing 'to' phone number" });
    }

    const toFinal =
      channel === "wa" || channel === "whatsapp"
        ? to.startsWith("whatsapp:") ? to : `whatsapp:${to}`
        : to;

    log("EXECUTE", `Parsed args -> to: ${toFinal}, body: "${body}", channel: ${channel}`);

    // Prepare message payload
    var payload = {
      to: toFinal,
      body: body
    };
    log("EXECUTE", "Prepared payload", payload);
    if (TWILIO_FROM) {
      payload.from = TWILIO_FROM;
      log("EXECUTE", `Using From number: ${TWILIO_FROM}`);
    } else {
      log("EXECUTE ERROR", "No MSID or TWILIO_FROM configured");
      return res.status(500).json({ branchResult: "error", error: "No MSID or TWILIO_FROM configured" });
    }

    const msg = await client.messages.create(payload);

    log("EXECUTE", `Message sent successfully. SID: ${msg.sid}`);

    return res.json({ branchResult: "ok", messageSid: msg.sid });
  } catch (err) {
    log("EXECUTE ERROR", err);
    return res.status(500).json({ branchResult: "error", error: err.message });
  }
});

/**
 * Twilio callbacks
 */
app.post("/twilio/status", (req, res) => {
  log("STATUS CALLBACK", req.body);
  res.send("ok");
});

app.post("/twilio/inbound", (req, res) => {
  log("INBOUND MESSAGE", req.body);
  res.send("ok");
});

/**
 * Helper: extract argument by key
 */
function getArg(arr, key) {
  for (const obj of arr) {
    if (obj[key]) return obj[key];
  }
  return null;
}

/**
 * Start server
 */
app.listen(PORT, () => log("SERVER", `Running on port ${PORT}`));
