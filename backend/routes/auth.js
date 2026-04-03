// Authentication routes
const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { generateToken } = require('../middleware/auth');

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Query Supabase for user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    // Mark user active at login time (best effort).
    try {
      const now = new Date().toISOString();
      await supabase.from('user_presence').upsert(
        {
          user_id: user.id,
          is_online: true,
          active_since: now,
          last_seen_at: null,
          updated_at: now
        },
        { onConflict: 'user_id' }
      );
    } catch (presenceError) {
      // Presence table may not exist yet; login should still succeed.
      console.warn('Login presence upsert skipped:', presenceError.message);
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        name: user.full_name,
        role: user.role,
        email: user.email,
        student_id: user.student_id,
        course: user.course,
        year_level: user.year_level
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, password, full_name, email, course, year_level, student_id, role = 'student' } = req.body;

    if (!username || !password || !full_name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          username,
          password_hash: hashedPassword,
          full_name,
          email,
          role,
          student_id,
          course,
          year_level,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: 'Registration failed', message: error.message });
    }

    // Initialize presence row as inactive (best effort).
    try {
      const now = new Date().toISOString();
      await supabase.from('user_presence').upsert(
        {
          user_id: newUser.id,
          is_online: false,
          active_since: null,
          last_seen_at: now,
          updated_at: now
        },
        { onConflict: 'user_id' }
      );
    } catch (presenceError) {
      console.warn('Registration presence init skipped:', presenceError.message);
    }

    // Generate token
    const token = generateToken(newUser.id, newUser.role);

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        full_name: newUser.full_name,
        name: newUser.full_name,
        role: newUser.role,
        email: newUser.email,
        student_id: newUser.student_id,
        course: newUser.course,
        year_level: newUser.year_level
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

module.exports = router;
