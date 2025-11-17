import { useEffect, useState, useRef } from "react";
import { fetchDailySong, type TrackSuggestion } from "../api/spotify";
import type { SpotifyTrack } from "../api/spotify";
import Autocomplete from "../components/Autocomplete";
import { useNavigate } from "react-router-dom";

const MAX_ATTEMPTS = 5;
const SNIPPET_DURATIONS = [3, 6, 9, 12, 15]; 

export default function Daily() {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [guesses, setGuesses] = useState<{ correct: boolean; guess: string }[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load daily song on mount
  useEffect(() => {
    loadDailySong();
  }, []);

  const loadDailySong = async () => {
    try {
      setLoading(true);
      const data = await fetchDailySong();
      setTrack(data);
    } catch (error) {
      console.error("Failed to load daily song:", error);
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
        audioRef.current.play();
      }
    } else if (currentAttempt + 1 >= MAX_ATTEMPTS) {
      setGameOver(true);
      setWon(false);
    } else {
      setCurrentAttempt(currentAttempt + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="text-2xl">Loading today's song...</div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="text-2xl">Failed to load song. Please try again.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6">
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">🎵 Guessing Daily Song</h1>
        <button
          onClick={() => navigate("/")}
          className="bg-gray-700 px-4 py-2 rounded-lg hover:bg-gray-600 transition"
        >
          ← Back
        </button>
      </div>

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
            ? "bg-green-600 hover:bg-green-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isPlaying ? "⏸" : "▶️"}
      </button>

      {/* Waveform visualization */}
      <div className="flex gap-1 mb-8 h-16 items-end">
        {[...Array(30)].map((_, i) => {
          const isUnlocked = i < (SNIPPET_DURATIONS[currentAttempt] / 30) * 30;
          return (
            <div
              key={i}
              className={`w-2 rounded-t ${
                isUnlocked ? "bg-red-500" : "bg-gray-600"
              }`}
              style={{
                height: `${20 + Math.random() * 80}%`,
              }}
            />
          );
        })}
      </div>

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
      {guesses.length > 0 && (
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
        </div>
      )}
    </div>
  );
}
