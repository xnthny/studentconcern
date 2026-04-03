// Global application configuration and data
let ACCOUNTS = {
  'maria.santos': { password: 'acctg123', role: 'accounting', name: 'Maria Santos', id: 'ACC-001', ini: 'MS', bg: 'rgba(37,99,235,0.2)', col: '#3b82f6', isNew: false },
  'jose.reyes': { password: 'reg123', role: 'registrar', name: 'Jose Reyes', id: 'REG-001', ini: 'JR', bg: 'rgba(240,180,41,0.2)', col: '#d97706', isNew: false },
  'admin': { password: 'admin123', role: 'admin', name: 'Admin User', id: 'ADM-001', ini: 'AU', bg: 'rgba(139,92,246,0.2)', col: '#7c3aed', isNew: false },
};

const STAFF_ACCOUNT_KEYS = ['maria.santos', 'jose.reyes', 'admin'];
const STAFF_CANONICAL_BY_ID = {
  'ACC-001': 'maria.santos',
  'REG-001': 'jose.reyes',
  'ADM-001': 'admin'
};
const STAFF_DEFAULT_PASSWORDS = {
  'maria.santos': 'acctg123',
  'jose.reyes': 'reg123',
  'admin': 'admin123'
};

function getStaffPasswordOverrides() {
  try {
    const raw = localStorage.getItem('staffPasswordOverrides');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function getCanonicalStaffKey(value) {
  const v = String(value || '').toLowerCase();
  if (!v) {
    return '';
  }
  if (STAFF_ACCOUNT_KEYS.includes(v)) {
    return v;
  }

  const byId = Object.keys(STAFF_CANONICAL_BY_ID).find((id) => id.toLowerCase() === v);
  if (byId) {
    return STAFF_CANONICAL_BY_ID[byId];
  }

  const entry = Object.entries(ACCOUNTS).find(([key, acc]) => {
    const id = String(acc?.id || '').toLowerCase();
    return key.toLowerCase() === v || id === v;
  });
  if (entry) {
    const [key, acc] = entry;
    return STAFF_CANONICAL_BY_ID[String(acc?.id || '').toUpperCase()] || key;
  }

  return '';
}

function getStaffPasswordOverride(value) {
  const key = getCanonicalStaffKey(value);
  if (!key) {
    return '';
  }
  const map = getStaffPasswordOverrides();
  return String(map[key] || '');
}

function setStaffPasswordOverride(value, password) {
  const key = getCanonicalStaffKey(value);
  if (!key || !password) {
    return;
  }
  const map = getStaffPasswordOverrides();
  map[key] = String(password);
  try {
    localStorage.setItem('staffPasswordOverrides', JSON.stringify(map));
  } catch (e) {
    console.error('Failed to save staff password override:', e);
  }
}

const BUILTIN_USERNAMES = [];

const BUILTIN_USER_IDS = [
  '2025-00123',
  '2025-00124',
  '2025-00125',
  '2025-00126',
  '2025-00127',
  '2025-00128'
];

function isBuiltInUserRecord(user) {
  if (!user) {
    return false;
  }

  const uname = String(user.uname || '').toLowerCase();
  const id = String(user.id || '').trim();
  return BUILTIN_USERNAMES.includes(uname) || BUILTIN_USER_IDS.includes(id);
}

function isRemovedFacultyRecord(user) {
  if (!user) {
    return false;
  }

  const uname = String(user.uname || '').toLowerCase();
  const id = String(user.id || '').trim().toUpperCase();
  const name = String(user.name || '').toLowerCase();
  return uname === 'ana.torres' || id === 'FAC-001' || name.includes('ana torres');
}

function getDeletedUserMarkers() {
  try {
    const raw = localStorage.getItem('deletedUsers');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((value) => String(value || '').toLowerCase()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function isDeletedUserRecord(user, username) {
  const markers = getDeletedUserMarkers();
  if (!markers.length) {
    return false;
  }

  const id = String(user?.id || user?.student_id || '').toLowerCase();
  const uname = String(username || user?.uname || user?.username || '').toLowerCase();
  return (id && markers.includes(id)) || (uname && markers.includes(uname));
}

function normalizeStaffRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'accounting') return 'Accounting';
  if (r === 'registrar') return 'Registrar';
  if (r === 'faculty') return 'Registrar';
  if (r === 'admin') return 'Admin';
  return 'Staff';
}

function ensureCoreStaffUsers() {
  const coreStaffUsernames = ['maria.santos', 'jose.reyes', 'admin'];
  let changed = false;

  coreStaffUsernames.forEach((uname) => {
    const acc = ACCOUNTS[uname];
    if (!acc) {
      return;
    }

    const exists = USERS.some((u) => u.id === acc.id || String(u.uname || '').toLowerCase() === uname);
    if (exists) {
      return;
    }

    USERS.unshift({
      name: acc.name,
      id: acc.id,
      role: normalizeStaffRole(acc.role),
      ini: acc.ini,
      bg: acc.bg ? acc.bg.replace('0.2', '0.15') : 'rgba(37,99,235,0.15)',
      col: acc.col || '#1d4ed8',
      status: 'Inactive',
      isNew: false,
      email: '',
      course: '',
      year: '',
      uname
    });
    changed = true;
  });

  return changed;
}

// Load registered students from localStorage on startup
function loadRegisteredStudents() {
  const stored = localStorage.getItem('registeredStudents') || localStorage.getItem('registeredStudentsBackup');
  if (stored) {
    try {
      // Remove non-staff accounts first so deleted students do not get reintroduced.
      Object.keys(ACCOUNTS).forEach((key) => {
        if (!['maria.santos', 'jose.reyes', 'admin'].includes(key)) {
          delete ACCOUNTS[key];
        }
      });

      const registered = JSON.parse(stored);
      // Completely replace registered accounts (not merge) to avoid stale data
      for (const [key, acc] of Object.entries(registered)) {
        if (!isDeletedUserRecord(acc, key)) {
          ACCOUNTS[key] = acc;
        }
      }
      // Keep ALL student accounts - no size limits to preserve all registrations
    } catch (e) {
      console.error('Failed to load registered students:', e);
    }
  }
}

// Save new student registration to localStorage with explicit cleanup
function saveStudentRegistration(username, account, oldUsername) {
  // Always set the new account
  ACCOUNTS[username] = account;
  
  // CRITICAL: Delete old entry if username changed
  if (oldUsername && oldUsername !== username && ACCOUNTS[oldUsername]) {
    delete ACCOUNTS[oldUsername];
    console.log('Deleted old account entry:', oldUsername);
  }
  
  // Get all registered students (non-admin/staff accounts only; student accounts are always persisted)
  const demoAccounts = ['maria.santos', 'jose.reyes', 'admin'];
  const registered = {};
  
  for (const [key, acc] of Object.entries(ACCOUNTS)) {
    if (!demoAccounts.includes(key)) {
      registered[key] = acc;
    }
  }
  
  // Keep ALL student registrations - no size limits
  // Save to localStorage
  try {
    localStorage.setItem('registeredStudents', JSON.stringify(registered));
    localStorage.setItem('registeredStudentsBackup', JSON.stringify(registered));
    console.log('Saved registeredStudents:', Object.keys(registered));
  } catch (e) {
    console.error('Error saving registered students:', e);
  }
}

function loadStaffAccounts() {
  const raw = localStorage.getItem('staffAccounts') || localStorage.getItem('accountsList');
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return;
    }

    STAFF_ACCOUNT_KEYS.forEach((key) => {
      const canonical = parsed[key];
      const aliasCandidates = Object.entries(parsed)
        .filter(([aliasKey, acc]) => aliasKey !== key && STAFF_CANONICAL_BY_ID[String(acc?.id || '').toUpperCase()] === key)
        .map(([, acc]) => acc);
      const candidates = [canonical, ...aliasCandidates].filter(Boolean);
      if (!candidates.length || !ACCOUNTS[key]) {
        return;
      }

      const defaultPassword = STAFF_DEFAULT_PASSWORDS[key] || '';
      const preferred = candidates.find((acc) => String(acc.password || '') && String(acc.password) !== defaultPassword) || candidates[0];
      ACCOUNTS[key] = { ...ACCOUNTS[key], ...preferred };
      ACCOUNTS[key].role = String(ACCOUNTS[key].role || key).toLowerCase();

      const overridePw = getStaffPasswordOverride(key);
      if (overridePw) {
        ACCOUNTS[key].password = overridePw;
      }
    });

    let changed = false;
    Object.keys(ACCOUNTS).forEach((key) => {
      const canonicalKey = STAFF_CANONICAL_BY_ID[String(ACCOUNTS[key]?.id || '').toUpperCase()];
      if (!canonicalKey || key === canonicalKey) {
        return;
      }

      if (ACCOUNTS[canonicalKey]) {
        const aliasPassword = String(ACCOUNTS[key]?.password || '');
        const canonicalPassword = String(ACCOUNTS[canonicalKey]?.password || '');
        const defaultPassword = STAFF_DEFAULT_PASSWORDS[canonicalKey] || '';
        const useAliasPassword = aliasPassword && (canonicalPassword === defaultPassword || !canonicalPassword);

        ACCOUNTS[canonicalKey] = {
          ...ACCOUNTS[canonicalKey],
          ...ACCOUNTS[key],
          role: String(ACCOUNTS[canonicalKey].role || ACCOUNTS[key].role || '').toLowerCase(),
          password: useAliasPassword ? aliasPassword : canonicalPassword
        };
      }

      delete ACCOUNTS[key];
      changed = true;
    });

    if (changed) {
      localStorage.setItem('accountsList', JSON.stringify(ACCOUNTS));
    }

    // Persist normalized snapshot so future loads are deterministic.
    saveStaffAccounts();
  } catch (e) {
    console.error('Failed to load staff accounts:', e);
  }
}

function saveStaffAccounts() {
  const payload = {};
  STAFF_ACCOUNT_KEYS.forEach((key) => {
    if (ACCOUNTS[key]) {
      const overridePw = getStaffPasswordOverride(key);
      if (overridePw) {
        ACCOUNTS[key].password = overridePw;
      }
      payload[key] = { ...ACCOUNTS[key] };
    }
  });

  try {
    localStorage.setItem('staffAccounts', JSON.stringify(payload));
    localStorage.setItem('accountsList', JSON.stringify(ACCOUNTS));
  } catch (e) {
    console.error('Failed to save staff accounts:', e);
  }
}

// Load on startup
loadRegisteredStudents();
loadStaffAccounts();

// Save users list to localStorage
function saveUsers() {
  try {
    const serialized = JSON.stringify(USERS);
    localStorage.setItem('usersList', serialized);
    localStorage.setItem('usersListBackup', serialized);
    return true;
  } catch (e) {
    console.error('Failed to save users list:', e);
    return false;
  }
}

function syncUsersFromRegisteredStorage() {
  const raw = localStorage.getItem('registeredStudents') || localStorage.getItem('registeredStudentsBackup');
  if (!raw) {
    return false;
  }

  let changed = false;
  try {
    const registered = JSON.parse(raw);
    if (!registered || typeof registered !== 'object') {
      return false;
    }

    for (const [uname, acc] of Object.entries(registered)) {
      if (!acc || !acc.id) {
        continue;
      }

      if (isDeletedUserRecord(acc, uname)) {
        continue;
      }

      const existingIndex = USERS.findIndex(
        (u) => u.id === acc.id || String(u.uname || '').toLowerCase() === String(uname).toLowerCase()
      );

      const names = String(acc.name || '').trim().split(/\s+/);
      const first = names[0] || 'Student';
      const second = names[1] || '';
      const ini = String(acc.ini || (first[0] || 'S') + (second[0] || '')).toUpperCase();

      const normalized = {
        name: acc.name || `Student ${acc.id}`,
        id: acc.id,
        role: 'Student',
        ini,
        bg: 'rgba(26,162,96,0.15)',
        col: '#15803d',
        status: existingIndex >= 0 ? USERS[existingIndex].status || 'Inactive' : 'Inactive',
        isNew: !!acc.isNew,
        email: acc.email || '',
        course: acc.course || '',
        year: acc.year || '',
        uname,
        joinDate: existingIndex >= 0 ? USERS[existingIndex].joinDate || '' : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };

      if (existingIndex >= 0) {
        const before = JSON.stringify(USERS[existingIndex]);
        const afterObj = { ...USERS[existingIndex], ...normalized };
        const after = JSON.stringify(afterObj);
        if (before !== after) {
          USERS[existingIndex] = afterObj;
          changed = true;
        }
      } else {
        USERS.unshift(normalized);
        changed = true;
      }
    }
  } catch (e) {
    console.error('Failed to sync users from registered storage:', e);
    return false;
  }

  return changed;
}

// Load users from localStorage
function loadUsers() {
  // Keep ACCOUNTS aligned with persisted registrations before rebuilding USERS.
  loadRegisteredStudents();

  const stored = localStorage.getItem('usersList') || localStorage.getItem('usersListBackup');
  let changed = false;

  if (stored) {
    try {
      const loaded = JSON.parse(stored);
      // Keep ALL users - no size limit to preserve registered students
      if (Array.isArray(loaded)) {
        const filtered = loaded.filter((u) => !isBuiltInUserRecord(u) && !isRemovedFacultyRecord(u) && !isDeletedUserRecord(u));
        USERS = filtered;
        changed = filtered.length !== loaded.length;
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  }

  // Safety net: ensure registered student accounts are present in USERS.
  // This recovers accounts if usersList was removed previously.
  const reservedLogins = ['21210747', 'maria.santos', 'jose.reyes', 'admin'];
  for (const [uname, acc] of Object.entries(ACCOUNTS)) {
    if (!acc || acc.role !== 'student' || reservedLogins.includes(uname) || isDeletedUserRecord(acc, uname)) {
      continue;
    }

    const exists = USERS.some((u) => u.id === acc.id);
    if (exists) {
      continue;
    }

    const names = String(acc.name || '').trim().split(/\s+/);
    const first = names[0] || 'Student';
    const second = names[1] || '';
    const ini = String(acc.ini || (first[0] || 'S') + (second[0] || '')).toUpperCase();

    USERS.unshift({
      name: acc.name || `Student ${acc.id || ''}`.trim(),
      id: acc.id || uname,
      role: 'Student',
      ini,
      bg: 'rgba(26,162,96,0.15)',
      col: '#15803d',
      status: 'Inactive',
      isNew: !!acc.isNew,
      email: acc.email || '',
      course: acc.course || '',
      year: acc.year || '',
      uname,
      joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });
    changed = true;
  }

  if (syncUsersFromRegisteredStorage()) {
    changed = true;
  }

  if (ensureCoreStaffUsers()) {
    changed = true;
  }

  const beforePrune = USERS.length;
  USERS = USERS.filter((u) => !isRemovedFacultyRecord(u) && !isDeletedUserRecord(u));
  if (USERS.length !== beforePrune) {
    changed = true;
  }

  if (changed) {
    saveUsers();
  }
}

// Save tickets to localStorage
function saveTickets() {
  try {
    // Save ALL tickets and keep a mirror backup for recovery.
    if (Array.isArray(TICKETS)) {
      const serialized = JSON.stringify(TICKETS);
      localStorage.setItem('ticketsList', serialized);
      localStorage.setItem('ticketsListBackup', serialized);
    }
  } catch (e) {
    // Retry once after removing non-critical backup mirrors.
    try {
      localStorage.removeItem('usersListBackup');
      localStorage.removeItem('registeredStudentsBackup');
      localStorage.removeItem('announcementsListBackup');
      if (Array.isArray(TICKETS)) {
        const serialized = JSON.stringify(TICKETS);
        localStorage.setItem('ticketsList', serialized);
        localStorage.setItem('ticketsListBackup', serialized);
      }
    } catch (retryErr) {
      console.error('Error saving tickets:', retryErr);
    }
  }
}

function getDeletedConcernIds() {
  try {
    const raw = localStorage.getItem('deletedConcernIds');
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((id) => String(id || '').trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function resolveTicketStudentMetadata(ticket) {
  if (!ticket) {
    return { studentId: '', course: '', year: '' };
  }

  const normalizedName = String(ticket.student || '').trim().toLowerCase();
  const existingStudentId = String(ticket.studentId || ticket.student_id || '').trim();
  const existingStudentUname = String(ticket.studentUsername || ticket.studentUname || ticket.student_uname || '').trim();
  const directCourse = String(ticket.course || ticket.studentCourse || '').trim();
  const directYear = String(ticket.year || ticket.studentYear || '').trim();

  if (existingStudentId && (directCourse || directYear)) {
    return { studentId: existingStudentId, course: directCourse, year: directYear };
  }

  const byName = getStudentInfo(ticket.student);
  if (byName?.course || byName?.year) {
    return {
      studentId: existingStudentId,
      course: directCourse || String(byName.course || '').trim(),
      year: directYear || String(byName.year || '').trim()
    };
  }

  const idCandidates = [existingStudentId, existingStudentUname]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  const user = (USERS || []).find((u) => {
    const uid = String(u?.id || '').trim().toLowerCase();
    const uname = String(u?.uname || '').trim().toLowerCase();
    const unameMatch = !!uname && idCandidates.includes(uname);
    const idMatch = !!uid && idCandidates.includes(uid);
    const nameMatch = normalizedName && String(u?.name || '').trim().toLowerCase() === normalizedName;
    return unameMatch || idMatch || nameMatch;
  });
  if (user?.course || user?.year) {
    return {
      studentId: existingStudentId || String(user.id || '').trim(),
      course: directCourse || String(user.course || '').trim(),
      year: directYear || String(user.year || '').trim()
    };
  }

  const accountEntry = Object.entries(ACCOUNTS || {}).find(([key, acc]) => {
    const aid = String(acc?.id || '').trim().toLowerCase();
    const akey = String(key || '').trim().toLowerCase();
    const aname = String(acc?.name || '').trim().toLowerCase();
    const idMatch = !!aid && idCandidates.includes(aid);
    const keyMatch = !!akey && idCandidates.includes(akey);
    const nameMatch = normalizedName && aname === normalizedName;
    return idMatch || keyMatch || nameMatch;
  });
  if (accountEntry) {
    const [, account] = accountEntry;
    return {
      studentId: existingStudentId || String(account?.id || '').trim(),
      course: directCourse || String(account?.course || '').trim(),
      year: directYear || String(account?.year || '').trim()
    };
  }

  return { studentId: existingStudentId, course: directCourse, year: directYear };
}

function backfillTicketStudentMetadata(saveIfChanged = false) {
  if (!Array.isArray(TICKETS) || !TICKETS.length) {
    return false;
  }

  let changed = false;
  TICKETS.forEach((ticket) => {
    const meta = resolveTicketStudentMetadata(ticket);
    const nextId = String(ticket.studentId || ticket.student_id || '').trim() || String(meta.studentId || '').trim();
    const nextCourse = String(ticket.course || '').trim() || String(meta.course || '').trim();
    const nextYear = String(ticket.year || '').trim() || String(meta.year || '').trim();

    if (nextId && String(ticket.studentId || '').trim() !== nextId) {
      ticket.studentId = nextId;
      changed = true;
    }
    if (nextCourse && String(ticket.course || '').trim() !== nextCourse) {
      ticket.course = nextCourse;
      changed = true;
    }
    if (nextYear && String(ticket.year || '').trim() !== nextYear) {
      ticket.year = nextYear;
      changed = true;
    }
  });

  if (changed && saveIfChanged) {
    saveTickets();
  }
  return changed;
}

// Load tickets from localStorage
function loadTickets() {
  const stored = localStorage.getItem('ticketsList') || localStorage.getItem('ticketsListBackup');
  if (stored) {
    try {
      const loaded = JSON.parse(stored);
      TICKETS = Array.isArray(loaded) ? loaded : [];

      // Always hide concerns that were explicitly deleted by staff/admin actions.
      const deletedIds = getDeletedConcernIds();
      if (deletedIds.length) {
        TICKETS = TICKETS.filter((t) => !deletedIds.includes(String(t?.id || '').trim()));
      }

      // One-time migration: remove the known invalid accounting ticket.
      const migrationKey = 'ticketsPurgeTKT903V1';
      if (!localStorage.getItem(migrationKey)) {
        const before = TICKETS.length;
        TICKETS = TICKETS.filter((t) => {
          const id = String(t?.id || '').trim();
          const remove = id === 'TKT-903';
          return !remove;
        });

        if (TICKETS.length !== before) {
          saveTickets();
        }

        // Track this bad concern id in the deleted concern list so it cannot return.
        try {
          const merged = Array.from(new Set([...getDeletedConcernIds(), 'TKT-903']));
          localStorage.setItem('deletedConcernIds', JSON.stringify(merged));
        } catch (e) {}

        localStorage.setItem(migrationKey, '1');
      }

      backfillTicketStudentMetadata(true);
    } catch (e) {
      console.error('Failed to load tickets:', e);
      try {
        const backup = localStorage.getItem('ticketsListBackup');
        const recovered = backup ? JSON.parse(backup) : [];
        TICKETS = Array.isArray(recovered) ? recovered : [];
      } catch (e2) {
        TICKETS = [];
      }
    }
  }
}

function saveChatThreads() {
  try {
    localStorage.setItem('chatThreads', JSON.stringify(CHAT_THREADS));
  } catch (e) {
    console.error('Failed to save chat threads:', e);
  }
}

function loadChatThreads() {
  const stored = localStorage.getItem('chatThreads');
  if (stored) {
    try {
      const loaded = JSON.parse(stored);
      CHAT_THREADS = loaded && typeof loaded === 'object' ? loaded : {};
    } catch (e) {
      console.error('Failed to load chat threads:', e);
      CHAT_THREADS = {};
    }
  }
}

// Save announcements to localStorage
function saveAnnouncements() {
  try {
    // Save ALL announcements and mirror to backup for recovery after cleanup/corruption.
    if (Array.isArray(ANNOUNCEMENTS)) {
      const serialized = JSON.stringify(ANNOUNCEMENTS);
      localStorage.setItem('announcementsList', serialized);
      localStorage.setItem('announcementsListBackup', serialized);
      return true;
    }
    return false;
  } catch (e) {
    // If quota is full, drop non-critical backup mirrors and retry once.
    try {
      localStorage.removeItem('usersListBackup');
      localStorage.removeItem('registeredStudentsBackup');
      const serialized = JSON.stringify(Array.isArray(ANNOUNCEMENTS) ? ANNOUNCEMENTS : []);
      localStorage.setItem('announcementsList', serialized);
      localStorage.setItem('announcementsListBackup', serialized);
      return true;
    } catch (retryErr) {
      console.error('Error saving announcements:', retryErr);
      return false;
    }
  }
}

// Load announcements from localStorage
function loadAnnouncements() {
  const stored = localStorage.getItem('announcementsList') || localStorage.getItem('announcementsListBackup');
  let changed = false;

  if (stored) {
    try {
      const loaded = JSON.parse(stored);
      ANNOUNCEMENTS = Array.isArray(loaded) ? loaded : [];
    } catch (e) {
      console.error('Failed to load announcements:', e);
      try {
        const backup = localStorage.getItem('announcementsListBackup');
        const recovered = backup ? JSON.parse(backup) : [];
        ANNOUNCEMENTS = Array.isArray(recovered) ? recovered : [];
      } catch (e2) {
        console.error('Failed to recover announcements from backup:', e2);
        ANNOUNCEMENTS = [];
      }
    }
  }

  // One-time migration: remove only exact old built-in seeded entries.
  const migrationKey = 'announcementsBuiltinPurgeV1';
  if (!localStorage.getItem(migrationKey)) {
    const beforeCount = ANNOUNCEMENTS.length;
    const oldBuiltins = [
      {
        title: 'system maintenance schedule',
        body: 'the system will be down on april 5, 2-4 am.',
        date: 'march 30, 2025'
      },
      {
        title: 'enrollment period now open',
        body: 'second semester enrollment is open until april 10.',
        date: 'march 28, 2025'
      },
      {
        title: 'final grade submission deadline',
        body: 'staff must submit final grades by april 15.',
        date: 'march 25, 2025'
      }
    ];

    ANNOUNCEMENTS = ANNOUNCEMENTS.filter((a) => {
      if (!a) return false;
      const title = String(a.title || '').trim().toLowerCase();
      const body = String(a.body || '').trim().toLowerCase().replace(/\u2013/g, '-');
      const date = String(a.date || '').trim().toLowerCase();

      const isLegacy = oldBuiltins.some((b) => b.title === title && b.body === body && b.date === date);
      return !isLegacy;
    });

    if (ANNOUNCEMENTS.length !== beforeCount) {
      changed = true;
    }
    localStorage.setItem(migrationKey, '1');
  }

  if (changed) {
    saveAnnouncements();
  }
}


// Student info lookup by name
const STUDENT_INFO = {
  'Juan dela Cruz': { course: 'BS Computer Science', year: '2nd Year', email: 'juan@school.edu.ph' },
  'Maria Lim': { course: 'BS Criminology', year: '1st Year', email: 'maria@school.edu.ph' },
  'Pedro Cruz': { course: 'BSED', year: '3rd Year', email: 'pedro@school.edu.ph' },
  'Ana Gomez': { course: 'CBA', year: '2nd Year', email: 'ana@school.edu.ph' },
  'Luis Santos': { course: 'Hospital Management', year: '3rd Year', email: 'luis@school.edu.ph' },
  'Carla Bautista': { course: 'Tourism Management', year: '2nd Year', email: 'carla@school.edu.ph' },
  'Ramon Dela Vega': { course: 'Electrical Engineering', year: '4th Year', email: 'ramon@school.edu.ph' },
};

// Navigation menu structure per role
const NAVS = {
  student: [
    { id: 's-dash', label: 'Dashboard', icon: 'grid' },
    { id: 's-submit', label: 'Submit Concern', icon: 'plus' },
    { id: 's-tickets', label: 'My Tickets', icon: 'list' },
    { id: 's-notifs', label: 'Notifications', icon: 'bell' },
    { id: 's-profile', label: 'My Profile', icon: 'user' }
  ],
  accounting: [
    { id: 'a-dash', label: 'Dashboard', icon: 'grid' },
    { id: 'a-concerns', label: 'Financial Concerns', icon: 'dollar' },
    { id: 'a-reports', label: 'Reports', icon: 'chart' },
    { id: 'a-notifs', label: 'Notifications', icon: 'bell' },
    { id: 'a-profile', label: 'My Profile', icon: 'user' }
  ],
  registrar: [
    { id: 'r-dash', label: 'Dashboard', icon: 'grid' },
    { id: 'r-concerns', label: 'Academic Concerns', icon: 'file' },
    { id: 'r-reports', label: 'Reports', icon: 'chart' },
    { id: 'r-notifs', label: 'Notifications', icon: 'bell' },
    { id: 'r-profile', label: 'My Profile', icon: 'user' }
  ],
  admin: [
    { id: 'ad-dash', label: 'Dashboard', icon: 'grid' },
    { id: 'ad-users', label: 'User Management', icon: 'users' },
    { id: 'ad-tickets', label: 'All Tickets', icon: 'list' },
    { id: 'ad-announce', label: 'Announcements', icon: 'bell' },
    { id: 'ad-reports', label: 'Analytics', icon: 'chart' },
    { id: 'ad-profile', label: 'My Profile', icon: 'user' }
  ],
};

let TICKETS = [];
let CHAT_THREADS = {};
let ANNOUNCEMENTS = [];

let USERS = [];

// Load all data from localStorage on startup
loadUsers();
loadTickets();
loadChatThreads();
loadAnnouncements();

// Session state
let currentRole = 'student';
let currentUser = null;
let currentPageId = 's-dash';
let activeFilter = 'All';
let searchQuery = '';
let profilePhotos = {};

// Migrate profile photos if user ID changes
function migrateProfilePhoto(oldId, newId) {
  if (!oldId || !newId || oldId === newId) {
    return; // No migration needed
  }
  
  // CRITICAL: Verify auth data is intact before migration
  if (!localStorage.getItem('currentUser') || !localStorage.getItem('authToken')) {
    console.warn('⚠ Skipping photo migration - no active user session');
    return;
  }
  
  if (profilePhotos[oldId]) {
    console.log('Migrating photo from', oldId, 'to', newId);
    try {
      profilePhotos[newId] = profilePhotos[oldId];
      delete profilePhotos[oldId];
      saveProfilePhotos();
    } catch (e) {
      console.error('Failed to migrate photo:', e);
      // Don't throw - just log and continue login
    }
  }
}

// NUCLEAR CLEANUP: Delete massive data stores on startup
function nukeStorageOnStartup() {
  try {
    console.log('Running startup storage cleanup...');
    
    // Calculate before
    let beforeSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        beforeSize += localStorage[key].length;
      }
    }
    console.log('Before:', Math.round(beforeSize / 1024), 'KB');
    
    // Keep all persisted app data so registrations survive refresh/sign-out.
    const keepKeys = [
      'currentUser',
      'authToken',
      'deletedUsers',
      'deletedConcernIds',
      'registeredStudents',
      'registeredStudentsBackup',
      'usersList',
      'usersListBackup',
      'ticketsList',
      'chatThreads',
      'announcementsList',
      'announcementsListBackup',
      'profilePhotos'
    ];
    const keysToDelete = [];
    
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key) && !keepKeys.includes(key) && !key.startsWith('notifRead_')) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      const size = localStorage[key].length;
      localStorage.removeItem(key);
      console.log('Deleted', key, '(' + Math.round(size / 1024) + 'KB)');
    }
    
    // Calculate after
    let afterSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        afterSize += localStorage[key].length;
      }
    }
    
    const freedSpace = beforeSize - afterSize;
    console.log('After cleanup: Freed', Math.round(freedSpace / 1024), 'KB, remaining', Math.round(afterSize / 1024), 'KB');
    
    // Do not reset in-memory data here; startup loaders handle sync safely.
    console.log('Startup cleanup complete');
    
  } catch (e) {
    console.error('Error during nuclear cleanup:', e);
  }
}

