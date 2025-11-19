import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { query } from "./db.js";
import { getRandomTrack } from "./services/spotify.js"; // <--- ADDED: Direct import

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  currentAttempt: number;
  isCorrect: boolean;
  guesses: string[];
  dbId?: number;
}

interface LobbyState {
  clients: WebSocket[];
  players: Player[];
  currentTrack?: any;
  round: number;
  maxRounds: number;
  usedTrackIds: string[];
}

const lobbies: Record<string, LobbyState> = {};
const SCORE_POINTS = [5, 4, 3, 2, 1];

async function handleGameOverDB(lobby: LobbyState) {
    try {
        const maxScore = Math.max(...lobby.players.map((p) => p.score));
        for (const p of lobby.players) {
            if (p.dbId) {
                const isWinner = p.score === maxScore && p.score > 0;
                const gamesWonInc = isWinner ? 1 : 0;
                await query(`
                    UPDATE users 
                    SET games_played = games_played + 1, 
                        games_won = games_won + $2,
                        current_streak = CASE WHEN $2 > 0 THEN current_streak + 1 ELSE 0 END,
                        max_streak = GREATEST(max_streak, CASE WHEN $2 > 0 THEN current_streak + 1 ELSE max_streak END)
                    WHERE user_id = $1
                `, [p.dbId, gamesWonInc]);
            }
        }
    } catch (err) {
        console.error("Failed to update DB stats on Game Over:", err);
    }
}

export function setupWebSocket(server: Server) {
  console.log("Setting up WebSocket server attached to HTTP...");
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let currentLobbyId: string | null = null;
    let currentPlayerId: string | null = null;

    ws.on("message", async (message) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
        }

        switch (msg.type) {
          case "joinLobby": {
            const { lobbyId, name, isHost, userId } = msg.payload;
            currentLobbyId = lobbyId;
            currentPlayerId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

            if (!lobbies[lobbyId]) {
              lobbies[lobbyId] = {
                clients: [],
                players: [],
                round: 0,
                maxRounds: 5,
                usedTrackIds: [],
              };
            }

            const lobby = lobbies[lobbyId];
            if (!lobby.players.some((p) => p.id === currentPlayerId)) {
              const newPlayer: Player = {
                id: currentPlayerId!,
                name,
                score: 0,
                isHost,
                currentAttempt: 0,
                isCorrect: false,
                guesses: [],
                dbId: userId
              };
              lobby.players.push(newPlayer);
              lobby.clients.push(ws);
            }

            ws.send(JSON.stringify({
              type: "joinedLobby",
              payload: { yourId: currentPlayerId, players: lobby.players },
            }));

            broadcastToLobby(lobbyId, {
              type: "updatePlayers",
              payload: { players: lobby.players },
            });
            break;
          }

          case "startGame": {
            const { lobbyId } = msg.payload;
            await startNextRound(lobbyId);
            break;
          }

          case "playerGuess": {
            const { lobbyId, playerId, correct } = msg.payload;
            const lobby = lobbies[lobbyId];
            if (!lobby) return;

            const player = lobby.players.find((p) => p.id === playerId);
            if (!player) return;

            if (player.isCorrect || player.currentAttempt >= 5) return;

            player.guesses.push(correct ? "correct" : "wrong");
            player.currentAttempt = player.guesses.length;

            if (correct) {
              player.isCorrect = true;
              const pointsIndex = player.currentAttempt - 1;
              player.score += SCORE_POINTS[pointsIndex] || 0;
            }

            if (lobby.players.every((p) => p.isCorrect || p.currentAttempt >= 5)) {
              if (lobby.round >= lobby.maxRounds) {
                const maxScore = Math.max(...lobby.players.map((p) => p.score));
                const winners = lobby.players.filter((p) => p.score === maxScore);
                await handleGameOverDB(lobby);
                broadcastToLobby(lobbyId, {
                  type: "gameOver",
                  payload: { winners, players: lobby.players },
                });
              } else {
                broadcastToLobby(lobbyId, {
                  type: "roundOver",
                  payload: { players: lobby.players },
                });
              }
            } else {
                broadcastToLobby(lobbyId, {
                  type: "updatePlayers",
                  payload: { players: lobby.players },
                });
            }
            break;
          }

          case "nextSong": {
            const { lobbyId } = msg.payload;
            await startNextRound(lobbyId);
            break;
          }
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    ws.on("close", () => {
      if (!currentLobbyId || !currentPlayerId) return;
      const lobby = lobbies[currentLobbyId];
      if (!lobby) return;

      lobby.clients = lobby.clients.filter((c) => c !== ws);
      lobby.players = lobby.players.filter((p) => p.id !== currentPlayerId);

      if (lobby.clients.length === 0) {
        delete lobbies[currentLobbyId];
      } else {
        if (lobby.players.length > 0 && !lobby.players.some((p) => p.isHost)) {
          const newHost = lobby.players[0];
          if (newHost) { newHost.isHost = true; }
        }
        broadcastToLobby(currentLobbyId, {
          type: "updatePlayers",
          payload: { players: lobby.players },
        });
      }
    });
  });
}

async function startNextRound(lobbyId: string) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  lobby.round++;

  if (lobby.round > lobby.maxRounds) {
    const maxScore = Math.max(...lobby.players.map((p) => p.score));
    const winners = lobby.players.filter((p) => p.score === maxScore);
    await handleGameOverDB(lobby);
    broadcastToLobby(lobbyId, {
      type: "gameOver",
      payload: { winners, players: lobby.players },
    });
    return;
  }

  lobby.players.forEach((p) => {
    p.currentAttempt = 0;
    p.isCorrect = false;
    p.guesses = [];
  });

  let track;
  try {
    // FIX: CALL FUNCTION DIRECTLY (No Fetch!)
    track = await getRandomTrack();
  } catch (err) {
    console.error("Failed to fetch track", err);
    broadcastToLobby(lobbyId, {
      type: "error",
      payload: { message: "Failed to load song" },
    });
    return;
  }

  if (track && track.id) {
    lobby.currentTrack = track;
    lobby.usedTrackIds.push(track.id);
  } else {
    broadcastToLobby(lobbyId, {
      type: "error",
      payload: { message: "Fetched song data is invalid" },
    });
    return;
  }

  broadcastToLobby(lobbyId, {
    type: "startRound",
    payload: { track, players: lobby.players, round: lobby.round },
  });
}

function broadcastToLobby(lobbyId: string, message: any) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const data = JSON.stringify(message);
  lobby.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}