/* global Postmonger */
var connection = new Postmonger.Session();
var payload = {};
var inArgs = [];

console.log("✅ Activity JS loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM loaded, notifying Journey Builder...");
  connection.trigger("ready");
  connection.trigger("updateButton", { button: "next", enabled: true });
});

// Listen for JB events
connection.on("initActivity", initialize);
connection.on("requestedSchema", onRequestedSchema);
connection.on("clickedNext", onClickedNext);
connection.on("clickedBack", () => connection.trigger("prevStep"));
connection.on("gotoStep", () => {}); // optional

/**
 * Initialize the activity with data from Journey Builder
 */
function initialize(data) {
  console.log("🔄 initActivity:", JSON.stringify(data, null, 2));
  if (data) payload = data;

  const hasInArgs =
    payload.arguments?.execute?.inArguments &&
    payload.arguments.execute.inArguments.length > 0;

  if (hasInArgs) {
    inArgs = payload.arguments.execute.inArguments[0]; // use first object
    setField("to", inArgs.to || "");
    setField("body", inArgs.body || "");
    setField("channel", inArgs.channel || "sms");
  }

  // Ask JB for schema (optional, useful for personalization fields)
  connection.trigger("requestSchema");

  // Ensure "Next" button is active
  connection.trigger("updateButton", { button: "next", enabled: true });
}

/**
 * Called when JB sends schema
 */
function onRequestedSchema(schema) {
  console.log("📊 Requested Schema:", JSON.stringify(schema, null, 2));
  // Could dynamically build dropdowns for fields here
}

/**
 * Called when user clicks "Next" in Journey Builder
 */
function onClickedNext() {
  console.log("➡️ Next clicked, saving data...");
  const to = getField("to") || "{{Contact.Default.MobileNumber}}";
  const body = getField("body") || "Hello!";
  const channel = getField("channel") || "sms";

  // Store values back into payload
  payload.arguments = payload.arguments || {};
  payload.arguments.execute = payload.arguments.execute || {};
  payload.arguments.execute.inArguments = [
    { to, body, channel } // single object is cleaner
  ];

  payload.metaData = payload.metaData || {};
  payload.metaData.isConfigured = true;

  console.log("💾 Saving payload:", JSON.stringify(payload, null, 2));
  connection.trigger("updateActivity", payload);
}

/**
 * Helpers
 */
function setField(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getField(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
