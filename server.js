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
    let cfg = fs.readFileSync("./public/config.json", "utf8");
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
 * Execute: send SMS / WhatsApp + update Data Extension
 */
app.post("/execute", async (req, res) => {
  log("EXECUTE", "Incoming request New");

  try {
    const inArgs = (req.body && req.body.inArguments) || [];
    const to = getArg(inArgs, "to");
    const body = getArg(inArgs, "body") || "Hello from Twilio!";
    const memberId = getArg(inArgs, "memberId");
    const customerKey = getArg(inArgs, "customerKey");

    if (!to) {
      log("EXECUTE ERROR", "Missing recipient phone number");
      return res.status(400).json({ branchResult: "error", error: "Missing 'to' phone number" });
    }

    log("EXECUTE", `Parsed args -> to: ${to}, body: "${body}"`);

    const payload = { to, body };

    if (process.env.TWILIO_FROM) {
      payload.from = process.env.TWILIO_FROM;
      log("EXECUTE", `Using From number: ${process.env.TWILIO_FROM}`);
    } else {
      log("EXECUTE ERROR", "No TWILIO_FROM configured");
      return res.status(500).json({ branchResult: "error", error: "No TWILIO_FROM configured" });
    }

    // 1. Send SMS via Twilio
    const msg = await client.messages.create(payload);
    log("EXECUTE", `Message sent successfully. SID: ${msg.sid}`);

    // 2. Update DE in SFMC
    const sfmcAccessToken = await getSFMCAuthToken();
    const deExternalKey = process.env.SFMC_DE_KEY;

    const updateBody = [
      {
        keys: {
          MemberId: memberId || "Unknown"
        },
        values: {
          Status: true,
          CustomerSubscriberKey: customerKey || "Unknown",
          MessageSid: msg.sid
        }
      }
    ];

    const response = await fetch(
      `${process.env.SFMC_REST_BASE}/hub/v1/dataevents/key:${deExternalKey}/rowset`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sfmcAccessToken}`
        },
        body: JSON.stringify(updateBody)
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      log("EXECUTE ERROR", "DE update failed", errText);
      return res.status(500).json({ branchResult: "error", error: "Failed to update Data Extension" });
    }

    log("EXECUTE", "Data Extension updated successfully");

    return res.json({
      branchResult: "ok",
      messageSid: msg.sid
    });

  } catch (err) {
    log("EXECUTE ERROR", err);
    return res.status(500).json({ branchResult: "error", error: err.message });
  }
});

async function getSFMCAuthToken() {
  const resp = await fetch(`${process.env.SFMC_AUTH_BASE}/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.SFMC_CLIENT_ID,
      client_secret: process.env.SFMC_CLIENT_SECRET
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to get SFMC access token: ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}


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
