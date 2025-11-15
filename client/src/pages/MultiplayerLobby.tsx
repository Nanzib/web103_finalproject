import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
// Make sure this import path is correct
import type { Player, LobbyMessage, SpotifyTrack } from "../components/types"; 
// Removed SearchSuggestion
// Import your new, real API functions
import { fetchTrack } from "../api/spotify"; // Removed searchTracks

const TRACK_IDS = [
  "4uLU6hMCjMI75M1A2tKUQC",
  "0VjIjW4GlUZAMYd2vXMi3b",
  "7qiZfU4dY1lWllzX7mPBI3",
];

export default function MultiplayerLobby() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const location = useLocation();
  const wsRef = useRef<WebSocket | null>(null);

  const query = new URLSearchParams(location.search);
  const name = query.get("name") || "Anonymous";
  const isHost = query.get("host") === "true";

  // --- Lobby State ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Game State (from Daily.tsx) ---
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);

  // --- Simplified Guess State ---
  const [guess, setGuess] = useState(""); // Replaced searchQuery

  // --- Removed: Suggestions state and debounce ref ---

  // --- Game Logic (from Daily.tsx) ---
  const handleGuess = (
    guess: string,
    track: SpotifyTrack,
    guesses: string[],
    setGuesses: React.Dispatch<React.SetStateAction<string[]>>,
    setGameOver: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const isCorrect = guess.trim().toLowerCase() === track.name.toLowerCase();
    const newGuesses = [...guesses];

    if (isCorrect) {
      newGuesses.push("correct");
      setGuesses(newGuesses);
      setGameOver(true);
    } else {
      newGuesses.push("wrong");
      setGuesses(newGuesses);
      if (newGuesses.length >= 5) {
        setGameOver(true);
      }
    }
  };

  const loadRandomTrack = async () => {
    const randomId = TRACK_IDS[Math.floor(Math.random() * TRACK_IDS.length)];
    try {
      const data = await fetchTrack(randomId);
      setTrack(data);
      setGuesses([]);
      setGameOver(false);
      setGuess(""); // Clear guess field
    } catch (err) {
      console.error("Failed to fetch track:", err);
      setError("Failed to load song. Please try refreshing.");
    }
  };

  // Simplified submit function
  function submitGuess(e: React.FormEvent) {
    e.preventDefault(); // Prevent page reload
    if (!track || gameOver || !guess) return;

    handleGuess(guess, track, guesses, setGuesses, setGameOver);
    setGuess(""); // Clear the input field
  }
  // ---

  // --- Removed: UseEffect for debouncing search ---

  useEffect(() => {
    // Check if WebSocket server is available
    if (!("WebSocket" in window)) {
        setError("Your browser does not support WebSockets.");
        return;
    }
      
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setError(null);
      ws.send(
        JSON.stringify({
          type: "joinLobby",
          payload: { lobbyId, name, isHost },
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg: LobbyMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "updatePlayers":
            setPlayers((msg.payload as { players: Player[] })?.players || []);
            break;
          case "gameStarted":
            setGameStarted(true);
            loadRandomTrack();
            break;
          default:
            console.warn("Unknown message type:", msg.type);
            break;
        }
      } catch (e) {
        console.error("Error parsing message:", e);
      }
    };
    
    ws.onclose = () => {
        console.log("WebSocket disconnected");
        if (wsRef.current) {
           setError("Disconnected from server. Attempting to reconnect...");
        }
    };

    ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setError("Connection error. Make sure the server is running.");
    };

    return () => {
      wsRef.current = null;
      ws.close();
    };
  }, [lobbyId, name, isHost]); 

  const startGame = () => {
    if (!isHost) return;
    wsRef.current?.send(
      JSON.stringify({ type: "startGame", payload: { lobbyId } })
    );
  };

  const getPlayerKey = (player: Player, index: number) => {
    return player.id || `${player.name}-${index}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 font-sans text-white">
      {/* Header */}
      <header className="flex items-center p-4 bg-gray-800 shadow-lg relative">
        <Link
          to="/"
          className="p-2 rounded-full hover:bg-gray-700 transition-colors absolute left-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </Link>
        <div className="flex-grow text-center">
          <div className="bg-gray-700 px-6 py-2 rounded text-white text-xl font-bold tracking-wider inline-block">
            LOBBY: {lobbyId}
          </div>
        </div>
        <div className="w-10 h-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center flex-grow p-4 md:p-8">
        <div className="w-full max-w-3xl">
          {error && (
            <div className="bg-red-800 border border-red-600 text-red-100 px-4 py-3 rounded-lg mb-6" role="alert">
              <span className="font-bold">Connection Error: </span>
              <span>{error}</span>
            </div>
          )}

          {/* Game UI or Player List */}
          {gameStarted ? (
            //Game is On 
            <div className="w-full">
              {track ? (
                <div className="flex flex-col items-center">
                  {track.previewUrl ? (
                    <audio controls src={track.previewUrl} className="mb-4 w-full" />
                  ) : (
                    <p className="mb-4 text-red-400">No preview available for this track.</p>
                  )}

                  <div className="flex gap-2 mb-4">
                    {[...Array(5)].map((_, i) => {
                      const status = guesses[i];
                      let bgColor = "bg-gray-700";
                      if (status === "correct") bgColor = "bg-green-500";
                      else if (status === "wrong") bgColor = "bg-red-500";
                      return (
                        <div
                          key={i}
                          className={`${bgColor} w-10 h-10 md:w-12 md:h-12 rounded flex items-center justify-center text-white font-bold`}
                        >
                          {i + 1}
                        </div>
                      );
                    })}
                  </div>

                {!gameOver && (
                  //Input Form
                  <form onSubmit={submitGuess} className="flex gap-2 w-full max-w-sm">
                    <input
                      type="text"
                      placeholder="Type the song name..."
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      className="bg-gray-700 border-2 border-gray-600 text-white px-4 py-2 rounded-lg w-full focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Guess
                    </button>
                  </form>
                )}

                {gameOver && (
                  <div className="mt-4 text-center">
                    <div className="text-2xl font-bold">
                      {guesses.includes("correct") ? "🎉 You got it!" : "💀 Game Over!"}
                    </div>
                    <p className="text-lg mt-2">Song was: {track.name}</p>
                    {isHost && (
                       <button
                         onClick={loadRandomTrack}
                         className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 mt-4"
                       >
                         Start Next Round
                       </button>
                    )}
                  </div>
                )}
                </div>
              ) : (
                <p>Loading song...</p>
              )}
            </div>
          ) : (
            //Lobby Waiting Room
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
              <h2 className="text-2xl font-semibold mb-4 text-center">Waiting Room</h2>
              <div className="mb-6 text-center">
                <p className="text-lg">
                  You are: <span className="font-bold text-blue-400">{name}</span> {isHost && "(Host)"}
                </p>
                {!isHost && <p className="text-gray-400">Waiting for host to start...</p>}
              </div>

              {isHost && (
                <button 
                  onClick={startGame}
                  className="w-full bg-blue-600 px-6 py-3 rounded-lg text-xl font-semibold hover:bg-blue-700 transition-colors mb-6 shadow-lg disabled:bg-gray-500"
                  disabled={players.length < 1}
                >
                  Start Game
                </button>
              )}

              <div>
                <h3 className="text-xl font-semibold mb-3">Players ({players.length})</h3>
                <ul className="space-y-2">
                  {players.map((player, i) => (
                    <li
                      key={getPlayerKey(player, i)}
                      className="bg-gray-700 p-3 rounded-lg flex justify-between items-center"
                    >
                      <span className="font-medium">{player.name}</span>
                      {player.isHost && <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">Host</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}