import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, Link } from "react-router-dom";

// Type definitions for lobby state
interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

interface LobbyMessage {
  type: string;
  payload: unknown;
}

// Import API functions and types from your frontend API file
import { 
  // We no longer need fetchRandomTrack, just search
  searchTracks, 
  type TrackSuggestion, 
  type SpotifyTrack 
} from "../api/spotify"; // Assuming local path
import Autocomplete from "../components/Autocomplete"; // Assuming local path

// --- Game Constants (from Daily.tsx) ---
const MAX_ATTEMPTS = 5;
const SNIPPET_DURATIONS = [3, 6, 9, 12, 15];

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [guesses, setGuesses] = useState<{ correct: boolean; guess: string }[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- WebSocket Logic ---
  useEffect(() => {
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
          case "updatePlayers": { // Added braces
            setPlayers((msg.payload as { players: Player[] })?.players || []);
            break;
          } // Closed braces
          // Listen for 'startRound' which contains the track
          case "startRound": { // Added braces
            const newTrack = (msg.payload as { track: SpotifyTrack })?.track;
            if (newTrack) {
              setGameStarted(true);
              loadGameTrack(newTrack); // Pass the track object from the server
            }
            break;
          } // Closed braces
          case "error": { // Added braces
            setError((msg.payload as { message: string })?.message || "Server error");
            break;
          } // Closed braces
          default: { // Added braces
            console.warn("Unknown message type:", msg.type);
            break;
          } // Closed braces
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

  // --- Game Logic (from Daily.tsx) ---

  // loadGameTrack now accepts the track from the server
  const loadGameTrack = (newTrack: SpotifyTrack) => {
    try {
      setLoading(true);
      // Reset game state for new round
      setTrack(null);
      setGuesses([]);
      setCurrentAttempt(0);
      setGameOver(false);
      setWon(false);

      // Set the track directly from the WebSocket message
      setTrack(newTrack);
    } catch (err) {
      console.error("Failed to set track:", err);
      setError("Failed to load song. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  const playSnippet = () => {
    if (!audioRef.current || !track?.previewUrl) return;

    const audio = audioRef.current;
    const duration = SNIPPET_DURATIONS[currentAttempt] || 15;

    audio.currentTime = 0;
    audio.play();
    setIsPlaying(true);

    const timeoutId = setTimeout(() => {
      audio.pause();
      setIsPlaying(false);
    }, duration * 1000);

    audio.onpause = () => {
      setIsPlaying(false);
      clearTimeout(timeoutId);
    };
  };

  const handleGuess = (selectedTrack: TrackSuggestion) => {
    if (gameOver || !track) return;

    const isCorrect = selectedTrack.id === track.id;
    
    setGuesses([...guesses, { correct: isCorrect, guess: `${selectedTrack.name} - ${selectedTrack.artists.join(", ")}` }]);

    if (isCorrect) {
      setWon(true);
      setGameOver(true);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play(); // Play full song on win
      }
    } else if (currentAttempt + 1 >= MAX_ATTEMPTS) {
      setGameOver(true);
      setWon(false);
    } else {
      setCurrentAttempt(currentAttempt + 1);
    }
  };

  const startGame = () => {
    if (!isHost) return;
    // Client just sends 'startGame'. The server handles the logic.
    wsRef.current?.send(
      JSON.stringify({ type: "startGame", payload: { lobbyId } })
    );
  };

  // Helper for unique keys
  const getPlayerKey = (player: Player, index: number) => {
    return player.id || `${player.name}-${index}`;
  };


  // --- Render ---

  // Loading Screen (for game track)
  const renderGameLoading = () => (
    <div className="flex items-center justify-center text-white">
      <div className="text-2xl">Loading random song...</div>
    </div>
  );

  // No Track Error Screen
  const renderGameError = () => (
     <div className="flex items-center justify-center text-white">
      <div className="text-2xl">Failed to load song. Please try again.</div>
    </div>
  );
  
  // Main Game UI (from Daily.tsx)
  const renderGame = () => {
    if (loading) return renderGameLoading();
    if (!track) return renderGameError();

    return (
      <div className="flex flex-col items-center w-full max-w-2xl">
        {/* Hidden audio element */}
        {track.previewUrl && (
          <audio ref={audioRef} src={track.previewUrl} />
        )}

        {/* Play Button */}
        <button
          onClick={playSnippet}
          disabled={isPlaying || gameOver}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl mb-6 transition ${
            isPlaying
              ? "bg-gray-600 cursor-not-allowed"
              : gameOver
              ? (won ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isPlaying ? "⏸" : "▶️"}
        </button>

        {/* Search/Autocomplete */}
        {!gameOver && (
          <div className="w-full max-w-md mb-8">
            <Autocomplete onSelect={handleGuess} disabled={gameOver} />
            <p className="text-sm text-gray-400 mt-2 text-center">
              Attempt {currentAttempt + 1} of {MAX_ATTEMPTS} • {SNIPPET_DURATIONS[currentAttempt]}s unlocked
            </p>
          </div>
        )}

        {/* Guess History */}
        <div className="flex gap-3 mb-8">
          {[...Array(MAX_ATTEMPTS)].map((_, i) => {
            const guess = guesses[i];
            return (
              <div
                key={i}
                className={`w-16 h-16 rounded-lg flex items-center justify-center font-bold text-lg border-2 ${
                  guess
                    ? guess.correct
                      ? "bg-green-500 border-green-600"
                      : "bg-red-500 border-red-600"
                    : "bg-gray-700 border-gray-600"
                }`}
              >
                {guess ? (guess.correct ? "✅" : "❌") : i + 1}
              </div>
            );
          })}
        </div>

        {/* Guess details */}
        {guesses.length > 0 && !gameOver && (
          <div className="w-full max-w-md bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="font-bold mb-2">Your Guesses:</h3>
            {guesses.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1">
                <span>{g.correct ? "✅" : "❌"}</span>
                <span className="text-gray-300">{g.guess}</span>
              </div>
            ))}
          </div>
        )}

        {/* Game Over Modal */}
        {gameOver && (
          <div className="bg-gray-800 rounded-lg p-8 max-w-md text-center">
            <div className="text-4xl mb-4">{won ? "🎉" : "😢"}</div>
            <h2 className="text-2xl font-bold mb-2">
              {won ? `You got it in ${guesses.length} ${guesses.length === 1 ? "try" : "tries"}!` : "Game Over!"}
            </h2>
            <div className="bg-gray-700 rounded-lg p-4 mt-4">
              <img
                src={track.album.image}
                alt={track.name}
                className="w-32 h-32 mx-auto rounded mb-3"
              />
              <p className="text-xl font-bold">{track.name}</p>
              <p className="text-gray-400">{track.artists.join(", ")}</p>
              <p className="text-sm text-gray-500 mt-1">{track.album.name}</p>
            </div>
            {isHost && (
              <button
                onClick={startGame} // Re-use the startGame function to trigger a new round
                className="bg-green-600 px-6 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 transition-colors mt-6 shadow-lg"
              >
                Start Next Round
              </button>
            )}
            {!isHost && (
                <p className="text-gray-400 mt-4">Waiting for host to start the next round...</p>
            )}
          </div>
        )}
      </div>
    );
  };
  
  // Lobby Waiting Room UI
  const renderLobby = () => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl">
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
          disabled={players.length < 1} // Can start with 1 player (self)
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
  );

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
        {error && (
          <div className="bg-red-800 border border-red-600 text-red-100 px-4 py-3 rounded-lg mb-6" role="alert">
            <span className="font-bold">Connection Error: </span>
            <span>{error}</span>
          </div>
        )}
        
        {/* Switch between Game UI and Lobby UI */}
        {gameStarted ? renderGame() : renderLobby()}
        
      </main>
    </div>
  );
}