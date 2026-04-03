// UI module - sidebar and navigation

function syncCurrentUserWithSaved() {
  // For students, ensure currentUser matches the latest saved data
  if (currentRole === 'student') {
    const oldId = currentUser.id;
    const loginKey = String(currentUser.username || currentUser.uname || currentUser.student_id || '').toLowerCase();
    const idCandidates = [currentUser.id, currentUser.student_id]
      .filter(Boolean)
      .map((v) => String(v));
    
    // First check USERS list
    const userInList = USERS.find((u) => {
      const byId = idCandidates.includes(String(u.id || ''));
      const byUname = loginKey && String(u.uname || '').toLowerCase() === loginKey;
      const byName = u.name === currentUser.name;
      return byId || byUname || byName;
    });
    if (userInList) {
      currentUser.id = userInList.id;
      currentUser.student_id = userInList.id;
      currentUser.name = userInList.name;
      currentUser.email = userInList.email;
      currentUser.course = userInList.course;
      currentUser.year = userInList.year;
      if (!currentUser.username && userInList.uname) {
        currentUser.username = userInList.uname;
      }
    }
    
    // Then check ACCOUNTS for missing account fields
    const accountData =
      (loginKey && ACCOUNTS[loginKey]) ||
      idCandidates.map((id) => ACCOUNTS[String(id).toLowerCase()]).find(Boolean);
    if (accountData) {
      currentUser = {
        ...accountData,
        ...currentUser,
        name: currentUser.name || accountData.name,
        email: currentUser.email || accountData.email || '',
        course: currentUser.course || accountData.course || '',
        year: currentUser.year || accountData.year || ''
      };
    }
    
    // Migrate photo if ID changed
    if (oldId !== currentUser.id && typeof migrateProfilePhoto === 'function') {
      migrateProfilePhoto(oldId, currentUser.id);
    }
  }
}

function getProfilePhotoByIdentity(u) {
  if (!u) return null;
  const directId = String(u.id || '');
  if (directId && profilePhotos[directId]) return profilePhotos[directId];

  const sid = String(u.student_id || '');
  if (sid && profilePhotos[sid]) return profilePhotos[sid];

  const loginKey = String(u.username || u.uname || sid || directId).toLowerCase();
  const accountData = loginKey ? ACCOUNTS[loginKey] : null;
  const accountId = accountData ? String(accountData.id || '') : '';
  if (accountId && profilePhotos[accountId]) return profilePhotos[accountId];

  return null;
}

function buildSidebar() {
  // Ensure currentUser is synced with latest saved data
  syncCurrentUserWithSaved();
  
  const u = currentUser;
  const sbPhoto = getProfilePhotoByIdentity(u);
  const sbAv = sbPhoto
    ? `<div style="width:38px;height:38px;border-radius:50%;background-image:url(${sbPhoto});background-size:cover;background-position:center;flex-shrink:0;border:2px solid rgba(26,162,96,0.4);"></div>`
    : `<div style="width:38px;height:38px;border-radius:50%;background:${u.bg};color:${u.col};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;">${u.ini}</div>`;
  let h = `<div class="sb-user"><div style="display:flex;align-items:center;gap:10px;">${sbAv}<div><div class="sb-user-name">${u.name}</div><div class="sb-user-id">${u.id}</div></div></div></div><div class="nav-sec">Navigation</div>`;
  NAVS[currentRole].forEach((n) => {
    const unreadBadge = (
      (currentRole === 'student' && n.id === 's-notifs') ||
      (currentRole === 'accounting' && n.id === 'a-notifs') ||
      (currentRole === 'registrar' && n.id === 'r-notifs')
    )
      ? (() => {
        const count = currentRole === 'student'
          ? (typeof countUnreadStudentNotifications === 'function' ? countUnreadStudentNotifications(currentUser) : 0)
          : (typeof countUnreadStaffNotifications === 'function' ? countUnreadStaffNotifications(currentUser) : 0);
        return count > 0 ? `<span style="margin-left:auto;min-width:18px;padding:1px 7px;border-radius:999px;background:var(--cg);color:#fff;font-size:10px;font-weight:700;text-align:center;">${count}</span>` : '';
      })()
      : '';
    h += `<div class="nav-item" id="nav-${n.id}" onclick="showPage('${n.id}')" style="display:flex;align-items:center;gap:8px;">${IC[n.icon] || ''}<span>${n.label}</span>${unreadBadge}</div>`;
  });
  document.getElementById('sidebar').innerHTML = h;
}

function updateTopbarAvatar() {
  const av = document.getElementById('tb-avatar');
  const photo = getProfilePhotoByIdentity(currentUser);
  if (photo) {
    av.innerHTML = '';
    av.style.background = 'none';
    av.style.backgroundImage = 'url(' + photo + ')';
    av.style.backgroundSize = 'cover';
    av.style.backgroundPosition = 'center';
    av.textContent = '';
  } else {
    av.style.backgroundImage = 'none';
    av.style.background = currentUser.bg;
    av.style.color = currentUser.col;
    av.textContent = currentUser.ini;
  }
}
