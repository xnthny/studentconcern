// Admin pages and profile page

let adminActiveTimerInterval = null;
let adminPresenceSyncInterval = null;

function formatDurationHMS(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function getActiveDurationText(user) {
  if (!user || user.status !== 'Active' || !user.activeSince) {
    return '00:00:00';
  }

  const startedAt = Date.parse(user.activeSince);
  if (Number.isNaN(startedAt)) {
    return '00:00:00';
  }

  return formatDurationHMS(Date.now() - startedAt);
}

function formatPresenceTimestamp(isoString) {
  if (!isoString) {
    return '—';
  }

  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) {
    return '—';
  }

  return dt.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function getPresenceTimestampLabel(user) {
  if (!user) {
    return '—';
  }

  if (user.status === 'Active' && user.activeSince) {
    return 'Active since ' + formatPresenceTimestamp(user.activeSince);
  }

  if (user.lastSeenAt) {
    return 'Last seen ' + formatPresenceTimestamp(user.lastSeenAt);
  }

  return '—';
}

function stopAdminActiveTimers() {
  if (adminActiveTimerInterval) {
    clearInterval(adminActiveTimerInterval);
    adminActiveTimerInterval = null;
  }
  if (adminPresenceSyncInterval) {
    clearInterval(adminPresenceSyncInterval);
    adminPresenceSyncInterval = null;
  }
}

function startAdminPresenceSync() {
  if (adminPresenceSyncInterval) {
    clearInterval(adminPresenceSyncInterval);
    adminPresenceSyncInterval = null;
  }

  if (currentRole !== 'admin' || currentPageId !== 'ad-users') {
    return;
  }

  adminPresenceSyncInterval = setInterval(() => {
    if (currentRole !== 'admin' || currentPageId !== 'ad-users') {
      stopAdminActiveTimers();
      return;
    }

    if (typeof syncUsersFromBackend !== 'function') {
      return;
    }

    syncUsersFromBackend().then((changed) => {
      if (!changed || currentPageId !== 'ad-users') {
        return;
      }

      const map = { 'ad-users': renderAdminUsers };
      const mainEl = document.getElementById('main');
      if (mainEl) {
        mainEl.innerHTML = (map[currentPageId] || (() => ''))();
      }
    });
  }, 3000);
}

function startAdminActiveTimers() {
  stopAdminActiveTimers();

  const tick = function () {
    const timerEls = document.querySelectorAll('.active-duration[data-user-index]');
    timerEls.forEach((el) => {
      const idx = Number(el.getAttribute('data-user-index'));
      if (Number.isNaN(idx) || !USERS[idx]) {
        return;
      }
      el.textContent = getActiveDurationText(USERS[idx]);
    });
  };

  tick();
  adminActiveTimerInterval = setInterval(tick, 1000);
}

/* ── ADMIN PAGES ── */
function renderAdminDash() {
  // Reload data from localStorage to get latest
  loadUsers();
  loadTickets();
  loadAnnouncements();
  
  const newCount = USERS.filter((u) => u.isNew).length;
  const parseActivityDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const dt = new Date(raw);
    const ms = dt.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  };

  const formatActivityTime = (value) => {
    const ts = parseActivityDate(value);
    if (!ts) return 'Recently';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  const activity = [];

  USERS.filter((u) => u && u.isNew).forEach((u) => {
    activity.push({
      label: `${u.name} registered via portal`,
      time: u.joinDate,
      sortTime: parseActivityDate(u.joinDate),
      action: `<a onclick="showPage('ad-users')" style="color:var(--cg-dark);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;margin-left:8px;">View →</a>`
    });
  });

  TICKETS.forEach((t) => {
    if (!t) return;
    activity.push({
      label: `${t.id} submitted by ${t.student}`,
      time: t.date,
      sortTime: parseActivityDate(t.date),
      action: ''
    });

    if (t.statusUpdatedAt && t.status !== 'Pending') {
      activity.push({
        label: `${t.id} updated to ${t.status}`,
        time: t.statusUpdatedAt,
        sortTime: parseActivityDate(t.statusUpdatedAt),
        action: ''
      });
    }
  });

  ANNOUNCEMENTS.filter((a) => a && !a.draft).forEach((a) => {
    activity.push({
      label: `Announcement published: ${a.title}`,
      time: a.createdAt || a.date,
      sortTime: parseActivityDate(a.createdAt || a.date),
      action: `<a onclick="showPage('ad-announce')" style="color:var(--cg-dark);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;margin-left:8px;">View →</a>`
    });
  });

  const recentActivity = activity
    .filter((item) => item.sortTime > 0)
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 6);

  return `<div><div class="page-hdr"><div><div class="page-title">Admin Dashboard</div><div class="page-sub">System-wide overview</div></div></div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.list}</div><div class="stat-label">Total Tickets</div><div class="stat-val">${TICKETS.length}</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:var(--blue);"></div><div class="stat-icon" style="background:var(--blue-bg);color:var(--blue);">${IC.users}</div><div class="stat-label">Registered Users</div><div class="stat-val">${USERS.length}</div>${newCount ? `<div class="stat-sub" style="color:var(--cg-dark);font-weight:700;">+${newCount} new via portal</div>` : '<div class="stat-sub">Total accounts</div>'}</div>
    <div class="stat-card"><div class="stat-top-bar" style="background:#f59e0b;"></div><div class="stat-icon" style="background:#fffbeb;color:#f59e0b;">${IC.bell}</div><div class="stat-label">Pending</div><div class="stat-val" style="color:#92600a;">${TICKETS.filter((t) => t.status === 'Pending').length}</div></div>
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.check}</div><div class="stat-label">Resolved</div><div class="stat-val" style="color:var(--cg-dark);">${TICKETS.filter((t) => t.status === 'Resolved').length}</div></div>
  </div>
  <div class="two-col-wide">
    <div class="card"><div class="card-title">Department Load</div>${[['Accounting', TICKETS.filter((t) => t.dept === 'Accounting').length, 'var(--cg)'], ['Registrar', TICKETS.filter((t) => t.dept === 'Registrar').length, 'var(--blue)']].map(([d, n, c]) => `<div class="rep-row"><div class="rep-label">${d}</div><div style="flex:1;"><div class="prog-bar"><div class="prog-fill" style="width:${Math.min(n * 25, 100)}%;background:${c};"></div></div></div><div class="rep-count">${n}</div></div>`).join('')}</div>
    <div class="card"><div class="card-title">Recent Activity</div>
      ${recentActivity.length ? recentActivity.map((item) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--n100);font-size:12px;"><span style="color:var(--n600);">${item.label}</span><div style="display:flex;align-items:center;"><span style="color:var(--n300);margin-left:8px;white-space:nowrap;">${formatActivityTime(item.time)}</span>${item.action}</div></div>`).join('') : `<div style="padding:12px 0;font-size:12px;color:var(--n400);">No recent activity yet.</div>`}
    </div>
  </div></div>`;
}

function renderAdminUsers() {
  // Reload USERS from localStorage to get latest registered students
  loadUsers();
  setTimeout(startAdminPresenceSync, 0);

  const meta = window.PRESENCE_SYNC_META || {};
  const syncSourceLabel = meta.source === 'users' ? 'Backend Auth' : (meta.source === 'bootstrap' ? 'Backend Fallback' : 'No Sync');
  const syncStateColor = meta.ok ? 'var(--cg-dark)' : '#b45309';
  const syncText = meta.lastSyncAt
    ? new Date(meta.lastSyncAt).toLocaleTimeString('en-US', { hour12: false })
    : 'never';
  
  const newCount = USERS.filter((u) => u.isNew).length;
  return `<div>
  <div class="page-hdr">
    <div><div class="page-title">User Management</div><div class="page-sub">Total ${USERS.length} users${newCount ? ` &nbsp;·&nbsp; <span style="color:var(--cg-dark);font-weight:700;">${newCount} new portal registration${newCount > 1 ? 's' : ''}</span>` : ''} &nbsp;·&nbsp; <span style="color:${syncStateColor};font-weight:700;">Presence: ${syncSourceLabel}</span> <span style="color:var(--n400);">(${syncText})</span></div></div>
    <button class="btn btn-primary" onclick="openAddUserModal()">${IC.plus} Add User</button>
  </div>
  ${newCount ? `<div style="background:var(--cg-pale);border:1px solid var(--cg-pale2);border-radius:var(--radius-lg);padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;"><div style="width:36px;height:36px;background:var(--cg);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:15px;">👋</div><div><div style="font-size:13px;font-weight:700;color:var(--cg-dark);">${newCount} new student${newCount > 1 ? ' accounts have' : ' account has'} registered through the portal</div><div style="font-size:11.5px;color:var(--n500);margin-top:2px;">These accounts are highlighted below with a <span class="new-badge">NEW</span> badge.</div></div></div>` : ''}
  <div class="card">
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Student / User</th><th>ID</th><th>Role</th><th>Course & Year</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    ${USERS.map((u, i) => `<tr${u.isNew ? ' class="new-row"' : ''}>
      <td><div style="display:flex;align-items:center;gap:10px;"><div class="user-av" style="background:${u.bg};color:${u.col};">${u.ini}</div><div><div style="font-weight:600;font-size:12.5px;">${u.name}${u.isNew ? `<span class="new-badge">NEW</span>` : ''}</div>${u.joinDate ? `<div style="font-size:10.5px;color:var(--n300);">Joined ${u.joinDate}</div>` : ''}</div></div></td>
      <td style="color:var(--n400);font-size:11.5px;font-weight:600;">${u.id}</td>
      <td><span class="chip">${u.role}</span></td>
      <td style="font-size:11.5px;color:var(--n500);">${u.course ? `${abbrevCourse(u.course)}<br/><span style="color:var(--n300);">${u.year}</span>` : '—'}</td>
      <td style="font-size:11.5px;color:var(--n400);">${u.email || '—'}</td>
      <td>${u.status === 'Active' ? `<span class="badge badge-resolved">Active</span>` : `<span class="badge badge-rejected">Inactive</span>`}</td>
      <td><div style="display:flex;gap:5px;"><button class="btn btn-xs" onclick="openEditUserModal(${i})">${IC.edit} Edit</button><button class="btn btn-xs btn-danger" onclick="toggleUserStatus(${i})">${u.status === 'Active' ? 'Deactivate' : 'Activate'}</button><button class="btn btn-xs btn-danger" onclick="confirmDeleteUser(${i})">${IC.trash} Delete</button></div></td>
    </tr>`).join('')}
    </tbody></table></div>
  </div></div>`;
}

function openAddUserModal() {
  openModal('Add New User', 'Fill in the details to create a new account', `<div class="fg"><label class="fl">Full Name</label><input class="fi" id="nu-name" placeholder="Full name"/></div><div class="fg"><label class="fl">ID / Student No.</label><input class="fi" id="nu-id" placeholder="User ID"/></div><div class="fg"><label class="fl">Role</label><select class="fi" id="nu-role"><option>Student</option><option>Accounting</option><option>Registrar</option><option>Admin</option></select></div>`, `<button class="btn" onclick="closeModalNow()">Cancel</button><button class="btn btn-primary" onclick="addUser()">Add User</button>`);
}

function addUser() {
  const name = document.getElementById('nu-name')?.value?.trim(),
    id = document.getElementById('nu-id')?.value?.trim(),
    role = document.getElementById('nu-role')?.value;
  if (!name || !id) {
    toast('Please fill in all fields', 'error');
    return;
  }
  const cm = { Student: 'rgba(26,162,96,0.15)', Accounting: 'rgba(37,99,235,0.15)', Registrar: 'rgba(240,180,41,0.15)', Admin: 'rgba(139,92,246,0.15)' },
    ct = { Student: '#15803d', Accounting: '#1d4ed8', Registrar: '#92400e', Admin: '#5b21b6' };
  USERS.push({ name, id, role, ini: name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(), bg: cm[role] || cm.Student, col: ct[role] || ct.Student, status: 'Active', isNew: false, email: '', course: '', year: '' });
  saveUsers();
  closeModalNow();
  toast(`"${name}" added!`);
  showPage('ad-users');
}

function openEditUserModal(i) {
  const u = USERS[i];
  const currentRoleValue = u.role === 'Faculty' ? 'Registrar' : u.role;
  openModal('Edit User', `Editing: ${u.name}`, `<div class="fg"><label class="fl">Full Name</label><input class="fi" id="eu-name" value="${u.name}"/></div><div class="fg"><label class="fl">ID</label><input class="fi" id="eu-id" value="${u.id}"/></div><div class="fg"><label class="fl">Role</label><select class="fi" id="eu-role">${['Student', 'Accounting', 'Registrar', 'Admin'].map((r) => `<option${r === currentRoleValue ? ' selected' : ''}>${r}</option>`).join('')}</select></div>`, `<button class="btn" onclick="closeModalNow()">Cancel</button><button class="btn btn-primary" onclick="saveUser(${i})">Save Changes</button>`);
}

function saveUser(i) {
  USERS[i].name = document.getElementById('eu-name')?.value?.trim() || USERS[i].name;
  USERS[i].id = document.getElementById('eu-id')?.value?.trim() || USERS[i].id;
  USERS[i].role = document.getElementById('eu-role')?.value || USERS[i].role;
  USERS[i].ini = USERS[i].name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  saveUsers();
  closeModalNow();
  toast('User updated!');
  showPage('ad-users');
}

function toggleUserStatus(i) {
  USERS[i].status = USERS[i].status === 'Active' ? 'Inactive' : 'Active';
  if (USERS[i].status === 'Active') {
    USERS[i].activeSince = new Date().toISOString();
    USERS[i].lastSeenAt = '';
  } else {
    USERS[i].activeSince = '';
    USERS[i].lastSeenAt = new Date().toISOString();
  }
  saveUsers();
  toast(`"${USERS[i].name}" ${USERS[i].status === 'Active' ? 'activated' : 'deactivated'}`);
  showPage('ad-users');
}

function confirmDeleteUser(i) {
  const u = USERS[i];
  if (!u) return;
  window.__pendingDeleteUser = { ...u };
  openModal(
    'Delete Account Permanently',
    `Are you sure you want to delete <strong>${u.name}</strong> (${u.id})?`,
    `<div style="padding:6px 0;color:#b91c1c;font-size:13px;line-height:1.6;">This action cannot be undone. The account will be permanently removed and the user will no longer be able to log in.</div>`,
    `<button class="btn" onclick="closeModalNow()">Cancel</button><button class="btn btn-danger" onclick="deleteUserConfirmed()">Delete Permanently</button>`
  );
}

async function deleteUserConfirmed() {
  const pending = window.__pendingDeleteUser || null;
  const u = pending || null;
  if (!u) { closeModalNow(); return; }
  const userName = u.name;
  const userId = u.id;
  const uname = u.uname || '';
  const backendId = u.backendId || '';
  let backendDeleteFailed = false;

  // Delete from backend first so the account doesn't return after sync/refresh.
  if (typeof apiDeleteUser === 'function') {
    try {
      await apiDeleteUser(backendId || userId, uname, userId);
    } catch (e) {
      backendDeleteFailed = true;
    }
  }

  // Remove from USERS
  USERS = USERS.filter((x) => !(x.id === userId || String(x.uname || '').toLowerCase() === String(uname).toLowerCase()));
  saveUsers();

  // Mark this user as deleted so backend sync will not re-add it later.
  try {
    const deletedUsers = JSON.parse(localStorage.getItem('deletedUsers') || '[]');
    const next = Array.isArray(deletedUsers) ? deletedUsers : [];
    [String(userId || ''), String(uname || '').toLowerCase(), String(backendId || '')].forEach((v) => {
      if (v && !next.includes(v)) {
        next.push(v);
      }
    });
    localStorage.setItem('deletedUsers', JSON.stringify(next));
  } catch (e) {}

  // Remove from ACCOUNTS
  const keysToDelete = [];
  for (const [key, acc] of Object.entries(ACCOUNTS)) {
    if ((acc && acc.id === userId) || key === uname || key === String(userId).toLowerCase()) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((k) => delete ACCOUNTS[k]);

  // Update registeredStudents in localStorage
  const demoAccounts = ['maria.santos', 'jose.reyes', 'admin'];
  const registered = {};
  for (const [key, acc] of Object.entries(ACCOUNTS)) {
    if (!demoAccounts.includes(key)) {
      registered[key] = acc;
    }
  }
  try {
    localStorage.setItem('registeredStudents', JSON.stringify(registered));
    localStorage.setItem('registeredStudentsBackup', JSON.stringify(registered));
  } catch (e) {}

  // Remove profile photo
  if (profilePhotos[userId]) {
    delete profilePhotos[userId];
    if (typeof saveProfilePhotos === 'function') saveProfilePhotos();
  }

  window.__pendingDeleteUser = null;
  closeModalNow();
  if (backendDeleteFailed) {
    toast(`"${userName}" deleted locally. Backend is offline, so it may reappear if sync resumes.`, 'error');
  } else {
    toast(`"${userName}" has been permanently deleted.`);
  }
  showPage('ad-users');
}

function renderAdminTickets() {
  // Reload tickets from localStorage
  loadTickets();
  
  return `<div><div class="page-hdr"><div><div class="page-title">All Tickets</div><div class="page-sub">Across all departments</div></div></div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;background:var(--cg-pale);border:1px solid var(--cg-pale2);border-radius:var(--radius);">
      <span style="color:var(--cg-dark);">${IC.graduation}</span>
      <span style="font-size:12px;color:var(--cg-dark);font-weight:600;">Each ticket now shows the student's <strong>Course & Year</strong> for quick reference.</span>
    </div>
    ${buildFilterBar('ad-tickets', true, true)}<div id="tbl-container">${filterTbl(TICKETS, true, true)}</div>
  </div></div>`;
}

function renderAnnouncements() {
  // Reload announcements from localStorage
  loadAnnouncements();
  
  return `<div><div class="page-hdr"><div><div class="page-title">Announcements</div></div></div>
  <div class="two-col">
    <div><div class="card"><div class="card-title">Post New Announcement</div>
      <div class="fg"><label class="fl">Title *</label><input class="fi" id="ann-title" placeholder="Announcement title"/></div>
      <div class="fg"><label class="fl">Audience</label><select class="fi" id="ann-aud"><option>All Users</option><option>Students Only</option><option>Staff Only</option></select></div>
      <div class="fg"><label class="fl">Message *</label><textarea class="fi" id="ann-body" rows="4" placeholder="Write your announcement…"></textarea></div>
      <div style="display:flex;gap:8px;"><button class="btn btn-primary" onclick="publishAnn(false)">Publish</button><button class="btn" onclick="publishAnn(true)">Save Draft</button></div>
    </div></div>
    <div><div class="card"><div class="card-hdr"><div class="card-title" id="ann-published-count">Published (${ANNOUNCEMENTS.filter((a) => !a.draft).length})</div></div><div id="ann-list">${renderAnnList()}</div></div></div>
  </div></div>`;
}

function updateAnnouncementPublishedCount() {
  const el = document.getElementById('ann-published-count');
  if (!el) return;
  el.textContent = `Published (${ANNOUNCEMENTS.filter((a) => !a.draft).length})`;
}

function renderAnnList() {
  return ANNOUNCEMENTS.filter((a) => !a.draft)
    .map((a) => `<div class="ann-item"><div class="ann-dot"></div><div style="flex:1;"><div class="ann-title">${a.title}</div><div class="ann-body">${a.body}</div><div class="ann-date">${a.date} · ${a.audience}</div></div><button class="btn btn-xs btn-danger" style="flex-shrink:0;" onclick="deleteAnn('${a.id}')">Delete</button></div>`)
    .join('') || '<div style="color:var(--n300);font-size:12px;padding:12px 0;">No announcements yet</div>';
}

function publishAnn(isDraft) {
  const title = document.getElementById('ann-title')?.value?.trim(),
    body = document.getElementById('ann-body')?.value?.trim(),
    aud = document.getElementById('ann-aud')?.value;
  if (!title || !body) {
    toast('Please fill in title and message', 'error');
    return;
  }
  ANNOUNCEMENTS.unshift({ id: 'ANN-' + String(ANNOUNCEMENTS.length + 1).padStart(3, '0'), title, body, date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), createdAt: new Date().toISOString(), audience: aud, draft: isDraft });
  const saved = saveAnnouncements();
  if (!saved) {
    toast('Could not save announcement to storage. Please free browser storage and try again.', 'error');
  }
  toast(isDraft ? 'Draft saved!' : 'Announcement published!');
  document.getElementById('ann-title').value = '';
  document.getElementById('ann-body').value = '';
  const al = document.getElementById('ann-list');
  if (al) al.innerHTML = renderAnnList();
  updateAnnouncementPublishedCount();
}

function deleteAnn(announcementId) {
  const idx = ANNOUNCEMENTS.findIndex((a) => a && a.id === announcementId);
  if (idx < 0) {
    toast('Announcement not found', 'error');
    return;
  }
  ANNOUNCEMENTS.splice(idx, 1);
  saveAnnouncements();
  toast('Deleted');
  const al = document.getElementById('ann-list');
  if (al) al.innerHTML = renderAnnList();
  updateAnnouncementPublishedCount();
}

function renderAdminReports() {
  loadUsers();
  loadTickets();
  loadAnnouncements();

  const tickets = Array.isArray(TICKETS) ? TICKETS : [];
  const totalTickets = tickets.length;
  const resolvedCount = tickets.filter((t) => t.status === 'Resolved').length;
  const resolvedRate = totalTickets ? Math.round((resolvedCount / totalTickets) * 100) : 0;
  const publishedAnnouncements = (Array.isArray(ANNOUNCEMENTS) ? ANNOUNCEMENTS : []).filter((a) => a && !a.draft).length;
  const activeUsers = (Array.isArray(USERS) ? USERS : []).filter((u) => u && u.status === 'Active').length;

  const parseDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const resolvedDurations = tickets
    .filter((t) => t.status === 'Resolved')
    .map((t) => {
      const started = parseDate(t.date);
      const ended = parseDate(t.statusUpdatedAt || t.updatedAt);
      if (!started || !ended) return null;
      return Math.max(0, ended.getTime() - started.getTime());
    })
    .filter((value) => value !== null);

  const avgResolutionDays = resolvedDurations.length
    ? Math.max(1, Math.round(resolvedDurations.reduce((sum, value) => sum + value, 0) / resolvedDurations.length / 86400000))
    : null;

  const departments = ['Accounting', 'Registrar'];
  const deptRows = departments.map((dept) => {
    const count = tickets.filter((t) => String(t.dept || '') === dept).length;
    return [dept, count];
  });
  const maxDeptCount = deptRows.length ? Math.max(...deptRows.map(([, count]) => count), 1) : 1;

  const monthRows = [];
  const now = new Date();
  for (let offset = 3; offset >= 0; offset -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const count = tickets.filter((t) => String(t.date || '').slice(0, 7) === key).length;
    monthRows.push([dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), count]);
  }
  const maxMonthCount = monthRows.length ? Math.max(...monthRows.map(([, count]) => count), 1) : 1;

  const groupedTickets = {};
  tickets.forEach((t) => {
    const dept = String(t?.dept || 'Others').trim() || 'Others';
    if (!Array.isArray(groupedTickets[dept])) {
      groupedTickets[dept] = [];
    }
    groupedTickets[dept].push(t);
  });

  const orderedDeptSections = ['Accounting', 'Registrar', 'Others']
    .filter((dept) => Array.isArray(groupedTickets[dept]) && groupedTickets[dept].length)
    .concat(Object.keys(groupedTickets).filter((dept) => !['Accounting', 'Registrar', 'Others'].includes(dept)).sort());

  return `<div><div class="page-hdr"><div><div class="page-title">Analytics & Reports</div><div class="page-sub">Live system-wide metrics</div></div></div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.list}</div><div class="stat-label">Total Tickets</div><div class="stat-val">${totalTickets}</div><div class="stat-sub">All recorded concerns</div></div>
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.check}</div><div class="stat-label">Resolved</div><div class="stat-val" style="color:var(--cg-dark);">${resolvedCount}</div><div class="stat-sub">${resolvedRate}% resolution rate</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:var(--blue);"></div><div class="stat-icon" style="background:var(--blue-bg);color:var(--blue);">${IC.chart}</div><div class="stat-label">Avg Resolution</div><div class="stat-val">${avgResolutionDays === null ? '—' : `${avgResolutionDays}d`}</div><div class="stat-sub">${avgResolutionDays === null ? 'Waiting for resolved timestamps' : 'Based on resolved tickets'}</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:var(--gold);"></div><div class="stat-icon" style="background:var(--gold-bg);color:var(--gold);">${IC.bell}</div><div class="stat-label">Published Announcements</div><div class="stat-val">${publishedAnnouncements}</div><div class="stat-sub">${activeUsers} active user${activeUsers === 1 ? '' : 's'}</div></div>
  </div>
  <div class="two-col-wide">
    <div class="card"><div class="card-title">By department</div>${deptRows.map(([dept, count]) => `<div class="rep-row"><div class="rep-label">${dept}</div><div style="flex:1;"><div class="prog-bar"><div class="prog-fill" style="width:${Math.max(count ? Math.round((count / maxDeptCount) * 100) : 0, count ? 8 : 0)}%;background:${dept === 'Accounting' ? 'var(--cg)' : dept === 'Registrar' ? 'var(--blue)' : 'var(--gold)'};"></div></div></div><div class="rep-count">${count}</div></div>`).join('')}</div>
    <div class="card"><div class="card-title">Monthly trend</div>${monthRows.map(([label, count]) => `<div class="rep-row"><div class="rep-label">${label}</div><div style="flex:1;"><div class="prog-bar"><div class="prog-fill" style="width:${Math.max(count ? Math.round((count / maxMonthCount) * 100) : 0, count ? 8 : 0)}%;"></div></div></div><div class="rep-count">${count}</div></div>`).join('')}</div>
  </div>
  ${totalTickets ? orderedDeptSections.map((dept) => `<div class="card" style="margin-top:14px;"><div class="card-hdr"><div class="card-title">${dept} Reports</div><span style="font-size:12px;color:var(--n400);">${groupedTickets[dept].length} record${groupedTickets[dept].length === 1 ? '' : 's'}</span></div>${tbl(groupedTickets[dept], true, true)}</div>`).join('') : `<div class="card"><div class="empty-state">${IC.list}<p>No ticket data yet</p></div></div>`}</div>`;
}

/* ── PROFILE PAGE ── */
function renderProfile() {
  const u = currentUser;
  const photo = (typeof getProfilePhotoByIdentity === 'function') ? getProfilePhotoByIdentity(u) : profilePhotos[u.id];
  const roleLabels = { student: 'Student', accounting: 'Accounting Staff', registrar: 'Registrar Staff', admin: 'System Administrator' };
  const roleColors = { student: 'var(--cg)', accounting: 'var(--blue)', registrar: '#d97706', admin: '#7c3aed' };
  const my = currentRole === 'student' ? TICKETS.filter((t) => t.student === u.name) : [];
  const hasUuidId = u.id && u.id.includes('-') && u.id.length === 36; // Check if UUID format
  return `<div>
  <div class="page-hdr"><div><div class="page-title">My Profile</div><div class="page-sub">Manage your personal information and photo</div></div></div>
  ${hasUuidId ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:12px 14px;background:#fef3c7;border:1px solid #fcd34d;border-radius:var(--radius);color:#7c2d12;"><span style="font-size:18px;">⚠️</span><div><strong>Complete Your Profile</strong><br/><span style="font-size:12px;margin-top:4px;display:block;">Your Student ID is currently a system identifier. Please replace it with your actual numeric Student ID (e.g., 21210747) below.</span></div></div>` : ''}
  <div class="two-col">
    <div>
      <div class="card" style="text-align:center;padding:32px 24px;">
        <div style="position:relative;display:inline-block;margin-bottom:20px;">
          <div id="prof-avatar" style="width:110px;height:110px;border-radius:50%;margin:0 auto;border:3px solid ${photo ? 'var(--cg)' : 'var(--border)'};overflow:hidden;background:${u.bg};display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:${u.col};background-size:cover;background-position:center;${photo ? 'background-image:url(' + photo + ');background-color:transparent;' : ''}">
            ${photo ? '' : '<span>' + u.ini + '</span>'}
          </div>
          <label id="photo-upload-label" style="position:absolute;bottom:2px;right:2px;width:32px;height:32px;background:var(--cg);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:10;" title="Change photo" onclick="document.getElementById('photo-upload').click();">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </label>
          <input type="file" id="photo-upload" accept="image/*" style="display:none;" onchange="handlePhotoUpload(event)"/>
        </div>
        <div style="font-size:20px;font-weight:800;color:var(--n800);letter-spacing:-0.3px;">${u.name}</div>
        <div style="margin-top:6px;"><span style="display:inline-block;padding:3px 14px;border-radius:20px;font-size:11px;font-weight:700;background:${roleColors[currentRole]}22;color:${roleColors[currentRole]};border:1px solid ${roleColors[currentRole]}44;">${roleLabels[currentRole] || currentRole}</span></div>
        <div style="font-size:12px;color:var(--n400);margin-top:8px;">${u.id}</div>
        ${photo ? `<button class="btn btn-xs" style="margin-top:14px;color:var(--red);border-color:#fecaca;" onclick="removePhoto()">Remove Photo</button>` : ''}
      </div>
      <div class="card">
        <div class="card-title">Edit Information</div>
        <div class="fg"><label class="fl">Full Name</label><input class="fi" id="prof-name" value="${u.name}"/></div>
        <div class="fg"><label class="fl">Email Address</label><input class="fi" id="prof-email" type="email" value="${u.email || ''}" placeholder="your@email.com"/></div>
        ${currentRole === 'student' ? `
        <div class="fg"><label class="fl">Student ID Number *</label><input class="fi" id="prof-sid" type="text" value="${u.id || ''}" placeholder="e.g., 21210747" style="background:${u.id && u.id.includes('-') ? '#fff3cd' : '#f0fdf4'};"/></div>
        <div class="form-row">
          <div class="fg"><label class="fl">Course / Program</label>
            <select class="fi" id="prof-course">
              ${['BS Computer Science', 'BS Criminology', 'BSED', 'CBA', 'Electrical Engineering', 'Mechanical Engineering', 'COED', 'Hospital Management', 'Tourism Management'].map((c) => `<option${((u.course || '') === c) ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="fg"><label class="fl">Year Level</label>
            <select class="fi" id="prof-year">
              ${['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate'].map((y) => `<option${u.year === y ? ' selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>` : ''}
        <div class="fg"><label class="fl">New Password <span style="font-weight:400;color:var(--n300);">(leave blank to keep current)</span></label>
          <div class="pw-wrap"><input class="fi" type="password" id="prof-pw" placeholder="Enter new password"/><button class="pw-eye" onclick="togglePw('prof-pw')" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>
        </div>
        <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title">Account Details</div>
        <table class="info-tbl">
          <tr><td>ID / Employee No.</td><td style="font-weight:700;color:var(--cg-dark);">${u.id}</td></tr>
          <tr><td>Role</td><td>${roleLabels[currentRole] || currentRole}</td></tr>
          <tr><td>Status</td><td><span class="badge badge-resolved">Active</span></td></tr>
          ${u.course ? `<tr><td>Course</td><td>${u.course}</td></tr>` : ''}
          ${u.year ? `<tr><td>Year Level</td><td>${u.year}</td></tr>` : ''}
          ${u.email ? `<tr><td>Email</td><td>${u.email}</td></tr>` : ''}
          ${u.joinDate ? `<tr><td>Joined</td><td>${u.joinDate}</td></tr>` : ''}
        </table>
      </div>
      ${currentRole === 'student' ? `
      <div class="card">
        <div class="card-title">My Activity</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${[['Total Concerns', my.length, 'var(--cg)'], ['Pending', my.filter((t) => t.status === 'Pending').length, '#f59e0b'], ['In Progress', my.filter((t) => t.status === 'In Progress').length, 'var(--blue)'], ['Resolved', my.filter((t) => t.status === 'Resolved').length, 'var(--cg)']].map(([l, v, c]) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:var(--n50);border-radius:var(--radius);border:1px solid var(--n100);">
            <span style="font-size:12.5px;color:var(--n600);">${l}</span>
            <span style="font-size:18px;font-weight:800;color:${c};">${v}</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
      <div class="card" style="background:var(--cg-pale);border-color:var(--cg-pale2);">
        <div class="card-title" style="color:var(--cg-dark);">Photo Guidelines</div>
        <div style="font-size:12px;color:var(--cg-dark);line-height:1.8;">
          • Use a clear, recent photo of your face<br/>
          • JPG, PNG or GIF — max 5MB<br/>
          • Square photos work best<br/>
          • Photo appears on your profile and in the topbar
        </div>
      </div>
    </div>
  </div></div>`;
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  console.log('Photo upload started:', file.name, 'size:', file.size);
  
  if (!currentUser || !currentUser.id) {
    toast('❌ No user logged in', 'error');
    console.error('Cannot upload photo - no currentUser:', currentUser);
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    toast('Image must be under 5MB', 'error');
    return;
  }
  
  toast('⏳ Compressing photo...');
  
  const reader = new FileReader();
  reader.onerror = function() {
    toast('❌ Failed to read file', 'error');
    console.error('FileReader error');
  };
  
  reader.onload = function (e) {
    // Compress image before saving
    const img = new Image();
    img.onload = function () {
      try {
        // Create canvas and resize with better quality for profile viewing.
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Keep enough pixels for sharp avatar display on mobile and desktop.
        let width = img.width;
        let height = img.height;
        const maxSize = 320;
        
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Start with high quality, then reduce only as needed.
        let compressedData = canvas.toDataURL('image/jpeg', 0.88);
        let quality = 0.88;
        
        // Keep a reasonable size limit while preserving quality.
        const maxPhotoSize = 180 * 1024;
        while (compressedData.length > maxPhotoSize && quality > 0.55) {
          quality -= 0.05;
          compressedData = canvas.toDataURL('image/jpeg', quality);
        }
        
        // If still large, shrink dimensions once more before final save.
        if (compressedData.length > maxPhotoSize) {
          const shrinkRatio = 0.75;
          const smallW = Math.max(120, Math.round(width * shrinkRatio));
          const smallH = Math.max(120, Math.round(height * shrinkRatio));
          canvas.width = smallW;
          canvas.height = smallH;
          ctx.drawImage(img, 0, 0, smallW, smallH);
          quality = 0.8;
          compressedData = canvas.toDataURL('image/jpeg', quality);
          while (compressedData.length > maxPhotoSize && quality > 0.55) {
            quality -= 0.05;
            compressedData = canvas.toDataURL('image/jpeg', quality);
          }
        }

        if (compressedData.length > maxPhotoSize) {
          toast('Image is too large. Please choose a smaller photo.', 'error');
          console.error('Photo cannot be compressed enough:', compressedData.length, 'bytes');
          event.target.value = '';
          return;
        }
        
        console.log('Photo compressed to', Math.round(compressedData.length / 1024), 'KB');
        
        profilePhotos[currentUser.id] = compressedData;
        
        // Try to save to localStorage  
        if (typeof saveProfilePhotos === 'function') {
          const saved = saveProfilePhotos();
          
          if (saved) {
            const sizeKb = Math.round(compressedData.length / 1024);
            toast(`✓ Photo saved! (${sizeKb} KB)`);
            console.log('✓ Photo saved successfully');
          } else {
            // localStorage is full - but photo is stored in memory for this session
            const sizeKb = Math.round(compressedData.length / 1024);
            toast(`✓ Photo loaded! (${sizeKb} KB - won't persist on refresh)`);
            console.log('⚠ Photo in memory only - localStorage is full');
          }
        }
        
        // Update avatar display immediately (works whether saved or not)
        const av = document.getElementById('prof-avatar');
        if (av) {
          av.style.backgroundImage = 'url(' + compressedData + ')';
          av.style.backgroundSize = 'cover';
          av.style.backgroundPosition = 'center';
          av.style.backgroundColor = 'transparent';
          av.innerHTML = '';
        }
        
        // Update displays
        updateTopbarAvatar();
        buildSidebar();
        
        // Reset file input
        event.target.value = '';
        
        // Refresh page after delay
        setTimeout(() => showPage(currentPageId), 300)
      } catch (e) {
        console.error('Error during photo compression:', e);
        toast('❌ Error processing photo: ' + e.message, 'error');
        event.target.value = '';
      }
    };
    
    img.onerror = function() {
      toast('❌ Failed to process image', 'error');
      console.error('Image load error');
      event.target.value = '';
    };
    
    img.src = e.target.result;
  };
  
  try {
    reader.readAsDataURL(file);
  } catch (e) {
    toast('❌ Cannot read file: ' + e.message, 'error');
    console.error('FileReader error:', e);
    event.target.value = '';
  }
}

function removePhoto() {
  delete profilePhotos[currentUser.id];
  // SAVE TO LOCALSTORAGE IMMEDIATELY
  if (typeof saveProfilePhotos === 'function') {
    saveProfilePhotos();
  }
  updateTopbarAvatar();
  buildSidebar();
  toast('Photo removed');
  showPage(currentPageId);
}

// Setup photo upload button when profile page is shown
function setupPhotoUploadButton() {
  console.log('📸 setupPhotoUploadButton called');
  try {
    const photoUploadInput = document.getElementById('photo-upload');
    const photoLabel = document.getElementById('photo-upload-label');
    
    console.log('Input element exists?', !!photoUploadInput);
    console.log('Label element exists?', !!photoLabel);
    
    if (!photoUploadInput) {
      console.warn('❌ Photo upload input not found - HTML may not have rendered');
      return;
    }
    
    // Make sure the change handler is attached
    photoUploadInput.onchange = handlePhotoUpload;
    
    // Test the onclick handler on label
    if (photoLabel) {
      photoLabel.onclick = function() {
        console.log('Label clicked, triggering file dialog...');
        photoUploadInput.click();
      };
      console.log('Label onclick handler set');
    }
    
    console.log('✓ Photo upload button ready - handler attached');
  } catch (e) {
    console.error('❌ Error setting up photo button:', e);
  }
}

function saveProfile() {
  const name = document.getElementById('prof-name')?.value?.trim();
  const email = document.getElementById('prof-email')?.value?.trim();
  const pw = document.getElementById('prof-pw')?.value;
  let studentId = null;
  if (document.getElementById('prof-sid')) {
    studentId = document.getElementById('prof-sid')?.value?.trim();
  }
  if (!name) {
    toast('Name cannot be empty', 'error');
    return;
  }
  if (studentId && !studentId.match(/^[0-9]+$/)) {
    toast('Student ID must be numeric (e.g., 21210747)', 'error');
    return;
  }
  const oldName = currentUser.name;
  const oldId = currentUser.id;
  const oldAccountKey = oldId.toLowerCase();
  const newAccountKey = studentId ? studentId.toLowerCase() : oldAccountKey;
  
  // Update currentUser object
  currentUser.name = name;
  currentUser.email = email || '';
  if (studentId && studentId !== oldId) {
    // Migrate profile photo to new ID if it exists
    if (profilePhotos[oldId] && typeof migrateProfilePhoto === 'function') {
      migrateProfilePhoto(oldId, studentId);
    }
    currentUser.id = studentId;
  }
  if (document.getElementById('prof-course')) currentUser.course = document.getElementById('prof-course').value;
  if (document.getElementById('prof-year')) currentUser.year = document.getElementById('prof-year').value;
  if (pw) {
    if (pw.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    currentUser.password = pw;
  }
  
  // Update STUDENT_INFO lookup
  if (currentRole === 'student') {
    delete STUDENT_INFO[oldName];
    STUDENT_INFO[name] = { course: currentUser.course || '', year: currentUser.year || '', email: email || '' };
  }
  
  // Update USERS array
  const ui = USERS.findIndex((u) => u.id === oldId);
  if (ui >= 0) {
    USERS[ui].name = name;
    USERS[ui].id = currentUser.id;
    USERS[ui].email = email || '';
    if (currentUser.course) USERS[ui].course = currentUser.course;
    if (currentUser.year) USERS[ui].year = currentUser.year;
  }
  
  // Update ACCOUNTS and registeredStudents
  if (currentRole === 'student') {
    const newAccountKey = studentId ? studentId.toLowerCase() : currentUser.id.toLowerCase();
    const oldAccountKey = oldId.toLowerCase();
    
    // Create new account with all current data
    ACCOUNTS[newAccountKey] = { ...currentUser };
    
    // Save to registeredStudents - ALWAYS pass oldAccountKey for cleanup
    if (typeof saveStudentRegistration === 'function') {
      saveStudentRegistration(newAccountKey, ACCOUNTS[newAccountKey], oldAccountKey);
    }
  } else {
    const canonicalByRole = {
      accounting: 'maria.santos',
      registrar: 'jose.reyes',
      admin: 'admin'
    };
    const canonicalKey = canonicalByRole[String(currentRole || '').toLowerCase()] || '';
    const providedKey = String(currentUser.username || currentUser.uname || '').toLowerCase();
    const idMatchedKeys = Object.keys(ACCOUNTS).filter((key) => String(ACCOUNTS[key]?.id || '') === String(currentUser.id || ''));
    const relatedKeys = Array.from(new Set([canonicalKey, providedKey, ...idMatchedKeys].filter(Boolean)));

    // Keep all staff aliases in sync so old passwords cannot remain valid on stale keys.
    relatedKeys.forEach((key) => {
      if (!ACCOUNTS[key]) {
        return;
      }
      ACCOUNTS[key] = {
        ...ACCOUNTS[key],
        ...currentUser,
        role: String(ACCOUNTS[key].role || currentRole).toLowerCase(),
        password: pw ? pw : ACCOUNTS[key].password
      };
    });

    const finalKey = canonicalKey || providedKey || relatedKeys[0];
    if (finalKey) {
      currentUser.uname = finalKey;
      currentUser.username = finalKey;
      if (pw && typeof setStaffPasswordOverride === 'function') {
        setStaffPasswordOverride(finalKey, pw);
      }
    }

    if (typeof saveStaffAccounts === 'function') {
      saveStaffAccounts();
    }
    try {
      localStorage.setItem('accountsList', JSON.stringify(ACCOUNTS));
    } catch (e) {
      console.error('Failed to save legacy accounts list:', e);
    }
  }
  
  // Save all data to localStorage
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  saveUsers();

  // Keep backend profile in sync when API is available.
  if (currentRole === 'student' && typeof apiUpdateProfile === 'function') {
    apiUpdateProfile(oldId, {
      full_name: currentUser.name,
      email: currentUser.email || '',
      student_id: currentUser.id,
      course: currentUser.course || '',
      year_level: currentUser.year || ''
    }).catch((e) => {
      console.log('Backend profile sync skipped:', e.message);
    });
  }
  
  // Update UI elements immediately
  document.getElementById('tb-username').textContent = name;
  if (document.getElementById('tb-id')) {
    document.getElementById('tb-id').textContent = currentUser.id;
  }
  // Update sidebar ID immediately
  const sbUserIdEl = document.querySelector('.sb-user-id');
  if (sbUserIdEl) {
    sbUserIdEl.textContent = currentUser.id;
  }
  
  // Show message if Student ID changed
  if (studentId && studentId !== oldId) {
    toast(`✓ Student ID updated to ${studentId}. Use it to log in next time.`, 'success');
  } else {
    toast('Profile saved successfully!');
  }
  
  // Fully reload and re-render after a brief delay
  setTimeout(() => {
    loadUsers();
    buildSidebar();
    showPage(currentPageId);
  }, 150);
}
