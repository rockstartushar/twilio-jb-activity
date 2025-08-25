/* global Postmonger */
var connection = new Postmonger.Session();
var payload = {};
var inArgs = [];
console.log('Activity JS loaded');
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded');
  // tell JB that UI is loaded
  connection.trigger('ready');
  // show Next button enabled on step 1
  connection.trigger('updateButton', { button: 'next', enabled: true });
});

// receive init from JB
connection.on('initActivity', initialize);
connection.on('requestedSchema', onRequestedSchema);
connection.on('clickedNext', onClickedNext);
connection.on('clickedBack', () => connection.trigger('prevStep'));
connection.on('gotoStep', () => {}); // optional

function initialize(data) {
  console.log('initActivity', JSON.stringify(data));
  if (data) payload = data;

  const hasInArgs = Boolean(
    payload.arguments &&
    payload.arguments.execute &&
    payload.arguments.execute.inArguments &&
    payload.arguments.execute.inArguments.length
  );

  if (hasInArgs) {
    inArgs = payload.arguments.execute.inArguments;
    setField('to', findArg('to') || '');
    setField('body', findArg('body') || '');
    setField('channel', findArg('channel') || 'sms');
  }

  // request schema (optional)
  connection.trigger('requestSchema');
  // make sure next is enabled (sometimes JB disables by default)
  connection.trigger('updateButton', { button: 'next', enabled: true });
}

function onRequestedSchema(schema) {
  // optional: use schema to build a field picker
}

function onClickedNext() {
  const to = getField('to') || '{{Contact.Default.MobileNumber}}';
  const body = getField('body') || 'Hello!';
  const channel = getField('channel') || 'sms';

  payload.arguments = payload.arguments || {};
  payload.arguments.execute = payload.arguments.execute || {};
  payload.arguments.execute.inArguments = [
    { "to": to },
    { "body": body },
    { "channel": channel }
  ];
  payload.metaData = payload.metaData || {};
  payload.metaData.isConfigured = true;

  connection.trigger('updateActivity', payload);
}

function findArg(name) {
  for (var i = 0; i < inArgs.length; i++) {
    if (inArgs[i][name]) return inArgs[i][name];
  }
  return null;
}

function setField(id, val){ var el = document.getElementById(id); if (el) el.value = val; }
function getField(id){ var el = document.getElementById(id); return el ? el.value : ''; }
