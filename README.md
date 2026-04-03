# ConcernTrack - Student Concern Management System

A full-stack web application for managing student concerns and tickets across different departments (Accounting, Registrar, Faculty). Built with Node.js, Express, and Supabase.

## Project Structure

```
studentconcerndazo/
├── frontend/
│   ├── index.html                 # Main HTML file
│   ├── css/
│   │   └── styles.css             # All styles (extracted from index.html)
│   └── js/
│       ├── config.js              # Global configuration & data
│       ├── icons.js               # SVG icon definitions
│       ├── helpers.js             # Utility functions
│       ├── ui.js                  # UI management (sidebar)
│       ├── auth.js                # Authentication functions
│       ├── tickets.js             # Ticket detail display
│       ├── pages.js               # Main page renderers
│       ├── admin.js               # Admin & profile pages
│       ├── api.js                 # Form handlers
│       └── app.js                 # App initialization
├── backend/
│   ├── server.js                  # Main Express server
│   ├── package.json               # Node dependencies
│   ├── .env.example               # Environment variables template
│   ├── config/
│   │   └── supabase.js            # Supabase client setup
│   ├── middleware/
│   │   └── auth.js                # JWT authentication middleware
│   └── routes/
│       ├── auth.js                # Authentication endpoints
│       ├── tickets.js             # Ticket management endpoints
│       ├── users.js               # User management endpoints
│       ├── announcements.js       # Announcements endpoints
│       └── profiles.js            # Profile management endpoints
└── README.md                       # This file

```

## Key Features

- **Frontend**: Clean, modular JavaScript with separated concerns (config, UI, auth, pages, etc.)
- **Backend**: RESTful API built with Express.js
- **Database**: Supabase (PostgreSQL with real-time capabilities)
- **Authentication**: JWT-based with bcrypt password hashing
- **User Roles**: Student, Accounting, Registrar, Faculty, Admin
- **Ticket System**: Create, view, update concerns with real-time status updates
- **Announcements**: Admin can post system-wide announcements
- **Responsive Design**: Works on desktop and mobile devices

## Setup Instructions

### 1. Frontend Setup

The frontend is a client-side application with no build process needed. Just open `frontend/index.html` in a browser:

```bash
cd frontend
# Open in browser: file:///path/to/frontend/index.html
```

Or serve with a local server:

```bash
cd frontend
# Using Python 3
python -m http.server 8000

# Using Node.js http-server
npx http-server -p 8000
```

Then visit: `http://localhost:8000`

### 2. Backend Setup

#### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Supabase account (free tier available at https://supabase.com)

#### Installation

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PORT=5000
JWT_SECRET=your_secret_key_here
```

5. Start the server:
```bash
# Production
npm start

# Development (with nodemon auto-reload)
npm run dev
```

The server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/register` - Register new student

### Tickets
- `GET /api/tickets` - Get all tickets (admin/staff)
- `GET /api/tickets/user/:userId` - Get user's tickets
- `POST /api/tickets` - Create new ticket
- `PATCH /api/tickets/:ticketId/status` - Update ticket status
- `POST /api/tickets/:ticketId/replies` - Add reply to ticket

### Users
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:userId` - Get user details
- `PATCH /api/users/:userId` - Update user

### Announcements
- `GET /api/announcements` - Get all announcements
- `POST /api/announcements` - Create announcement (admin)
- `DELETE /api/announcements/:id` - Delete announcement (admin)

### Profiles
- `GET /api/profiles/:userId` - Get user profile
- `PATCH /api/profiles/:userId` - Update profile
- `POST /api/profiles/:userId/photo` - Upload profile photo

## Database Schema (Supabase)

### Tables needed:

**users**
- id (UUID, primary key)
- username (text, unique)
- password_hash (text)
- full_name (text)
- email (text, unique)
- role (text: 'student', 'accounting', 'registrar', 'faculty', 'admin')
- student_id (text)
- course (text)
- year_level (text)
- profile_photo_url (text)
- created_at (timestamp)
- updated_at (timestamp)

**tickets**
- id (UUID, primary key)
- user_id (UUID, foreign key)
- subject (text)
- details (text)
- category (text)
- department (text)
- priority (text: 'Low', 'Medium', 'High')
- status (text: 'Pending', 'In Progress', 'Resolved', 'Rejected')
- created_at (timestamp)
- updated_at (timestamp)

**ticket_replies**
- id (UUID, primary key)
- ticket_id (UUID, foreign key)
- from_user_id (UUID, foreign key)
- message (text)
- is_staff (boolean)
- created_at (timestamp)

**announcements**
- id (UUID, primary key)
- title (text)
- message (text)
- audience (text: 'All Users', 'Students Only', 'Staff Only')
- is_draft (boolean)
- created_by (UUID, foreign key)
- created_at (timestamp)

## Demo Accounts

Frontend demo (no backend required):
- **Student**: Username: 2025-00123, Password: any
- **Accounting**: maria.santos / acctg123
- **Registrar**: jose.reyes / reg123
- **Faculty**: ana.torres / faculty123
- **Admin**: admin / admin123

## Frontend and Backend Communication

The frontend is currently self-contained and doesn't communicate with the backend API. To integrate:

1. Create an `api.js` module in frontend to handle API calls
2. Replace local data operations with API calls
3. Update authentication to use backend tokens
4. Implement proper error handling and loading states

Each API call should include the JWT token in the Authorization header:
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

## Development Notes

### Frontend
- All page rendering is done via JavaScript strings (no framework)
- State is managed globally in `config.js`
- Modular design with separated concerns
- No build process required

### Backend
- Uses Express.js middleware for CORS and JSON parsing
- JWT token verification on protected routes
- Bcrypt for password hashing
- Error handling middleware for consistency

## Security Considerations

- [ ] Add rate limiting to API endpoints
- [ ] Implement HTTPS in production
- [ ] Validate all input on both frontend and backend
- [ ] Add CSRF protection
- [ ] Use environment variables for sensitive data
- [ ] Implement proper file upload validation
- [ ] Add request validation middleware
- [ ] Implement audit logging

## Future Enhancements

- [ ] Real-time notifications using Supabase Real-time
- [ ] File upload support for attachments
- [ ] Email notifications
- [ ] Advanced filtering and search
- [ ] Export reports to PDF/CSV
- [ ] Integration with institutional email system
- [ ] Mobile app (React Native/Flutter)
- [ ] Analytics dashboard
- [ ] Bulk operations for admin

## Troubleshooting

### Frontend Issues
- **Blank page**: Check browser console for JavaScript errors
- **Styles not loading**: Ensure CSS path is correct in index.html
- **Local storage issues**: Check browser's local storage permission

### Backend Issues
- **Connection refused**: Ensure server is running on correct port
- **Supabase connection error**: Verify credentials in .env file
- **Authentication failed**: Check JWT_SECRET matches between frontend and backend

## Support & Documentation

- Supabase Docs: https://supabase.com/docs
- Express.js Docs: https://expressjs.com/
- JavaScript: https://developer.mozilla.org/en-US/docs/Web/JavaScript/

## License

MIT License - Feel free to use for educational purposes
