import { WebSocketServer, WebSocket } from "ws";

// Define the server state structure
interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

interface LobbyState {
  clients: WebSocket[]; 
  players: Player[];    
  currentTrackId?: string; // Store current track
}

const wss = new WebSocketServer({ port: 8080 });

// Store all active lobbies here
const lobbies: Record<string, LobbyState> = {};

wss.on("connection", (ws) => {
  console.log("New connection established");

  // Track which lobby this specific connection belongs to
  let currentLobbyId: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on("message", async (message) => { // Made this async
    try {
      const msg = JSON.parse(message.toString());
      console.log("Received:", msg);

      switch (msg.type) {
        case "joinLobby": { // Added curly braces
          const { lobbyId, name, isHost } = msg.payload;
          currentLobbyId = lobbyId;
          
          // Generate a random ID
          currentPlayerId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

          // 1. Create lobby if it doesn't exist
          if (!lobbies[lobbyId]) {
            lobbies[lobbyId] = { clients: [], players: [] };
          }

          // 2. Add player to the lobby state
          const newPlayer: Player = { 
            id: currentPlayerId, 
            name: name, 
            score: 0, 
            isHost: isHost 
          };
          
          const lobby = lobbies[lobbyId];
          if (lobby) {
            lobby.clients.push(ws);
            lobby.players.push(newPlayer);

            // 3. Broadcast updated player list
            broadcastToLobby(lobbyId, {
              type: "updatePlayers",
              payload: { players: lobby.players }
            });
          }
          break;
        } // Closed curly braces

        case "startGame": { // Added curly braces
            const { lobbyId } = msg.payload;
            const lobby = lobbies[lobbyId];
                
            if (!lobby) break; // Use break instead of return inside a switch

            // 1. Fetch a random track from the API server
            let track;
            try {
              // Note: This fetch call goes from this WS server to your Express API server
              const response = await fetch("http://localhost:8000/api/spotify/random-track");
              if (!response.ok) {
                throw new Error(`API server responded with ${response.status}`);
              }
              track = await response.json();

              if (!track || !track.id) {
                throw new Error("Invalid track data from API server");
              }
            } catch (err) {
              console.error("Failed to fetch random track for lobby:", err);
              // Optionally broadcast an error to the lobby
              broadcastToLobby(lobbyId, { type: "error", payload: { message: "Failed to load song." } });
              break; // Use break instead of return
            }
            
            // 2. Store the track ID (optional, but good for state)
            lobby.currentTrackId = track.id;

            // 3. Broadcast the *specific track data* to all players
            broadcastToLobby(lobbyId, {
                type: "startRound", // New message type
                payload: { track } // Send the whole track object
            });
            break;
        } // Closed curly braces
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  ws.on("close", () => {
    // FIX: Check variables first, then retrieve the lobby safely
    if (!currentLobbyId || !currentPlayerId) return;

    const lobby = lobbies[currentLobbyId];
    
    // FIX: If the lobby doesn't exist (already deleted), stop here
    if (!lobby) return;

    console.log(`Player ${currentPlayerId} disconnected from ${currentLobbyId}`);

    // 1. Remove the client socket
    lobby.clients = lobby.clients.filter(client => client !== ws);
    
    // 2. Remove the player data
    lobby.players = lobby.players.filter(p => p.id !== currentPlayerId);

    // 3. Broadcast new list to remaining players
    if (lobby.clients.length > 0) {
      broadcastToLobby(currentLobbyId, {
        type: "updatePlayers",
        payload: { players: lobby.players }
      });
    } else {
      // 4. Cleanup empty lobby
      console.log(`Lobby ${currentLobbyId} is empty, deleting.`);
      delete lobbies[currentLobbyId];
    }
  });
});

// Helper function to send messages to specific lobbies
function broadcastToLobby(lobbyId: string, message: any) {
  const lobby = lobbies[lobbyId];
  
  // FIX: Guard clause. If lobby is undefined, stop.
  if (!lobby) return;

  const data = JSON.stringify(message);
  
  lobby.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

console.log("WebSocket server running on ws://localhost:8080");