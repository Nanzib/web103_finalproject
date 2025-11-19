import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http'; // Needed for WebSockets
import { setupWebSocket } from './ws-server.js'; // Import the function we made
import { getTrack, searchTracks, getRandomTrack } from './services/spotify.js'; // Updated path (removed ../)
import userRoutes from './routes/users.js';
import leaderboardRoutes from './routes/leaderboard.js';
import { query } from './db.js'; // <--- ADDED THIS IMPORT

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Allow connections from your future frontend
app.use(cors({
    origin: [
        'http://localhost:5173', // Vite local
        'https://web103-finalproject-qwmk.onrender.com' // Your deployed frontend
    ],
    credentials: true
}));
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Create the HTTP server manually so we can share it with WebSockets
const server = createServer(app);

// Attach WebSocket server to the HTTP server
setupWebSocket(server);

// Basic test route
app.get('/', (req, res) => {
  res.send('Beatdle API is running!');
});

app.get('/api/spotify/track/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const track = await getTrack(id);
    res.json(track);
  } catch (error) {
    console.error('Error fetching track:', error);
    res.status(500).json({ 
      error: 'Failed to fetch track from Spotify',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/spotify/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Missing or empty search query' });
    }
    const results = await searchTracks(query, 5);
    res.json({ results });
  } catch (error) {
    console.error('Error searching tracks:', error);
    res.status(500).json({ 
      error: 'Failed to search tracks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/spotify/daily-song', async (req, res) => {
  try {
    const dailyTrackId = '2qSkIjg1o9h3YT9RAgYN75';
    const track = await getTrack(dailyTrackId);
    res.json(track);
  } catch (error) {
    console.error('Error fetching daily song:', error);
    res.status(500).json({ 
      error: 'Failed to fetch daily song',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/spotify/random-track', async (req, res) => {
  try {
    const track = await getRandomTrack();
    res.json(track);
  } catch (error) {
    console.error('Error fetching random track:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random track',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// --- SECRET SEED ROUTE (Run once to fix Profile/Leaderboard) ---
app.get('/api/seed-db', async (req, res) => {
  try {
    // 1. Create the table if it doesn't exist (Safety check)
    // FIX: Added the empty array [] parameter to satisfy TypeScript
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        games_played INT DEFAULT 0,
        games_won INT DEFAULT 0,
        current_streak INT DEFAULT 0,
        max_streak INT DEFAULT 0
      );
    `, []); 

    // 2. Insert a Demo User (Force ID=1 so /profile/1 works)
    // FIX: Added the empty array [] parameter
    await query(`
      INSERT INTO users (user_id, username, games_played, games_won, current_streak, max_streak)
      VALUES (1, 'DemoUser', 12, 8, 3, 5)
      ON CONFLICT (user_id) DO NOTHING;
    `, []); 

    res.send('🎉 Database seeded! You can now visit /profile/1');
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
        error: 'Failed to seed DB', 
        details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});
// ---------------------------------------------------------------

app.get('/callback', (req, res) => {
  console.log('Spotify callback hit with params:', req.query);
  res.send('Callback received');
});

// IMPORTANT: Listen using 'server', not 'app'
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});