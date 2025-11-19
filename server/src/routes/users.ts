import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// GET /api/users/:id - Get User Profile
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id, 10);

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    const result = await query('SELECT * FROM users WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/win - Simulate a Win (For Demo)
router.patch('/:id/win', async (req, res) => {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
        // Increment games_played and games_won
        const result = await query(`
            UPDATE users 
            SET games_played = games_played + 1, 
                games_won = games_won + 1,
                current_streak = current_streak + 1,
                max_streak = GREATEST(max_streak, current_streak + 1)
            WHERE user_id = $1
            RETURNING *
        `, [userId]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating stats:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;