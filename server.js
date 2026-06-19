const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/static', express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.MP4') || filePath.endsWith('.mp4')) {
      res.setHeader('Accept-Ranges', 'bytes');
    }
  }
}));

// ──────────────────────────────────────────────
//  Data Persistence
// ──────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'confessions.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const defaultData = {
      confessions: [],
      customSlides: [],
      settings: {
        slideDuration: 8,
        requireApproval: false,
        transition: 'fade'
      }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ──────────────────────────────────────────────
//  Server-Sent Events (SSE)
// ──────────────────────────────────────────────
let sseClients = [];

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // Send initial heartbeat
  res.write('data: {"type":"connected"}\n\n');

  sseClients.push(res);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write('data: {"type":"heartbeat"}\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(client => client !== res);
  });
});

function broadcast(eventData) {
  const data = JSON.stringify(eventData);
  sseClients.forEach(client => {
    client.write(`data: ${data}\n\n`);
  });
}

// ──────────────────────────────────────────────
//  Page Routes
// ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing', 'index.html'));
});

app.get('/slideshow', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'slideshow', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// ──────────────────────────────────────────────
//  API: Confessions
// ──────────────────────────────────────────────
app.get('/api/confessions', (req, res) => {
  const data = loadData();
  res.json(data.confessions);
});

app.post('/api/confessions', (req, res) => {
  const { text, name } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Confession text is required' });
  }
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const data = loadData();
  const confession = {
    id: crypto.randomUUID(),
    text: text.trim(),
    name: name.trim(),
    timestamp: new Date().toISOString(),
    approved: !data.settings.requireApproval,
    order: data.confessions.length
  };

  data.confessions.push(confession);
  saveData(data);

  broadcast({ type: 'new-confession', confession });
  res.status(201).json(confession);
});

app.delete('/api/confessions/:id', (req, res) => {
  const data = loadData();
  const existed = data.confessions.some(c => c.id === req.params.id);
  if (!existed) return res.status(404).json({ error: 'Not found' });

  data.confessions = data.confessions.filter(c => c.id !== req.params.id);
  data.confessions.forEach((c, i) => c.order = i);
  saveData(data);

  broadcast({ type: 'delete-confession', id: req.params.id });
  res.json({ success: true });
});

app.put('/api/confessions/:id/approve', (req, res) => {
  const data = loadData();
  const confession = data.confessions.find(c => c.id === req.params.id);
  if (!confession) return res.status(404).json({ error: 'Not found' });

  confession.approved = !!req.body.approved;
  saveData(data);

  broadcast({ type: 'update-confession', confession });
  res.json(confession);
});

app.put('/api/confessions/reorder', (req, res) => {
  const { order } = req.body; // Array of IDs in desired order
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of IDs' });
  }

  const data = loadData();
  const confessionMap = new Map(data.confessions.map(c => [c.id, c]));

  data.confessions = order
    .map((id, index) => {
      const c = confessionMap.get(id);
      if (c) c.order = index;
      return c;
    })
    .filter(Boolean);

  // Append any confessions not in the order array (shouldn't happen, but safe)
  const orderedIds = new Set(order);
  for (const c of confessionMap.values()) {
    if (!orderedIds.has(c.id)) {
      c.order = data.confessions.length;
      data.confessions.push(c);
    }
  }

  saveData(data);
  broadcast({ type: 'reorder', order });
  res.json({ success: true });
});

// ──────────────────────────────────────────────
//  API: Settings
// ──────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const data = loadData();
  res.json(data.settings);
});

app.put('/api/settings', (req, res) => {
  const data = loadData();
  const allowed = ['slideDuration', 'requireApproval', 'transition'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      data.settings[key] = req.body[key];
    }
  }
  saveData(data);

  broadcast({ type: 'settings-update', settings: data.settings });
  res.json(data.settings);
});

// ──────────────────────────────────────────────
//  API: Custom Slides
// ──────────────────────────────────────────────
app.get('/api/custom-slides', (req, res) => {
  const data = loadData();
  res.json(data.customSlides || []);
});

app.post('/api/custom-slides', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Slide text is required' });
  }

  const data = loadData();
  if (!data.customSlides) data.customSlides = [];

  const slide = {
    id: crypto.randomUUID(),
    text: text.trim(),
    type: 'custom',
    order: data.customSlides.length,
    createdAt: new Date().toISOString()
  };

  data.customSlides.push(slide);
  saveData(data);

  broadcast({ type: 'new-custom-slide', slide });
  res.status(201).json(slide);
});

app.delete('/api/custom-slides/:id', (req, res) => {
  const data = loadData();
  if (!data.customSlides) data.customSlides = [];

  const existed = data.customSlides.some(s => s.id === req.params.id);
  if (!existed) return res.status(404).json({ error: 'Not found' });

  data.customSlides = data.customSlides.filter(s => s.id !== req.params.id);
  data.customSlides.forEach((s, i) => s.order = i);
  saveData(data);

  broadcast({ type: 'delete-custom-slide', id: req.params.id });
  res.json({ success: true });
});

app.put('/api/custom-slides/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order must be an array of IDs' });
  }

  const data = loadData();
  if (!data.customSlides) data.customSlides = [];

  const slideMap = new Map(data.customSlides.map(s => [s.id, s]));

  data.customSlides = order
    .map((id, index) => {
      const s = slideMap.get(id);
      if (s) s.order = index;
      return s;
    })
    .filter(Boolean);

  saveData(data);
  broadcast({ type: 'reorder-custom-slides', order });
  res.json({ success: true });
});

// ──────────────────────────────────────────────
//  API: Combined Slides (for slideshow)
// ──────────────────────────────────────────────
app.get('/api/slides', (req, res) => {
  const data = loadData();

  const approvedConfessions = data.confessions
    .filter(c => c.approved)
    .map(c => ({ ...c, type: 'confession' }));

  const customs = (data.customSlides || [])
    .map(s => ({ ...s, type: 'custom' }));

  const allSlides = [...approvedConfessions, ...customs]
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  res.json({ slides: allSlides, settings: data.settings });
});

// ──────────────────────────────────────────────
//  Start Server
// ──────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  🎭  C A B A R E T   C O N F E S S I O N S');
  console.log('  ─────────────────────────────────────────');
  console.log(`  Landing page:   http://localhost:${PORT}`);
  console.log(`  Slideshow:      http://localhost:${PORT}/slideshow`);
  console.log(`  Admin portal:   http://localhost:${PORT}/admin`);
  console.log('');

  // Show network URLs for QR code
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  📱 Network:     http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log('');
});
