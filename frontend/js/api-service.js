// Backend API Service - Connects frontend to backend

window.PRESENCE_SYNC_META = window.PRESENCE_SYNC_META || {
  source: 'none',
  lastSyncAt: null,
  ok: false,
  reason: ''
};

function isLikelyJwt(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function decodeJwtPayload(token) {
  try {
    if (!isLikelyJwt(token)) {
      return null;
    }
    const payloadPart = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadPart + '='.repeat((4 - (payloadPart.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function getAuthTokenContext() {
  const token = localStorage.getItem('authToken');
  if (!token || !isLikelyJwt(token)) {
    return { token: null, valid: false, role: null };
  }

  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== 'object') {
    localStorage.removeItem('authToken');
    return { token: null, valid: false, role: null };
  }

  if (typeof payload.exp === 'number') {
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSec) {
      localStorage.removeItem('authToken');
      return { token: null, valid: false, role: null };
    }
  }

  const role = String(payload?.role || payload?.userRole || '').toLowerCase() || null;
  return { token, valid: true, role };
}

function getApiBases() {
  const bases = [];
  const host = window.location.hostname;
  const protocol = window.location.protocol;

  // If app is served by backend, use same-origin first.
  if (window.location.port === '3000' || window.location.port === '5000') {
    bases.push('/api');
  }

  // If opened via LAN IP/hostname, try same host on backend ports.
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    bases.push(`${protocol}//${host}:5000/api`);
    bases.push(`${protocol}//${host}:3000/api`);
  }

  // Fallbacks for local development where frontend runs on another port.
  bases.push('http://localhost:5000/api');
  bases.push('http://localhost:3000/api');

  return [...new Set(bases)];
}

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add auth token if available
  const auth = getAuthTokenContext();
  if (auth.valid && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const bases = getApiBases();
  let lastNetworkError = null;

  for (const base of bases) {
    const url = `${base}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const rawText = await response.text();
      let data = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          data = { message: rawText };
        }
      }

      if (!response.ok) {
        const msg = (data && (data.message || data.error)) || `API Error: ${response.status}`;

        if (response.status === 401 && /jwt malformed|invalid token|unauthorized/i.test(String(msg))) {
          localStorage.removeItem('authToken');
        }

        const err = new Error(msg);
        err.status = response.status;
        err.url = url;
        throw err;
      }

      return data;
    } catch (error) {
      // Retry only for network errors; keep API errors as-is.
      if (error instanceof TypeError) {
        lastNetworkError = error;
        continue;
      }
      // Expected auth failures are handled by caller fallbacks; avoid noisy console spam.
      if (!(error && error.status === 401)) {
        console.error('API Error:', error);
      }
      throw error;
    }
  }

  console.error('API Network Error:', lastNetworkError);
  throw lastNetworkError || new Error('Could not reach backend API');
}

// Authentication API calls
async function apiRegister(fullName, firstName, lastName, studentId, email, course, year, password) {
  const response = await apiCall('/auth/register', {
    method: 'POST',
    body: {
      full_name: fullName,
      username: studentId.toLowerCase(),
      email,
      password,
      student_id: studentId,
      course,
      year_level: year,
      role: 'student'
    }
  });
  return response;
}

async function apiLogin(username, password) {
  const response = await apiCall('/auth/login', {
    method: 'POST',
    body: { username, password }
  });
  
  if (response.token) {
    localStorage.setItem('authToken', response.token);
    localStorage.setItem('currentUser', JSON.stringify(response.user));
  }
  
  return response;
}

async function apiLogout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
}

async function getStoredUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

// Ticket API calls
async function apiSubmitTicket(dept, subject, details, category) {
  const response = await apiCall('/tickets', {
    method: 'POST',
    body: {
      student_id: currentUser.id,
      department: dept,
      subject,
      details,
      category: category || dept,
      status: 'Pending'
    }
  });
  return response;
}

async function apiGetTickets() {
  const response = await apiCall('/tickets');
  return response;
}

async function apiGetUserTickets(userId) {
  const response = await apiCall(`/tickets/user/${userId}`);
  return response;
}

async function apiUpdateTicketStatus(ticketId, status) {
  const response = await apiCall(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: { status }
  });
  return response;
}

async function apiAddTicketReply(ticketId, reply, author, role) {
  const response = await apiCall(`/tickets/${ticketId}/replies`, {
    method: 'POST',
    body: {
      reply_text: reply,
      author_name: author,
      author_role: role
    }
  });
  return response;
}

// User API calls
async function apiGetUsers() {
  const response = await apiCall('/users');
  return response;
}

async function apiGetUsersBootstrap() {
  const response = await apiCall('/users/bootstrap');
  return response;
}

async function apiSetPresence(active) {
  const auth = getAuthTokenContext();
  if (!auth.valid) {
    return { ok: false, skipped: true, reason: 'no-valid-token' };
  }

  const response = await apiCall('/users/presence', {
    method: 'POST',
    body: { active: !!active }
  });
  return response;
}

function mapBackendRole(role) {
  const roleMap = {
    student: 'Student',
    accounting: 'Accounting',
    registrar: 'Registrar',
    faculty: 'Registrar',
    admin: 'Admin'
  };
  return roleMap[String(role || '').toLowerCase()] || 'Student';
}

function isBuiltInBackendUser(row) {
  const uname = String(row?.username || '').toLowerCase();
  const sid = String(row?.student_id || '').trim();
  const uid = String(row?.id || '').trim();

  const demoUsernames = ['21210747'];
  const demoIds = [
    '21210747',
    '2025-00123',
    '2025-00124',
    '2025-00125',
    '2025-00126',
    '2025-00127',
    '2025-00128'
  ];

  return demoUsernames.includes(uname) || demoIds.includes(sid) || demoIds.includes(uid);
}

function isMarkedDeletedBackendUser(row) {
  try {
    const raw = localStorage.getItem('deletedUsers');
    if (!raw) return false;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return false;

    const markers = list.map((x) => String(x || '').toLowerCase());
    const id = String(row?.id || '').toLowerCase();
    const sid = String(row?.student_id || '').toLowerCase();
    const uname = String(row?.username || '').toLowerCase();
    return markers.includes(id) || markers.includes(sid) || markers.includes(uname);
  } catch (e) {
    return false;
  }
}

function mergeUsersFromBackendRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }

  let changed = false;
  rows.forEach((row) => {
    if (isBuiltInBackendUser(row)) {
      return;
    }

    if (isMarkedDeletedBackendUser(row)) {
      return;
    }

    const preferredId = row.student_id || row.id;
    if (!preferredId) {
      return;
    }

    const existingIndex = USERS.findIndex(
      (u) => u.id === preferredId || (row.username && u.uname === row.username)
    );

    const fullName = row.full_name || row.username || 'User';
    const nameParts = fullName.trim().split(/\s+/);
    const ini = (nameParts[0]?.[0] || 'U') + (nameParts[1]?.[0] || '');
    const roleLabel = mapBackendRole(row.role);
    const isStudent = roleLabel === 'Student';

    const existingUser = existingIndex >= 0 ? USERS[existingIndex] : null;

    const hasPresenceFields =
      row.status === 'Active' ||
      row.status === 'Inactive' ||
      !!row.active_since ||
      !!row.activeSince ||
      !!row.last_seen_at ||
      !!row.lastSeenAt;

    const backendStatus = hasPresenceFields
      ? (row.status === 'Active' ? 'Active' : 'Inactive')
      : (existingUser?.status || 'Inactive');

    const resolvedActiveSince = hasPresenceFields
      ? (row.active_since || row.activeSince || (backendStatus === 'Active' ? (existingUser?.activeSince || '') : ''))
      : (existingUser?.activeSince || '');

    const resolvedLastSeenAt = hasPresenceFields
      ? (row.last_seen_at || row.lastSeenAt || (backendStatus !== 'Active' ? (existingUser?.lastSeenAt || '') : ''))
      : (existingUser?.lastSeenAt || '');

    const normalized = {
      name: fullName,
      id: preferredId,
      backendId: row.id || '',
      role: roleLabel,
      ini: ini.toUpperCase(),
      bg: isStudent ? 'rgba(26,162,96,0.15)' : 'rgba(37,99,235,0.15)',
      col: isStudent ? '#15803d' : '#1d4ed8',
      status: backendStatus,
      activeSince: resolvedActiveSince,
      lastSeenAt: resolvedLastSeenAt,
      isNew: false,
      email: row.email || '',
      course: row.course || '',
      year: row.year_level || '',
      uname: row.username || '',
      joinDate: row.created_at
        ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''
    };

    if (existingIndex >= 0) {
      const before = JSON.stringify(USERS[existingIndex]);
      const afterObj = { ...USERS[existingIndex], ...normalized };
      const after = JSON.stringify(afterObj);
      if (before !== after) {
        USERS[existingIndex] = afterObj;
        changed = true;
      }
      return;
    }

    USERS.unshift(normalized);
    changed = true;
  });

  if (changed && typeof saveUsers === 'function') {
    saveUsers();
  }

  return changed;
}

function restoreUsersFromSupabaseOnStartup() {
  if (typeof apiGetUsersBootstrap === 'undefined') {
    return Promise.resolve(false);
  }

  return apiGetUsersBootstrap()
    .then((rows) => {
      window.PRESENCE_SYNC_META = {
        source: 'bootstrap',
        lastSyncAt: new Date().toISOString(),
        ok: true,
        reason: ''
      };
      return mergeUsersFromBackendRows(rows);
    })
    .catch((err) => {
      console.log('Startup Supabase restore skipped:', err.message);
      window.PRESENCE_SYNC_META = {
        source: 'none',
        lastSyncAt: new Date().toISOString(),
        ok: false,
        reason: err.message || 'startup restore failed'
      };
      return false;
    });
}

function syncUsersFromBackend() {
  if (!currentUser || currentUser.role !== 'admin') {
    return Promise.resolve(false);
  }

  const auth = getAuthTokenContext();
  const canUseProtectedUsersEndpoint = !!(auth.valid && auth.role === 'admin');

  let usedSource = 'users';
  const fetchUsers = (canUseProtectedUsersEndpoint && typeof apiGetUsers === 'function'
    ? apiGetUsers()
    : Promise.reject(new Error('No valid auth token for /users')))
    .catch((err) => {
      // Fallback for local-admin sessions without valid backend auth token.
      if (typeof apiGetUsersBootstrap === 'function') {
        usedSource = 'bootstrap';
        return apiGetUsersBootstrap();
      }
      throw err;
    });

  return fetchUsers
    .then((rows) => {
      window.PRESENCE_SYNC_META = {
        source: usedSource,
        lastSyncAt: new Date().toISOString(),
        ok: true,
        reason: ''
      };
      return mergeUsersFromBackendRows(rows);
    })
    .catch((err) => {
      console.log('Backend user sync skipped:', err.message);
      window.PRESENCE_SYNC_META = {
        source: 'none',
        lastSyncAt: new Date().toISOString(),
        ok: false,
        reason: err.message || 'sync failed'
      };
      return false;
    });
}

async function apiGetUser(userId) {
  const response = await apiCall(`/users/${userId}`);
  return response;
}

async function apiUpdateUser(userId, userData) {
  const response = await apiCall(`/users/${userId}`, {
    method: 'PATCH',
    body: userData
  });
  return response;
}

async function apiDeleteUser(identifier, username = '', studentId = '') {
  const auth = getAuthTokenContext();
  if (!auth.valid || auth.role !== 'admin') {
    return { ok: false, skipped: true, reason: 'no-admin-token' };
  }

  const response = await apiCall(`/users/${encodeURIComponent(identifier)}`, {
    method: 'DELETE',
    body: {
      username,
      student_id: studentId
    }
  });
  return response;
}

// Announcements API calls
async function apiGetAnnouncements() {
  const response = await apiCall('/announcements');
  return response;
}

async function apiCreateAnnouncement(title, content, targetRole) {
  const response = await apiCall('/announcements', {
    method: 'POST',
    body: { title, content, target_role: targetRole }
  });
  return response;
}

async function apiDeleteAnnouncement(id) {
  const response = await apiCall(`/announcements/${id}`, {
    method: 'DELETE'
  });
  return response;
}

// Profile API calls
async function apiGetProfile(userId) {
  const response = await apiCall(`/profiles/${userId}`);
  return response;
}

async function apiUpdateProfile(userId, profileData) {
  const response = await apiCall(`/profiles/${userId}`, {
    method: 'PATCH',
    body: profileData
  });
  return response;
}

async function apiUploadProfilePhoto(userId, photoUrl) {
  const response = await apiCall(`/profiles/${userId}/photo`, {
    method: 'POST',
    body: { photo_url: photoUrl }
  });
  return response;
}