// Save profile photos to localStorage
function saveProfilePhotos() {
  try {
    // CRITICAL: Check if any auth data exists before saving photos
    if (!localStorage.getItem('currentUser') || !localStorage.getItem('authToken')) {
      console.warn('⚠ Skipping photo save - no active user session');
      return false;
    }
    
    // Validate all photos before saving (remove oversized)
    const maxPhotoSize = 180 * 1024;  // 180KB hard limit
    for (const [id, photoData] of Object.entries(profilePhotos)) {
      if (photoData && photoData.length > maxPhotoSize) {
        console.warn('Removing oversized photo:', id, '(' + Math.round(photoData.length / 1024) + 'KB)');
        delete profilePhotos[id];
      }
    }
    
    const photoDataToSave = JSON.stringify(profilePhotos);
    localStorage.setItem('profilePhotos', photoDataToSave);
    console.log('✓ Photos saved to localStorage:', Object.keys(profilePhotos).length, 'photos');
    return true;
  } catch (e) {
    // localStorage is full - just skip photo persistence for now
    // Photos will stay in memory for this session but won't be saved
    console.warn('⚠ localStorage quota exceeded - photos stored in memory only (will not persist on page refresh)');
    console.log('Current profilePhotos in memory:', Object.keys(profilePhotos).length, 'photos');
    return false; // Return false but don't cause errors
  }
}

