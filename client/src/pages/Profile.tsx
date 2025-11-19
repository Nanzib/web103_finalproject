import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header';

interface UserProfile {
  user_id: number;
  username: string;
  created_at: string;
  games_played: number;
  games_won: number;
  current_streak: number;
  max_streak: number;
}

const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // --- CRITICAL FIX: Define the Server URL ---
        const API_URL = import.meta.env.PROD 
          ? 'https://beatdle-server.onrender.com' 
          : 'http://localhost:8000';
        
        // Use the full URL here
        const response = await fetch(`${API_URL}/api/users/${id}`);
        // -------------------------------------------
        
        if (!response.ok) {
          throw new Error('Profile not found');
        }
        const data: UserProfile = await response.json();
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [id]);

  if (loading) {
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
            Loading profile...
        </div>
    );
  }

  if (error) {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900 text-white">
            <p className="text-red-500">{error}</p>
            <Link to="/" className="mt-4 text-blue-400 hover:underline">&larr; Back to Home</Link>
        </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header />
      <div className="max-w-md mx-auto bg-gray-800 rounded-lg shadow-lg p-6 mt-4">
        <h1 className="text-3xl font-bold mb-4 text-center">{user.username}</h1>
        <p className="text-gray-400 mb-6 text-center">
          Member since: {new Date(user.created_at).toLocaleDateString()}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{user.games_played}</div>
            <div className="text-gray-400">Games Played</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{user.games_won}</div>
            <div className="text-gray-400">Games Won</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{user.current_streak}</div>
            <div className="text-gray-400">Current Streak</div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold">{user.max_streak}</div>
            <div className="text-gray-400">Max Streak</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;