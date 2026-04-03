// Users management routes
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const PRESENCE_STALE_MS = 45000;

// In-memory presence store shared across active server process.
// Key: users.id (UUID), Value: { status, activeSince, lastSeenAt }
const presenceByUserId = new Map();
let presenceTableAvailable = null;

async function fetchPresenceFromSupabase(userIds) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return new Map();
  }

  if (presenceTableAvailable === false) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('user_presence')
    .select('user_id, is_online, active_since, last_seen_at, updated_at')
    .in('user_id', userIds);

  if (error) {
    // Table may not exist yet; keep app working with memory fallback.
    presenceTableAvailable = false;
    console.warn('user_presence table unavailable, using memory presence only:', error.message);
    return new Map();
  }

  presenceTableAvailable = true;
  const map = new Map();
  (data || []).forEach((row) => {
    const updatedAtMs = row.updated_at ? Date.parse(row.updated_at) : 0;
    const stale = row.is_online && (!updatedAtMs || (Date.now() - updatedAtMs > PRESENCE_STALE_MS));
    const effectiveOnline = stale ? false : !!row.is_online;

    map.set(row.user_id, {
      status: effectiveOnline ? 'Active' : 'Inactive',
      activeSince: effectiveOnline ? row.active_since : null,
      lastSeenAt: effectiveOnline ? row.last_seen_at : (row.last_seen_at || row.updated_at || null)
    });
  });
  return map;
}

async function upsertPresenceToSupabase(userId, active) {
  if (presenceTableAvailable === false) {
    return;
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    is_online: !!active,
    active_since: active ? now : null,
    last_seen_at: active ? null : now,
    updated_at: now
  };

  const { error } = await supabase
    .from('user_presence')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    presenceTableAvailable = false;
    console.warn('Failed to persist presence in Supabase, using memory fallback:', error.message);
    return;
  }

  presenceTableAvailable = true;
}

async function withPresence(users) {
  const list = users || [];
  const ids = list.map((u) => u.id).filter(Boolean);
  const persistedPresence = await fetchPresenceFromSupabase(ids);

  return list.map((user) => {
    const presence = presenceByUserId.get(user.id) || persistedPresence.get(user.id);
    return {
      ...user,
      status: presence?.status || 'Inactive',
      active_since: presence?.activeSince || null,
      last_seen_at: presence?.lastSeenAt || null
    };
  });
}

// Bootstrap users for frontend startup restore.
// Returns non-sensitive user fields only.
router.get('/bootstrap', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, student_id, course, year_level, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(await withPresence(users));
  } catch (error) {
    console.error('Bootstrap users error:', error);
    res.status(500).json({ error: 'Failed to restore users', message: error.message });
  }
});

// Update current user's online presence (requires auth).
router.post('/presence', verifyToken, async (req, res) => {
  try {
    const { active } = req.body || {};
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active(boolean) is required' });
    }

    const now = new Date().toISOString();
    if (active) {
      presenceByUserId.set(req.user.userId, {
        status: 'Active',
        activeSince: now,
        lastSeenAt: null
      });
    } else {
      presenceByUserId.set(req.user.userId, {
        status: 'Inactive',
        activeSince: null,
        lastSeenAt: now
      });
    }

    await upsertPresenceToSupabase(req.user.userId, active);

    const presence = presenceByUserId.get(req.user.userId);
    res.json({ ok: true, presence });
  } catch (error) {
    console.error('Presence update error:', error);
    res.status(500).json({ error: 'Failed to update presence', message: error.message });
  }
});

// Get all users (admin only)
router.get('/', verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, student_id, course, year_level, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(await withPresence(users));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users', message: error.message });
  }
});

// Get single user
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, student_id, course, year_level')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user', message: error.message });
  }
});

// Update user
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
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user', message: error.message });
  }
});

// Delete user permanently (admin only)
router.delete('/:userId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.params;
    const { username, student_id } = req.body || {};

    // Resolve exact target by id/username/student_id.
    const { data: candidates, error: findError } = await supabase
      .from('users')
      .select('id, username, student_id');
    if (findError) throw findError;

    const target = (candidates || []).find((row) => (
      String(row.id || '') === String(userId || '') ||
      String(row.username || '').toLowerCase() === String(userId || '').toLowerCase() ||
      String(row.student_id || '') === String(userId || '') ||
      (username && String(row.username || '').toLowerCase() === String(username).toLowerCase()) ||
      (student_id && String(row.student_id || '') === String(student_id))
    ));
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetId = target.id;

    // Clean presence row first (best effort)
    await supabase.from('user_presence').delete().eq('user_id', targetId);

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', targetId);

    if (deleteError) throw deleteError;

    presenceByUserId.delete(targetId);

    res.json({ ok: true, deletedUserId: targetId });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user', message: error.message });
  }
});

module.exports = router;
