// Authentication module

function goRegister() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('register-screen').style.display = 'flex';
  document.getElementById('reg-err').style.display = 'none';
  document.getElementById('reg-ok').style.display = 'none';
}

function goLogin() {
  document.getElementById('register-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-error').style.display = 'none';
}

let presenceHeartbeatInterval = null;

function stopPresenceHeartbeat() {
  if (presenceHeartbeatInterval) {
    clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = null;
  }
}

function startPresenceHeartbeat() {
  stopPresenceHeartbeat();

  if (typeof apiSetPresence !== 'function') {
    return;
  }

  presenceHeartbeatInterval = setInterval(() => {
    apiSetPresence(true).catch(() => {
      // Keep UI working even if backend presence sync is unavailable.
    });
  }, 15000);
}

function roleLabelFromRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'student') return 'Student';
  if (r === 'accounting') return 'Accounting';
  if (r === 'registrar') return 'Registrar';
  if (r === 'faculty') return 'Registrar';
  if (r === 'admin') return 'Admin';
  return 'Student';
}

function setUserActiveSession(loginUsername, userData) {
  if (typeof loadUsers === 'function') {
    loadUsers();
  }

  const uname = String(loginUsername || userData?.username || '').toLowerCase();
  const candidateIds = [userData?.student_id, userData?.id].filter(Boolean).map((v) => String(v));

  let idx = USERS.findIndex((u) => {
    const byUname = uname && String(u.uname || '').toLowerCase() === uname;
    const byId = candidateIds.includes(String(u.id || ''));
    return byUname || byId;
  });

  if (idx < 0 && userData) {
    const fullName = userData.full_name || userData.name || uname || 'User';
    const names = fullName.trim().split(/\s+/);
    const ini = ((names[0]?.[0] || 'U') + (names[1]?.[0] || '')).toUpperCase();
    const roleLabel = roleLabelFromRole(userData.role);
    const isStudent = roleLabel === 'Student';
    USERS.unshift({
      name: fullName,
      id: userData.student_id || userData.id || uname,
      role: roleLabel,
      ini,
      bg: isStudent ? 'rgba(26,162,96,0.15)' : 'rgba(37,99,235,0.15)',
      col: isStudent ? '#15803d' : '#1d4ed8',
      status: 'Inactive',
      activeSince: '',
      lastSeenAt: '',
      isNew: false,
      email: userData.email || '',
      course: userData.course || '',
      year: userData.year_level || userData.year || '',
      uname: uname || String(userData.student_id || userData.id || '').toLowerCase(),
      joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    });
    idx = 0;
  }

  if (idx >= 0) {
    USERS[idx].status = 'Active';
    USERS[idx].activeSince = new Date().toISOString();
    USERS[idx].lastSeenAt = '';
    if (typeof saveUsers === 'function') {
      saveUsers();
    }
  }
}

function setCurrentUserInactiveSession() {
  if (!currentUser) {
    return;
  }

  if (typeof loadUsers === 'function') {
    loadUsers();
  }

  const uname = String(currentUser.username || currentUser.id || '').toLowerCase();
  const candidateIds = [currentUser.student_id, currentUser.id].filter(Boolean).map((v) => String(v));

  const idx = USERS.findIndex((u) => {
    const byUname = uname && String(u.uname || '').toLowerCase() === uname;
    const byId = candidateIds.includes(String(u.id || ''));
    return byUname || byId;
  });

  if (idx >= 0) {
    USERS[idx].status = 'Inactive';
    USERS[idx].activeSince = '';
    USERS[idx].lastSeenAt = new Date().toISOString();
    if (typeof saveUsers === 'function') {
      saveUsers();
    }
  }
}

