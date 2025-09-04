require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use('/public', express.static('public'));

const { TWILIO_SID, TWILIO_TOKEN, MSID, STATUS_CB, PORT=3000 } = process.env;
const client = twilio(TWILIO_SID, TWILIO_TOKEN);

// ---------- Health ----------
app.get('/', (_,res)=>{
  console.log(`[HEALTH] Ping received`);
  res.send('Twilio JB Activity: OK');
});

// ---------- Serve config.json ----------
app.get('/config.json', (_,res)=>{
  console.log(`[CONFIG] Serving config.json`);
  const base = process.env.BASE_URL || '';
  const fs = require('fs');
  let cfg = fs.readFileSync('./config/config.json','utf8');
  cfg = cfg.replaceAll('{{Endpoint}}', base);
  res.setHeader('Content-Type','application/json');
  res.send(cfg);
});

// ---------- UI ----------
app.get('/ui', (_,res)=>{
  console.log(`[UI] Serving UI page`);
  res.sendFile(__dirname + '/public/index.html');
});

// ---------- Lifecycle ----------
app.post('/save', (req,res)=>{
  console.log(`[LIFECYCLE] Save called. Body:`, req.body);
  res.json({status:'ok'});
});
app.post('/publish', (req,res)=>{
  console.log(`[LIFECYCLE] Publish called. Body:`, req.body);
  res.json({status:'ok'});
});
app.post('/validate', (req,res)=>{
  console.log(`[LIFECYCLE] Validate called. Body:`, req.body);
  res.json({status:'ok'});
});
app.post('/stop', (req,res)=>{
  console.log(`[LIFECYCLE] Stop called. Body:`, req.body);
  res.json({status:'stopped'});
});

// ---------- Execute (send SMS/WA) ----------
app.post('/execute', async (req,res)=>{
  console.log(`[EXECUTE] Incoming request. Body:`, JSON.stringify(req.body, null, 2));
  try {
    const inArgs = (req.body && req.body.inArguments) || [];
    const to = getArg(inArgs, 'to');
    const body = getArg(inArgs, 'body') || 'Hello from Twilio';
    const channel = (getArg(inArgs, 'channel') || 'sms').toLowerCase();

    console.log(`[EXECUTE] Parsed args -> to: ${to}, body: "${body}", channel: ${channel}`);

    const toFinal = (channel === 'wa' || channel === 'whatsapp')
      ? (to.startsWith('whatsapp:') ? to : `whatsapp:${to}`)
      : to;

    console.log(`[EXECUTE] Final recipient: ${toFinal}`);

    const msg = await client.messages.create({
      To: toFinal,
      MessagingServiceSid: MSID,   // ← NOTE: yaha MSID use karo SID ke jagah agar Messaging Service SID alag diya hai
      Body: body,
      StatusCallback: STATUS_CB
    });

    console.log(`[EXECUTE] Message sent successfully. SID: ${msg.sid}`);

    return res.json({ branchResult: 'ok', messageSid: msg.sid });
  } catch (e) {
    console.error(`[EXECUTE ERROR]`, e);
    return res.status(500).json({ branchResult: 'error', error: e.message });
  }
});

function getArg(arr, key){
  for (const o of arr){ if (o[key]) return o[key]; }
  return null;
}

// ---------- Optional: status & inbound endpoints ----------
app.post('/twilio/status', (req,res)=>{
  console.log(`[STATUS CALLBACK]`, req.body);
  res.send('ok');
});

app.post('/twilio/inbound', (req,res)=>{
  console.log(`[INBOUND MESSAGE]`, req.body);
  res.send('ok');
});

app.listen(PORT, ()=>console.log(`[SERVER] Running on port ${PORT}`));
