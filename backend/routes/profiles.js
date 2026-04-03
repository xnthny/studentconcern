// Profiles routes
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

// Get user profile
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, student_id, course, year_level, profile_photo_url, created_at')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile', message: error.message });
  }
});

// Update user profile
router.patch('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { full_name, email, course, year_level } = req.body;

    // Users can only update their own profile unless they're admin
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        full_name,
        email,
        course,
        year_level,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile', message: error.message });
  }
});

// Upload profile photo
router.post('/:userId/photo', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { photoData } = req.body;

    // Users can only update their own photo unless they're admin
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!photoData) {
      return res.status(400).json({ error: 'Photo data is required' });
    }

    // In a real application, you would upload to Supabase Storage
    // For now, we'll just store the URL in the database
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        profile_photo_url: photoData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(updatedUser);
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ error: 'Failed to upload photo', message: error.message });
  }
});

module.exports = router;
