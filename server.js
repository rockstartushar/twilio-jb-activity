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
// app.use(express.static(path.join(__dirname, 'public')));

const { TWILIO_SID, TWILIO_TOKEN, MSID, STATUS_CB, PORT=3000 } = process.env;
const client = twilio(TWILIO_SID, TWILIO_TOKEN);

// ---------- Health ----------
app.get('/', (_,res)=>res.send('Twilio JB Activity: OK'));

// ---------- Serve config.json ----------
app.get('/config.json', (_,res)=>{
  // Dynamically inject host as {{Endpoint}}
  const base = process.env.BASE_URL || '';
  // Read file and replace {{Endpoint}}
  const fs = require('fs');
  let cfg = fs.readFileSync('./config/config.json','utf8');
  cfg = cfg.replaceAll('{{Endpoint}}', base);
  res.setHeader('Content-Type','application/json');
  res.send(cfg);
});

// ---------- UI ----------
app.get('/ui', (_,res)=>res.sendFile(__dirname + '/public/index.html'));

// ---------- Lifecycle ----------
app.post('/save', (req,res)=>res.json({status:'ok'}));
app.post('/publish', (req,res)=>res.json({status:'ok'}));
app.post('/validate', (req,res)=>res.json({status:'ok'}));
app.post('/stop', (req,res)=>res.json({status:'stopped'}));

// ---------- Execute (send SMS/WA) ----------
app.post('/execute', async (req,res)=>{
  try {
    const inArgs = (req.body && req.body.inArguments) || [];
    const to = getArg(inArgs, 'to');
    const body = getArg(inArgs, 'body') || 'Hello from Twilio';
    const channel = (getArg(inArgs, 'channel') || 'sms').toLowerCase();

    const toFinal = (channel === 'wa' || channel === 'whatsapp')
      ? (to.startsWith('whatsapp:') ? to : `whatsapp:${to}`)
      : to;

    const msg = await client.messages.create({
      To: toFinal,
      MessagingServiceSid: TWILIO_SID,
      Body: body,
      StatusCallback: STATUS_CB
    });

    return res.json({ branchResult: 'ok', messageSid: msg.sid });
  } catch (e) {
    console.error('EXECUTE ERROR', e.message);
    return res.status(500).json({ branchResult: 'error', error: e.message });
  }
});

function getArg(arr, key){
  for (const o of arr){ if (o[key]) return o[key]; }
  return null;
}

// ---------- Optional: status & inbound endpoints ----------
app.post('/twilio/status', (req,res)=>{
  // Twilio will POST x-www-form-urlencoded; we already enabled urlencoded
  // Store req.body as needed (DLR). For demo we reply OK.
  res.send('ok');
});

app.post('/twilio/inbound', (req,res)=>{
  // Handle inbound SMS/WA - Body, From, To, MessageSid available
  res.send('ok');
});

app.listen(PORT, ()=>console.log('Server running on port', PORT));
