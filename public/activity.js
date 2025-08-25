/* global Postmonger */
var connection = new Postmonger.Session();
var payload = {};
var inArgs = [];

connection.on('initActivity', initialize);
connection.on('requestedSchema', onRequestedSchema);
connection.on('clickedNext', onClickedNext);
connection.on('clickedBack', onClickedBack);
connection.on('gotoStep', onGotoStep);

function initialize(data) {
  if (data) payload = data;
  var hasInArgs = Boolean(
    payload.arguments &&
    payload.arguments.execute &&
    payload.arguments.execute.inArguments &&
    payload.arguments.execute.inArguments.length > 0
  );
  if (hasInArgs) {
    inArgs = payload.arguments.execute.inArguments;
    document.getElementById('to').value = findArg('to') || '';
    document.getElementById('body').value = findArg('body') || '';
    document.getElementById('channel').value = findArg('channel') || 'sms';
  }
  connection.trigger('requestSchema');
}

function onRequestedSchema(schema) {
  // You can inspect schema if you want to populate a field picker
}

function onClickedNext() {
  var to = document.getElementById('to').value || '{{Contact.Default.MobileNumber}}';
  var body = document.getElementById('body').value || 'Hello!';
  var channel = document.getElementById('channel').value || 'sms';

  payload.arguments.execute.inArguments = [
    { "to": to },
    { "body": body },
    { "channel": channel }
  ];
  payload.metaData.isConfigured = true;
  connection.trigger('updateActivity', payload);
}

function onClickedBack() {
  connection.trigger('prevStep');
}
function onGotoStep() {}

function findArg(name) {
  for (var i=0;i<inArgs.length;i++){
    if (inArgs[i][name]) return inArgs[i][name];
  }
}