// Load profile photos from localStorage
function loadProfilePhotos() {
  try {
    const stored = localStorage.getItem('profilePhotos');
    if (stored) {
      profilePhotos = JSON.parse(stored);
      console.log('✓ Loaded', Object.keys(profilePhotos).length, 'photos from localStorage');
      
      // Verify photos are valid and not too large
      const maxPhotoSize = 180 * 1024;  // 180KB hard limit per photo
      let hasInvalid = false;
      
      for (const [id, photoData] of Object.entries(profilePhotos)) {
        // Check if photo is valid base64 string
        if (!photoData || typeof photoData !== 'string' || !photoData.startsWith('data:image')) {
          console.warn('Removing invalid photo for', id);
          delete profilePhotos[id];
          hasInvalid = true;
        }
        // Check if photo is too large
        else if (photoData.length > maxPhotoSize) {
          console.warn('Removing too-large photo for', id, '(' + Math.round(photoData.length / 1024) + 'KB)');
          delete profilePhotos[id];
          hasInvalid = true;
        }
      }
      
      // If we removed invalid photos, save the cleaned up list
      if (hasInvalid) {
        try {
          localStorage.setItem('profilePhotos', JSON.stringify(profilePhotos));
          console.log('✓ Removed invalid photos, saved cleanup');
        } catch (e) {
          console.error('Could not save photo cleanup:', e);
        }
      }
    } else {
      console.log('No photos found in localStorage');
    }
  } catch (e) {
    console.error('Failed to load profile photos:', e);
    profilePhotos = {};
    // Try to clear corrupted photo data
    try {
      localStorage.removeItem('profilePhotos');
    } catch (e2) {
      console.error('Could not remove corrupted photo data:', e2);
    }
  }
}

