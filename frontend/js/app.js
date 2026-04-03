// Main app initialization
document.addEventListener('DOMContentLoaded', function () {
  // CRITICAL: Run nuclear cleanup FIRST to free up massive space for everything
  try {
    if (typeof nukeStorageOnStartup === 'function') {
      nukeStorageOnStartup();
    }
  } catch (e) {
    console.error('Error during startup nuclear cleanup:', e);
  }
  
  // Reload all data from localStorage to ensure latest updates
  // CRITICAL: Load auth data first before loading photos
  try {
    if (typeof loadRegisteredStudents === 'function') {
      loadRegisteredStudents();
    }
    if (typeof loadUsers === 'function') {
      loadUsers();
    }

    // Restore user list from Supabase on every startup when backend is available.
    if (typeof restoreUsersFromSupabaseOnStartup === 'function') {
      restoreUsersFromSupabaseOnStartup().then((changed) => {
        let ticketsChanged = false;
        if (typeof backfillTicketStudentMetadata === 'function') {
          ticketsChanged = backfillTicketStudentMetadata(true);
        }

        if (!changed) {
          if (ticketsChanged && document.getElementById('app-screen').style.display === 'block') {
            showPage(currentPageId);
          }
          return;
        }

        // Refresh currently visible admin pages after async restore.
        if (document.getElementById('app-screen').style.display === 'block' && currentRole === 'admin') {
          if (currentPageId === 'ad-users' || currentPageId === 'ad-dash') {
            showPage(currentPageId);
          }
        } else if (ticketsChanged && document.getElementById('app-screen').style.display === 'block') {
          showPage(currentPageId);
        }
      });
    }
    
    if (typeof loadTickets === 'function') {
      loadTickets();
    }
    if (typeof loadAnnouncements === 'function') {
      loadAnnouncements();
    }
  } catch (e) {
    console.error('Error loading data:', e);
  }
  
  // Load photos AFTER other data, but BEFORE checking session
  try {
    if (typeof loadProfilePhotos === 'function') {
      loadProfilePhotos();
    }
  } catch (e) {
    console.error('Error loading photos:', e);
    // If photo loading fails, continue anyway
  }
  
  // Check if user is already logged in (from localStorage)
  const storedUser = localStorage.getItem('currentUser');
  const token = localStorage.getItem('authToken');
  
  if (storedUser && token) {
    // Restore user session
    try {
      currentUser = JSON.parse(storedUser);

      if (typeof isDeletedUserRecord === 'function' && isDeletedUserRecord(currentUser, currentUser.username || currentUser.uname || currentUser.student_id || currentUser.id)) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        currentUser = null;
        currentRole = 'student';
        return;
      }

      currentRole = currentUser.role;
      if (currentRole === 'faculty') {
        currentRole = 'registrar';
        currentUser.role = 'registrar';
      }
      
      // For students, verify and sync data from USERS list and ACCOUNTS
      if (currentRole === 'student') {
        const oldId = currentUser.id;
        const loginKey = String(currentUser.username || currentUser.uname || currentUser.student_id || '').toLowerCase();
        const idCandidates = [currentUser.id, currentUser.student_id]
          .filter(Boolean)
          .map((v) => String(v));

        const accountData =
          (loginKey && ACCOUNTS[loginKey]) ||
          idCandidates.map((id) => ACCOUNTS[String(id).toLowerCase()]).find(Boolean);

        if (accountData) {
          // storedUser wins — it was written by saveProfile() with the latest edits
          currentUser = { ...accountData, ...currentUser };
        }

        const userInList = USERS.find((u) => {
          const byId = idCandidates.includes(String(u.id || ''));
          const byUname = loginKey && String(u.uname || '').toLowerCase() === loginKey;
          return byId || byUname;
        });

        if (userInList) {
          currentUser.id = userInList.id;
          currentUser.student_id = userInList.id;
          // Prefer storedUser values for editable fields; only fill in if missing
          currentUser.name = currentUser.name || userInList.name;
          currentUser.full_name = currentUser.name;
          currentUser.email = currentUser.email || userInList.email || '';
          currentUser.course = currentUser.course || userInList.course || '';
          currentUser.year = currentUser.year || userInList.year || '';
          currentUser.year_level = currentUser.year;
          if (!currentUser.username && userInList.uname) {
            currentUser.username = userInList.uname;
          }
        }

        if (oldId && currentUser.id && oldId !== currentUser.id && typeof migrateProfilePhoto === 'function') {
          migrateProfilePhoto(oldId, currentUser.id);
        }

        // Update in localStorage to keep in sync
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      
      // Show app screen
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('register-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = 'block';
      
      // Update UI
      document.getElementById('tb-username').textContent = currentUser.full_name || currentUser.name;
      updateTopbarAvatar();
      document.getElementById('role-pill').textContent = {
        student: 'Student',
        accounting: 'Accounting',
        registrar: 'Registrar',
        admin: 'Admin'
      }[currentRole];
      buildSidebar();
      
      // Show first page
      showPage(NAVS[currentRole][0].id);
    } catch (e) {
      console.error('Failed to restore session:', e);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
    }
  }
  console.log('ConcernTrack app initialized');
});
