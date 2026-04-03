// Tickets routes
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

// Get all tickets (admin and staff)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*, student:users(full_name, email, course, year_level)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets', message: error.message });
  }
});

// Get user's tickets
router.get('/user/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(tickets);
  } catch (error) {
    console.error('Get user tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets', message: error.message });
  }
});

// Create new ticket
router.post('/', verifyToken, async (req, res) => {
  try {
    const { subject, details, category, department, priority } = req.body;
    const userId = req.user.userId;

    if (!subject || !details || !department) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: newTicket, error } = await supabase
      .from('tickets')
      .insert([
        {
          user_id: userId,
          subject,
          details,
          category: category || department,
          department,
          priority: priority || 'Medium',
          status: 'Pending',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(newTicket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Failed to create ticket', message: error.message });
  }
});

// Update ticket status
router.patch('/:ticketId/status', verifyToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, staffNote } = req.body;

    const { data: updatedTicket, error } = await supabase
      .from('tickets')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;

    // Add staff note as a reply if provided
    if (staffNote) {
      await supabase.from('ticket_replies').insert([
        {
          ticket_id: ticketId,
          from_user_id: req.user.userId,
          message: staffNote,
          is_staff: true,
          created_at: new Date().toISOString()
        }
      ]);
    }

    res.json(updatedTicket);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket', message: error.message });
  }
});

// Add reply to ticket
router.post('/:ticketId/replies', verifyToken, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { data: reply, error } = await supabase
      .from('ticket_replies')
      .insert([
        {
          ticket_id: ticketId,
          from_user_id: userId,
          message,
          is_staff: req.user.role !== 'student',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(reply);
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ error: 'Failed to add reply', message: error.message });
  }
});

module.exports = router;
