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
}

const wss = new WebSocketServer({ port: 8080 });

// Store all active lobbies here
const lobbies: Record<string, LobbyState> = {};

wss.on("connection", (ws) => {
  console.log("New connection established");

  // Track which lobby this specific connection belongs to
  let currentLobbyId: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());
      console.log("Received:", msg);

      switch (msg.type) {
        case "joinLobby": {
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
          
          // We know lobbies[lobbyId] exists because we just created it if missing
          // But to satisfy TS, we access it safely:
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
        }

        case "startGame": {
            const { lobbyId } = msg.payload;
            broadcastToLobby(lobbyId, {
                type: "gameStarted",
                payload: {}
            });
            break;
        }
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