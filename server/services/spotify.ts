// cache for the access token and its expiry time
let cachedToken: string | null = null;
let tokenExpiryTime: number = 0;

// import require for CommonJS module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let spotifyPreviewFinder: ((songName: string, artistName?: string, limit?: number) => Promise<any>) | null = null;
try {
    spotifyPreviewFinder = require('spotify-preview-finder');
    console.log('Spotify preview finder loaded successfully');
} catch (error) {
    console.error('Failed to load spotify-preview-finder:', error);
}

// request an access token from Spotify with client credentials flow
export async function getSpotifyAccessToken(): Promise<string | null> {
    // return cached token if it's still valid
    if (cachedToken && Date.now() < tokenExpiryTime) {
        return cachedToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("Missing Spotify client ID or secret in env file");
        return null;
    }

    const tokenUrl = 'https://accounts.spotify.com/api/token';
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + credentials,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        
        if (!response.ok) {
            console.error("Failed to fetch Spotify access token", await response.text());
            return null;
        }

        const data = await response.json();
        cachedToken = data.access_token;
        // expires in like 3600 normally so I cached it with a small buffer
        tokenExpiryTime = Date.now() + (data.expires_in - 60) * 1000;
        
        return cachedToken;
    } catch (error) {
        console.error("Error fetching Spotify access token", error);
        return null;
    }
}

// helper to get preview URL using the preview finder as fallback
async function getPreviewUrl(songName: string, artistName: string, apiPreviewUrl: string | null): Promise<string | null> {
    if (apiPreviewUrl) {
        return apiPreviewUrl;
    }
    
    if (!spotifyPreviewFinder) {
        console.log(`No preview URL from API and preview finder not available`);
        return null;
    }

    try {
        console.log(`No preview URL from API, searching for: "${songName}" by "${artistName}"`);
        const result = await spotifyPreviewFinder(songName, artistName, 1);
        
        if (result.success && result.results.length > 0) {
            const firstResult = result.results[0];
            if (firstResult.previewUrls && firstResult.previewUrls.length > 0) {
                const previewUrl = firstResult.previewUrls[0];
                console.log(`Preview finder found URL: ${previewUrl}`);
                return previewUrl;
            }
        }
        
        console.log('Preview finder: No preview URL found');
        return null;
    } catch (error) {
        console.error(`Preview finder failed:`, error);
        return null;
    }
}

// fetch track details from Spotify
export async function getTrack(trackId: string) {
    const token = await getSpotifyAccessToken();
    
    if (!token) {
        throw new Error("Unable to get Spotify access token");
    }

    const trackUrl = `https://api.spotify.com/v1/tracks/${trackId}?market=US`;

    try {
        const response = await fetch(trackUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to fetch track from Spotify", errorText);
            throw new Error(`Spotify API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Im getting the preview URL by passing song name and artist for the finder
        const songName = data.name;
        const artistName = data.artists[0]?.name || '';
        const previewUrl = await getPreviewUrl(songName, artistName, data.preview_url);

        // If we need more fields for the frontend, yall can change it here
        return {
            id: data.id,
            name: data.name,
            artists: data.artists.map((artist: any) => artist.name),
            album: {
                name: data.album.name,
                image: data.album.images[0]?.url 
            },
            previewUrl,
            duration: data.duration_ms,
            releaseDate: data.album.release_date
        };
    } catch (error) {
        console.error("Error fetching track from Spotify", error);
        throw error;
    }
}
//search tracks by query for autocomplete
export async function searchTracks(query: string, limit: number = 5) {
    const token = await getSpotifyAccessToken();
    if (!token) {
        throw new Error("Unable to get Spotify access token");
    }
  
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&market=US&limit=${limit}`;
  
    try {
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}` 
            },
        });
  
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Spotify search API error:", errorText);
            throw new Error(`Spotify API error ${response.status}`);
        }
  
        const data = await response.json();
  
        const tracks = data.tracks.items.map((track: any) => ({
            id: track.id,
            name: track.name,
            artists: track.artists.map((artist: any) => artist.name),
            album: {
                name: track.album.name,
                image: track.album.images[2]?.url || track.album.images[0]?.url || null, // Use smallest image for autocomplete
            },
            previewUrl: track.preview_url, 
        }));

        return tracks;
    } catch (error) {
        console.error("Error searching tracks from Spotify", error);
        throw error;
    }
}

//Get a random track from Spotify

// Random track from playlist
// ----- RECENT TRACK CACHE -----
const MAX_RECENT_TRACKS = 50;
const recentTrackIds = new Set<string>();

function addRecentTrack(trackId: string) {
  // Remove if already present to refresh its position
  if (recentTrackIds.has(trackId)) recentTrackIds.delete(trackId);

  // Add as most recent
  recentTrackIds.add(trackId);

  // Remove oldest if exceeding max
  while (recentTrackIds.size > MAX_RECENT_TRACKS) {
    const oldest = recentTrackIds.values().next().value;
    recentTrackIds.delete(oldest || "");
  }
}

// ----- RANDOM TRACK FUNCTION -----
export async function getRandomTrack() {
  const token = await getSpotifyAccessToken();
  if (!token) throw new Error("Unable to get Spotify access token");

  // Spotify popular playlist
  const POPULAR_PLAYLIST_ID = "37i9dQZEVXbLp5XoPON0wI";
  const url = `https://api.spotify.com/v1/playlists/${POPULAR_PLAYLIST_ID}/tracks?market=US&limit=100`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Spotify API error ${response.status}`);
    const data = await response.json();

    // Filter valid tracks and remove recently played
    const validTracks = data.items
      .map((item: any) => item.track)
      .filter((track: any) => track?.id && !recentTrackIds.has(track.id));

    if (validTracks.length === 0) {
      console.warn("All tracks recently played, clearing cache...");
      recentTrackIds.clear();
      return getRandomTrack(); // Retry after clearing
    }

    // Pick a random track
    const randomTrack = validTracks[Math.floor(Math.random() * validTracks.length)];

    // Add to recent cache
    addRecentTrack(randomTrack.id);

    // Return full track info
    return getTrack(randomTrack.id);
  } catch (err) {
    console.warn("Failed to get random track from playlist, falling back:", err);
    return getRandomTrack_Fallback();
  }
}
async function getRandomTrack_Fallback() {
    console.warn("Fallback random track called...");
    const token = await getSpotifyAccessToken();
    if (!token) throw new Error("Unable to get Spotify access token");
  
    // Simple fallback: search for a random letter
    const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    const url = `https://api.spotify.com/v1/search?q=${randomChar}&type=track&limit=1&market=US`;
  
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
      if (!response.ok) throw new Error(`Spotify API error ${response.status}`);
      const data = await response.json();
  
      const track = data.tracks.items[0];
      if (!track) throw new Error("No track found in fallback");
  
      return getTrack(track.id);
    } catch (err) {
      console.error("Fallback track fetch failed:", err);
      throw err;
    }
  }
  
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&market=US&limit=${limit}`;
  
    try {
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${token}` 
            },
        });
  
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Spotify search API error:", errorText);
            throw new Error(`Spotify API error ${response.status}`);
        }
  
        const data = await response.json();
  
        const tracks = data.tracks.items.map((track: any) => ({
            id: track.id,
            name: track.name,
            artists: track.artists.map((artist: any) => artist.name),
            album: {
                name: track.album.name,
                image: track.album.images[2]?.url || track.album.images[0]?.url || null, // Use smallest image for autocomplete
            },
            previewUrl: track.preview_url, 
        }));

        return tracks;
    } catch (error) {
        console.error("Error searching tracks from Spotify", error);
        throw error;
    }
}
