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

const INITIAL_SONGS = [
  {
    id: 'interstellar-main-theme',
    title: 'Interstellar - Main Theme (First Step)',
    artist: 'Hans Zimmer / Arr. PianoSnap',
    youtubeUrl: 'https://www.youtube.com/watch?v=BYL30114i-U',
    midiUrl: '',
    sheetUrl: '',
    createdAt: 1700000000000
  },
  {
    id: 'golden-hour-piano',
    title: 'Golden Hour (Fast Piano Tutorial)',
    artist: 'JVKE / PianoSnap',
    youtubeUrl: 'https://www.youtube.com/watch?v=PEM0Vs8jf1w',
    midiUrl: '',
    sheetUrl: '',
    createdAt: 1700000100000
  },
  {
    id: 'rush-e-easy-version',
    title: 'Rush E - Easy & Fast Piano Tutorial',
    artist: 'Sheet Music Boss / PianoSnap',
    youtubeUrl: 'https://www.youtube.com/watch?v=Q8P_xT62-P8',
    midiUrl: '',
    sheetUrl: '',
    createdAt: 1700000200000
  }
];

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
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Error reading songs file:', err);
  }
  return INITIAL_SONGS;
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

app.post('/api/songs', requireAdminAuth, (req, res) => {
  const { title, artist, youtubeUrl, midiUrl = '', sheetUrl = '' } = req.body || {};
  if (!title || !artist || !youtubeUrl) {
    return res.status(400).json({ success: false, error: 'Titolo, artista e link YouTube sono obbligatori.' });
  }

  const songs = getSongs();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const id = `${slug || 'song'}-${Date.now().toString().slice(-5)}`;

  const newSong = {
    id,
    title: title.trim(),
    artist: artist.trim(),
    youtubeUrl: youtubeUrl.trim(),
    midiUrl: (midiUrl || '').trim(),
    sheetUrl: (sheetUrl || '').trim(),
    createdAt: Date.now()
  };

  songs.unshift(newSong);
  saveSongs(songs);
  res.json({ success: true, song: newSong, songs });
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

// Static assets
const staticDir = fs.existsSync(path.join(__dirname, 'dist', 'index.html'))
  ? path.join(__dirname, 'dist')
  : __dirname;

app.use(express.static(staticDir));

// Route all requests to index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PianoSnap server running on http://0.0.0.0:${PORT}`);
});