// Cleanup is now done in app.js via nukeStorageOnStartup()
// Load photos on startup
loadProfilePhotos();

function getStudentInfo(name) {
  return STUDENT_INFO[name] || {};
}

function getNotificationReadKey(userId) {
  return 'notifRead_' + String(userId || '');
}

function getReadStudentNotificationIds(userId) {
  try {
    const raw = localStorage.getItem(getNotificationReadKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveReadStudentNotificationIds(userId, ids) {
  try {
    localStorage.setItem(getNotificationReadKey(userId), JSON.stringify(Array.isArray(ids) ? ids : []));
  } catch (e) {}
}

function getNotificationTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const dt = new Date(raw);
  const ms = dt.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function getStudentNotifications(user) {
  const targetUser = user || currentUser;
  if (!targetUser || !targetUser.name) {
    return [];
  }

  const items = [];
  const readIds = new Set(getReadStudentNotificationIds(targetUser.id));

  (Array.isArray(ANNOUNCEMENTS) ? ANNOUNCEMENTS : [])
    .filter((a) => a && !a.draft && (!a.audience || a.audience === 'All Users' || a.audience === 'Students Only'))
    .forEach((a) => {
      const timeValue = a.createdAt || a.date || '';
      items.push({
        id: `ann:${a.id}`,
        title: a.title || 'Announcement',
        body: a.body || '',
        time: timeValue,
        sortTime: getNotificationTimestamp(timeValue),
        read: readIds.has(`ann:${a.id}`)
      });
    });

  (Array.isArray(TICKETS) ? TICKETS : [])
    .filter((t) => t && t.student === targetUser.name && (t.status === 'In Progress' || t.status === 'Resolved'))
    .forEach((t) => {
      const statusKey = `ticket:${t.id}:${t.status}`;
      const statusText = t.status === 'Resolved' ? 'has been resolved.' : 'is now being reviewed.';
      const bodyPrefix = t.category || t.subject || 'Your concern';
      const timeValue = t.statusUpdatedAt || t.updatedAt || t.date || '';
      items.push({
        id: statusKey,
        title: `${t.id} updated to ${t.status}`,
        body: `${bodyPrefix} ${statusText}`,
        time: timeValue,
        sortTime: getNotificationTimestamp(timeValue),
        read: readIds.has(statusKey)
      });
    });

  return items.sort((a, b) => b.sortTime - a.sortTime);
}

function countUnreadStudentNotifications(user) {
  return getStudentNotifications(user).filter((item) => !item.read).length;
}

function markAllStudentNotificationsRead(user) {
  const targetUser = user || currentUser;
  if (!targetUser || !targetUser.id) {
    return;
  }
  const ids = getStudentNotifications(targetUser).map((item) => item.id);
  saveReadStudentNotificationIds(targetUser.id, ids);
}

function getVisibleAnnouncementsForRole(role) {
  const normalizedRole = String(role || '').toLowerCase();
  return (Array.isArray(ANNOUNCEMENTS) ? ANNOUNCEMENTS : []).filter((a) => {
    if (!a || a.draft) return false;
    const audience = String(a.audience || 'All Users');
    if (normalizedRole === 'student') {
      return audience === 'All Users' || audience === 'Students Only';
    }
    return audience === 'All Users' || audience === 'Staff Only';
  });
}

function getStaffAnnouncementNotifications(user) {
  const targetUser = user || currentUser;
  if (!targetUser || !targetUser.id) {
    return [];
  }
  const readIds = new Set(getReadStudentNotificationIds(targetUser.id));
  return getVisibleAnnouncementsForRole(targetUser.role)
    .map((a) => {
      const id = `ann:${a.id}`;
      const timeValue = a.createdAt || a.date || '';
      return {
        id,
        title: a.title || 'Announcement',
        body: a.body || '',
        time: timeValue,
        sortTime: getNotificationTimestamp(timeValue),
        read: readIds.has(id)
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);
}

function countUnreadStaffNotifications(user) {
  return getStaffAnnouncementNotifications(user).filter((item) => !item.read).length;
}

function markAllStaffNotificationsRead(user) {
  const targetUser = user || currentUser;
  if (!targetUser || !targetUser.id) {
    return;
  }
  const currentRead = getReadStudentNotificationIds(targetUser.id);
  const staffIds = getStaffAnnouncementNotifications(targetUser).map((item) => item.id);
  const merged = Array.from(new Set([...currentRead, ...staffIds]));
  saveReadStudentNotificationIds(targetUser.id, merged);
}
