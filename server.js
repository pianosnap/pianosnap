import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const SONGS_FILE = path.join(DATA_DIR, 'songs.json');
const CONFIG_FILE = path.join(__dirname, 'firebase-applet-config.json');
const ENV_FILE = path.join(__dirname, '.env');

// Load environment variables from .env file if present
if (fs.existsSync(ENV_FILE)) {
  try {
    const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > -1) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim();
          if (v) {
            process.env[k] = v;
          }
        }
      }
    });
  } catch (err) {
    console.warn('Notice loading .env:', err);
  }
}

function getEffectiveApiKey(cfgApiKey) {
  return process.env.FIREBASE_API_KEY || cfgApiKey || '';
}

const INITIAL_SONGS = [];

// Endpoint to securely provide Firebase public config without committing hardcoded secrets in source files
app.get('/api/firebase-config', (req, res) => {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return res.json({
        success: true,
        config: {
          projectId: cfg.projectId || process.env.FIREBASE_PROJECT_ID || 'wired-balancer-m7dgj',
          appId: cfg.appId || process.env.FIREBASE_APP_ID || '1:872111048182:web:4799699552b1517466f3d7',
          apiKey: getEffectiveApiKey(cfg.apiKey),
          authDomain: cfg.authDomain || `${cfg.projectId || 'wired-balancer-m7dgj'}.firebaseapp.com`,
          storageBucket: cfg.storageBucket || `${cfg.projectId || 'wired-balancer-m7dgj'}.firebasestorage.app`,
          messagingSenderId: cfg.messagingSenderId || '872111048182',
          firestoreDatabaseId: cfg.firestoreDatabaseId || 'ai-studio-pianosnap-5f6210df-c01d-4e20-abd2-28f85b276205'
        }
      });
    }
  } catch (err) {
    console.error('Error reading firebase config file:', err);
  }
  return res.json({
    success: true,
    config: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'wired-balancer-m7dgj',
      appId: process.env.FIREBASE_APP_ID || '1:872111048182:web:4799699552b1517466f3d7',
      apiKey: getEffectiveApiKey(''),
      authDomain: 'wired-balancer-m7dgj.firebaseapp.com',
      storageBucket: 'wired-balancer-m7dgj.firebasestorage.app',
      messagingSenderId: '872111048182',
      firestoreDatabaseId: 'ai-studio-pianosnap-5f6210df-c01d-4e20-abd2-28f85b276205'
    }
  });
});

function ensureSongsFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SONGS_FILE)) {
    fs.writeFileSync(SONGS_FILE, JSON.stringify(INITIAL_SONGS, null, 2), 'utf-8');
  }
}

function getSongs() {
  ensureSongsFile();
  try {
    const raw = fs.readFileSync(SONGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Error reading songs file:', err);
  }
  return [];
}

function saveSongs(songs) {
  ensureSongsFile();
  fs.writeFileSync(SONGS_FILE, JSON.stringify(songs, null, 2), 'utf-8');
}

// Admin Auth Token constant
const ADMIN_TOKEN = 'ps_admin_session_auth_matrix_2026';

function requireAdminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.headers.authorization?.replace('Bearer ', '');
  if (token === ADMIN_TOKEN) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Non autorizzato. Effettua il login come admin.' });
  }
}

// API Routes
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'Ilcucchiaiononesiste23--') {
    return res.json({
      success: true,
      token: ADMIN_TOKEN,
      user: { username: 'admin', role: 'admin' }
    });
  }
  return res.status(401).json({
    success: false,
    error: 'Credenziali non valide. Verifica username e password.'
  });
});

app.get('/api/songs', (req, res) => {
  const songs = getSongs();
  res.json({ success: true, songs });
});

app.post('/api/songs/save-all', (req, res) => {
  const { songs: allSongs } = req.body || {};
  if (!Array.isArray(allSongs)) {
    return res.status(400).json({ success: false, error: 'Formato lista canzoni non valido.' });
  }
  saveSongs(allSongs);
  res.json({ success: true, count: allSongs.length, songs: allSongs });
});

app.post('/api/songs/import', requireAdminAuth, (req, res) => {
  const { songs: importedSongs } = req.body || {};
  if (!Array.isArray(importedSongs)) {
    return res.status(400).json({ success: false, error: 'Formato non valido: attesa una lista di canzoni.' });
  }
  saveSongs(importedSongs);
  res.json({ success: true, message: 'Catalogo canzoni sovrascritto con successo.', songs: importedSongs });
});

app.post('/api/songs', requireAdminAuth, (req, res) => {
  const { id: incomingId, title, artist, youtubeUrl, midiUrl = '', sheetUrl = '' } = req.body || {};
  if (!title || !artist || !youtubeUrl) {
    return res.status(400).json({ success: false, error: 'Titolo, artista e link YouTube sono obbligatori.' });
  }

  const songs = getSongs();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const id = incomingId || `${slug || 'song'}-${Date.now().toString().slice(-5)}`;

  const newSong = {
    id,
    title: title.trim(),
    artist: artist.trim(),
    youtubeUrl: youtubeUrl.trim(),
    midiUrl: (midiUrl || '').trim(),
    sheetUrl: (sheetUrl || '').trim(),
    createdAt: Date.now()
  };

  const updatedSongs = [newSong, ...songs.filter(s => s.id !== id)];
  saveSongs(updatedSongs);
  res.json({ success: true, song: newSong, songs: updatedSongs });
});

app.put('/api/songs/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { title, artist, youtubeUrl, midiUrl = '', sheetUrl = '' } = req.body || {};

  const songs = getSongs();
  const index = songs.findIndex(s => s.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Canzone non trovata.' });
  }

  songs[index] = {
    ...songs[index],
    title: title ? title.trim() : songs[index].title,
    artist: artist ? artist.trim() : songs[index].artist,
    youtubeUrl: youtubeUrl ? youtubeUrl.trim() : songs[index].youtubeUrl,
    midiUrl: midiUrl !== undefined ? midiUrl.trim() : songs[index].midiUrl,
    sheetUrl: sheetUrl !== undefined ? sheetUrl.trim() : songs[index].sheetUrl
  };

  saveSongs(songs);
  res.json({ success: true, song: songs[index], songs });
});

app.delete('/api/songs/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  let songs = getSongs();
  const initialLength = songs.length;
  songs = songs.filter(s => s.id !== id);

  if (songs.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Canzone non trovata.' });
  }

  saveSongs(songs);
  res.json({ success: true, message: 'Canzone eliminata con successo.', songs });
});

const staticDir = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
  ? path.join(__dirname, 'dist')
  : (fs.existsSync(path.join(__dirname, 'public', 'index.html')) ? path.join(__dirname, 'public') : __dirname);

// Explicit admin route: serve index.html directly with 200 without redirect
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Static assets
if (fs.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static(path.join(__dirname, 'public')));
}

app.use(express.static(staticDir));

// Route all requests to index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PianoSnap server running on http://0.0.0.0:${PORT}`);
});
