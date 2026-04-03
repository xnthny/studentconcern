// Main server file
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Import route handlers
const authRoutes = require('./routes/auth');
const ticketsRoutes = require('./routes/tickets');
const usersRoutes = require('./routes/users');
const announcementsRoutes = require('./routes/announcements');
const profileRoutes = require('./routes/profiles');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/profiles', profileRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ConcernTrack server running on port ${PORT}`);
  console.log(`Local health check: GET http://localhost:${PORT}/api/health`);
  console.log('LAN access: use your PC IPv4 address (for example http://192.168.x.x:' + PORT + ')');
});