function doRegister() {
  const fn = document.getElementById('r-fn').value.trim();
  const ln = document.getElementById('r-ln').value.trim();
  const sid = document.getElementById('r-sid').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const course = document.getElementById('r-course').value;
  const year = document.getElementById('r-year').value;
  const pw = document.getElementById('r-pw').value;
  const pw2 = document.getElementById('r-pw2').value;
  const errEl = document.getElementById('reg-err');
  const okEl = document.getElementById('reg-ok');
  errEl.style.display = 'none';
  okEl.style.display = 'none';
  if (!fn || !ln || !sid || !email || !course || !year || !pw || !pw2) {
    errEl.textContent = '✕ Please fill in all required fields.';
    errEl.style.display = 'block';
    return;
  }
  if (pw.length < 6) {
    errEl.textContent = '✕ Password must be at least 6 characters.';
    errEl.style.display = 'block';
    return;
  }
  if (pw !== pw2) {
    errEl.textContent = '✕ Passwords do not match. Please try again.';
    errEl.style.display = 'block';
    return;
  }

  const loginKey = sid.toLowerCase();
  const fullName = fn + ' ' + ln;
  const ini = (fn[0] + (ln[0] || '')).toUpperCase();

  // Check if already exists
  if (ACCOUNTS[loginKey]) {
    errEl.textContent = '✕ Student ID "' + sid + '" is already registered.';
    errEl.style.display = 'block';
    return;
  }

  // Create account object
  const newAccount = {
    password: pw,
    role: 'student',
    name: fullName,
    id: sid,
    ini,
    bg: 'rgba(26,162,96,0.2)',
    col: '#1AA260',
    isNew: true,
    course,
    year,
    email
  };

  // Cross-browser persistence requires backend save (Supabase).
  if (typeof apiRegister === 'undefined') {
    errEl.textContent = '✕ Server API not available. Please run the backend first.';
    errEl.style.display = 'block';
    return;
  }

  apiRegister(fullName, fn, ln, sid, email, course, year, pw)
    .then(() => {
      // Save local mirrors after successful server write.
      saveStudentRegistration(loginKey, newAccount);

      USERS.unshift({
        name: fullName,
        id: sid,
        role: 'Student',
        ini,
        bg: 'rgba(26,162,96,0.15)',
        col: '#15803d',
        status: 'Inactive',
        isNew: true,
        email: email || '',
        course: course || '',
        year: year || '',
        uname: loginKey,
        joinDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      });
      saveUsers();

      // Clear form
      ['r-fn', 'r-ln', 'r-sid', 'r-email', 'r-pw', 'r-pw2'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const courseEl = document.getElementById('r-course');
      if (courseEl) courseEl.value = '';
      const yearEl = document.getElementById('r-year');
      if (yearEl) yearEl.value = '';

      okEl.textContent = '✓ Account created and saved to server. Redirecting…';
      okEl.style.display = 'block';

      setTimeout(() => {
        goLogin();
        document.getElementById('login-id').value = loginKey;
      }, 2200);
    })
    .catch((error) => {
      errEl.textContent = '✕ Could not save registration to server. Please start backend and try again.';
      errEl.style.display = 'block';
      console.error('Registration failed:', error);
    });
}

function doLogin() {
  const uname = document.getElementById('login-id').value.trim().toLowerCase();
  const pw = document.getElementById('login-pw').value;
  const errEl = document.getElementById('login-error');

  const resolveAccountKey = (loginValue) => {
    const raw = String(loginValue || '').trim().toLowerCase();
    if (!raw) {
      return '';
    }
    const canonicalByRole = {
      accounting: 'maria.santos',
      registrar: 'jose.reyes',
      admin: 'admin'
    };
    if (ACCOUNTS[raw]) {
      const ownRole = String(ACCOUNTS[raw]?.role || '').toLowerCase();
      return canonicalByRole[ownRole] || raw;
    }
    const found = Object.keys(ACCOUNTS).find((key) => {
      const acc = ACCOUNTS[key];
      return String(acc?.id || '').toLowerCase() === raw;
    });
    if (!found) {
      return raw;
    }
    const foundRole = String(ACCOUNTS[found]?.role || '').toLowerCase();
    return canonicalByRole[foundRole] || found;
  };

  const accountKey = resolveAccountKey(uname);

  // Staff credentials are managed locally so password changes persist immediately.
  const localAcc = ACCOUNTS[accountKey];
  const localRole = String(localAcc?.role || '').toLowerCase();
  if (localAcc && ['accounting', 'registrar', 'admin'].includes(localRole)) {
    doLoginLocal(accountKey, pw, errEl);
    return;
  }

  if (typeof isDeletedUserRecord === 'function' && isDeletedUserRecord(null, uname)) {
    errEl.style.display = 'block';
    errEl.textContent = '✕ This account has been permanently deleted.';
    document.getElementById('login-pw').value = '';
    return;
  }

  // Try backend API first
  if (typeof apiLogin !== 'undefined') {
    apiLogin(accountKey, pw)
      .then((response) => {
        if (typeof isDeletedUserRecord === 'function' && isDeletedUserRecord(response.user, uname)) {
          errEl.style.display = 'block';
          errEl.textContent = '✕ This account has been permanently deleted.';
          document.getElementById('login-pw').value = '';
          if (typeof apiLogout !== 'undefined') {
            apiLogout();
          }
          return;
        }

        errEl.style.display = 'none';
        currentRole = response.user.role;
        if (currentRole === 'faculty') {
          currentRole = 'registrar';
          response.user.role = 'registrar';
        }
        if (currentRole === 'student') {
          try {
            if (typeof loadUsers === 'function') {
              loadUsers();
            }

            const loginKey = String(uname || '').toLowerCase();
            const backendId = String(response.user.student_id || response.user.id || '');
            const userInList = USERS.find((u) => {
              const byId = backendId && String(u.id || '') === backendId;
              const byUname = loginKey && String(u.uname || '').toLowerCase() === loginKey;
              return byId || byUname;
            });

            if (userInList) {
              response.user.full_name = userInList.name || response.user.full_name;
              response.user.name = userInList.name || response.user.name;
              response.user.email = userInList.email || response.user.email || '';
              response.user.course = userInList.course || response.user.course || '';
              response.user.year_level = userInList.year || response.user.year_level || response.user.year || '';
              response.user.year = response.user.year_level;
              response.user.id = userInList.id || response.user.id;
              response.user.student_id = userInList.id || response.user.student_id || response.user.id;
            }

            if (loginKey) {
              const existing = ACCOUNTS[loginKey] || {};
              ACCOUNTS[loginKey] = {
                ...existing,
                password: existing.password || pw,
                role: 'student',
                name: response.user.full_name || response.user.name || existing.name || 'Student',
                id: response.user.student_id || response.user.id || existing.id || loginKey,
                ini: existing.ini || ((response.user.full_name || response.user.name || 'S').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ST'),
                bg: existing.bg || 'rgba(26,162,96,0.2)',
                col: existing.col || '#1AA260',
                isNew: !!existing.isNew,
                course: response.user.course || existing.course || '',
                year: response.user.year_level || response.user.year || existing.year || '',
                email: response.user.email || existing.email || ''
              };

              if (typeof saveStudentRegistration === 'function') {
                saveStudentRegistration(loginKey, ACCOUNTS[loginKey]);
              }
            }
          } catch (e) {
            console.error('Student profile sync failed during backend login:', e);
          }
        }

        currentUser = { ...response.user, username: accountKey, uname: accountKey };
        setUserActiveSession(accountKey, response.user);
        
        // Save session to localStorage
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        localStorage.setItem('authToken', response.token || 'backend-token');

        // Update shared presence so admin can see active state across browsers.
        if (typeof apiSetPresence === 'function') {
          apiSetPresence(true).catch((e) => console.log('Presence update skipped:', e.message));
        }
        startPresenceHeartbeat();
        
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        document.getElementById('tb-username').textContent = currentUser.full_name || currentUser.name;
        updateTopbarAvatar();
        document.getElementById('role-pill').textContent = {
          student: 'Student',
          accounting: 'Accounting',
          registrar: 'Registrar',
          admin: 'Admin'
        }[response.user.role];
        buildSidebar();
        activeFilter = 'All';
        searchQuery = '';
        showPage(NAVS[currentRole][0].id);

        // For admin, sync Users page from backend (Supabase) when available.
        if (response.user.role === 'admin' && typeof syncUsersFromBackend === 'function') {
          syncUsersFromBackend().then((changed) => {
            if (changed && currentPageId === 'ad-users') {
              showPage('ad-users');
            }
          });
        }
      })
      .catch((error) => {
        // Fallback to local authentication
        doLoginLocal(accountKey, pw, errEl);
      });
  } else {
    // Use local authentication
    doLoginLocal(accountKey, pw, errEl);
  }
}

function doLoginLocal(uname, pw, errEl) {
  // CRITICAL: Reload all student data from localStorage before login
  try {
    if (typeof loadStaffAccounts === 'function') {
      loadStaffAccounts();
    }
    if (typeof loadRegisteredStudents === 'function') {
      loadRegisteredStudents();
    }
    if (typeof loadUsers === 'function') {
      loadUsers();
    }
  } catch (e) {
    console.error('Error loading data before login:', e);
  }

  if (typeof isDeletedUserRecord === 'function' && isDeletedUserRecord(null, uname)) {
    errEl.style.display = 'block';
    errEl.textContent = '✕ This account has been permanently deleted.';
    document.getElementById('login-pw').value = '';
    return;
  }
  
  const acc = ACCOUNTS[uname];
  const role = String(acc?.role || '').toLowerCase();
  const overridePw = (['accounting', 'registrar', 'admin'].includes(role) && typeof getStaffPasswordOverride === 'function')
    ? getStaffPasswordOverride(uname)
    : '';
  const expectedPw = overridePw || String(acc?.password || '');
  if (!acc || expectedPw !== pw) {
    errEl.style.display = 'block';
    errEl.textContent = '✕ Invalid Student ID or password.';
    document.getElementById('login-pw').value = '';
    console.error('Login failed for:', uname);
    return;
  }
  errEl.style.display = 'none';
  currentRole = acc.role;
  if (currentRole === 'faculty') {
    currentRole = 'registrar';
  }
  currentUser = { ...acc, username: uname }; // Use a copy to avoid mutations
  currentUser.role = currentRole;
  setUserActiveSession(uname, currentUser);
  startPresenceHeartbeat();
  
  // Mark user as Active in USERS list when they successfully log in
  const userInUsersList = USERS.find(u => u.id === currentUser.id);
  if (userInUsersList && userInUsersList.status !== 'Active') {
    userInUsersList.status = 'Active';
    if (typeof saveUsers === 'function') {
      saveUsers();
    }
  }
  
  // Sync with USERS list to get latest profile data
  if (currentRole === 'student') {
    const userInList = USERS.find(u => u.id === currentUser.id);
    if (userInList) {
      currentUser.name = userInList.name;
      currentUser.email = userInList.email;
      currentUser.course = userInList.course;
      currentUser.year = userInList.year;
    }
    
    // Check if user has a photo under a different ID (UUID vs numeric)
    // Look for any photo and migrate it to the current ID
    try {
      const allPhotoIds = Object.keys(profilePhotos);
      if (allPhotoIds.length > 0 && !profilePhotos[currentUser.id]) {
        // Student has never uploaded a photo with this ID, check if they have one with an old ID
        for (const photoId of allPhotoIds) {
          if (photoId !== currentUser.id) {
            console.log('Found photo with old ID, migrating:', photoId, '→', currentUser.id);
            if (typeof migrateProfilePhoto === 'function') {
              migrateProfilePhoto(photoId, currentUser.id);
            }
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error during photo migration:', e);
      // Continue login even if photo migration fails
    }
  }
  
  // Save session to localStorage
  try {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('authToken', 'local-' + uname);
  } catch (e) {
    console.error('Error saving auth session:', e);
    errEl.style.display = 'block';
    errEl.textContent = '✕ Error saving session. Please try again.';
    return;
  }
  
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('tb-username').textContent = currentUser.name;
  updateTopbarAvatar();
  document.getElementById('role-pill').textContent = {
    student: 'Student',
    accounting: 'Accounting',
    registrar: 'Registrar',
    admin: 'Admin'
  }[currentRole];
  buildSidebar();
  activeFilter = 'All';
  searchQuery = '';
  showPage(NAVS[currentRole][0].id);
}

async function doLogout() {
  setCurrentUserInactiveSession();
  stopPresenceHeartbeat();

  if (typeof apiSetPresence === 'function') {
    try {
      await apiSetPresence(false);
    } catch (e) {
      console.log('Presence update skipped:', e.message);
    }
  }

  if (typeof saveUsers === 'function') {
    saveUsers();
  }
  if (typeof apiLogout !== 'undefined') {
    apiLogout();
  }
  // CRITICAL: Always clear auth data first before anything else
  try {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
  } catch (e) {
    console.error('Error clearing auth data:', e);
  }
  
  // Clear UI
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('register-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-id').value = '';
  document.getElementById('login-pw').value = '';
  document.getElementById('login-error').style.display = 'none';
  
  // Clear session state
  currentUser = null;
  currentRole = 'student';
  currentPageId = 's-dash';
}
