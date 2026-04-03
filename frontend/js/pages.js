// Pages module - all page renderers

function showPage(id) {
  // For students, ensure currentUser is synced before showing page
  if (currentRole === 'student' && typeof syncCurrentUserWithSaved === 'function') {
    syncCurrentUserWithSaved();
  }
  
  currentPageId = id;
  activeFilter = 'All';
  searchQuery = '';
  document.querySelectorAll('.nav-item').forEach((e) => e.classList.remove('active'));
  const el = document.getElementById('nav-' + id);
  if (el) el.classList.add('active');
  const map = {
    's-dash': renderStudentDash,
    's-submit': renderSubmitForm,
    's-tickets': renderMyTickets,
    's-notifs': renderNotifs,
    'a-dash': renderAccDash,
    'a-concerns': renderAccConcerns,
    'a-reports': () => renderReports('Accounting'),
    'a-notifs': () => renderStaffNotifs('Accounting'),
    'r-dash': renderRegDash,
    'r-concerns': renderRegConcerns,
    'r-reports': () => renderReports('Registrar'),
    'r-notifs': () => renderStaffNotifs('Registrar'),
    'ad-dash': renderAdminDash,
    'ad-users': renderAdminUsers,
    'ad-tickets': renderAdminTickets,
    'ad-announce': renderAnnouncements,
    'ad-reports': renderAdminReports,
    'ad-profile': renderProfile,
    's-profile': renderProfile,
    'a-profile': renderProfile,
    'r-profile': renderProfile,
  };
  document.getElementById('main').innerHTML = (map[id] || (() => ''))();

  // Keep admin pages in sync with backend user records.
  if (currentRole === 'admin' && (id === 'ad-users' || id === 'ad-dash')) {
    if (typeof syncUsersFromBackend === 'function') {
      syncUsersFromBackend().then((changed) => {
        if (changed && currentPageId === id) {
          document.getElementById('main').innerHTML = (map[id] || (() => ''))();
        }
      });
    }
  }
  
  // Setup photo upload button if profile page
  if (id && (id.includes('profile'))) {
    setTimeout(() => {
      if (typeof setupPhotoUploadButton === 'function') {
        setupPhotoUploadButton();
      }
    }, 10);
  }
}

/* ── STUDENT PAGES ── */
function renderStudentDash() {
  const my = getCurrentStudentTickets();
  const [p, ip, r] = [my.filter((t) => t.status === 'Pending').length, my.filter((t) => t.status === 'In Progress').length, my.filter((t) => t.status === 'Resolved').length];
  const visibleAnnouncements = ANNOUNCEMENTS.filter((a) => {
    if (!a || a.draft) return false;
    const audience = String(a.audience || 'All Users');
    return audience === 'All Users' || audience === 'Students Only';
  });
  return `<div>
  <div class="page-hdr"><div><div class="page-title">My Dashboard</div><div class="page-sub">Welcome back, ${currentUser.name}!</div></div><div style="display:flex;gap:8px;"><button class="btn btn-primary" onclick="showPage('s-submit')">${IC.plus} New Concern</button></div></div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.list}</div><div class="stat-label">Total Concerns</div><div class="stat-val">${my.length}</div><div class="stat-sub">This semester</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:#f59e0b;"></div><div class="stat-icon" style="background:#fffbeb;color:#f59e0b;">${IC.bell}</div><div class="stat-label">Pending</div><div class="stat-val" style="color:#92600a;">${p}</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:var(--blue);"></div><div class="stat-icon" style="background:var(--blue-bg);color:var(--blue);">${IC.chart}</div><div class="stat-label">In Progress</div><div class="stat-val" style="color:var(--blue);">${ip}</div></div>
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.check}</div><div class="stat-label">Resolved</div><div class="stat-val" style="color:var(--cg-dark);">${r}</div></div>
  </div>
  <div class="two-col">
    <div><div class="card"><div class="card-hdr"><div class="card-title">Recent Tickets</div><button class="btn btn-sm" onclick="showPage('s-tickets')">View all</button></div>${my.length ? tbl(my.slice(0, 3), false, false) : `<div class="empty-state">${IC.list}<p>No tickets yet. <a onclick="showPage('s-submit')" style="color:var(--cg-dark);cursor:pointer;font-weight:600;">Submit your first concern</a></p></div>`}</div></div>
    <div><div class="card"><div class="card-title">Announcements</div>${visibleAnnouncements.length ? visibleAnnouncements.map((a) => `<div class="ann-item"><div class="ann-dot"></div><div><div class="ann-title">${a.title}</div><div class="ann-body">${a.body}</div><div class="ann-date">${a.date}</div></div></div>`).join('') : `<div style="color:var(--n400);font-size:12px;padding:12px 0;">No announcements for students.</div>`}</div></div>
  </div></div>`;
}

function studentChatKey() {
  if (!currentUser || !currentUser.id) {
    return '';
  }
  return String(currentUser.id);
}

function getStudentChatThread(dept) {
  const key = studentChatKey();
  if (!key) {
    return [];
  }

  if (!CHAT_THREADS[key]) {
    CHAT_THREADS[key] = {
      Accounting: [],
      Registrar: []
    };
  }

  if (!Array.isArray(CHAT_THREADS[key][dept])) {
    CHAT_THREADS[key][dept] = [];
  }

  return CHAT_THREADS[key][dept];
}

function renderStudentChat(dept = 'Accounting') {
  const safeDept = dept === 'Registrar' ? 'Registrar' : 'Accounting';
  const thread = getStudentChatThread(safeDept);

  return `<div>
  <div class="page-hdr"><div><div class="page-title">Chat Support</div><div class="page-sub">Message Accounting or Registrar directly</div></div></div>
  <div class="card" style="max-width:880px;">
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button class="btn ${safeDept === 'Accounting' ? 'btn-primary' : ''}" onclick="openStudentChatDept('Accounting')">Accounting</button>
      <button class="btn ${safeDept === 'Registrar' ? 'btn-primary' : ''}" onclick="openStudentChatDept('Registrar')">Registrar</button>
    </div>
    <div style="height:320px;overflow:auto;border:1px solid var(--n100);border-radius:var(--radius);padding:12px;background:var(--n50);" id="student-chat-thread">
      ${thread.length ? thread.map((m) => `<div style="display:flex;justify-content:${m.from === 'student' ? 'flex-end' : 'flex-start'};margin-bottom:8px;"><div style="max-width:72%;padding:9px 11px;border-radius:10px;background:${m.from === 'student' ? 'var(--cg)' : '#fff'};color:${m.from === 'student' ? '#fff' : 'var(--n700)'};border:${m.from === 'student' ? 'none' : '1px solid var(--n100)'};"><div style="font-size:12px;line-height:1.4;">${m.text}</div><div style="font-size:10px;opacity:.8;margin-top:4px;">${m.time}</div></div></div>`).join('') : `<div style="font-size:12px;color:var(--n400);">No messages yet. Start your conversation with ${safeDept}.</div>`}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <input class="fi" id="student-chat-input" placeholder="Type your message to ${safeDept}..." onkeydown="if(event.key==='Enter')sendStudentChatMessage('${safeDept}')"/>
      <button class="btn btn-primary" onclick="sendStudentChatMessage('${safeDept}')"><span style="display:inline-flex;width:16px;height:16px;">${IC.send}</span> Send</button>
    </div>
  </div></div>`;
}

function openStudentChatDept(dept) {
  document.getElementById('main').innerHTML = renderStudentChat(dept);
}

function sendStudentChatMessage(dept) {
  const input = document.getElementById('student-chat-input');
  const text = input?.value?.trim();
  if (!text) {
    toast('Please type a message', 'error');
    return;
  }

  const thread = getStudentChatThread(dept);
  const now = new Date();
  const time = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  thread.push({
    from: 'student',
    text,
    time
  });

  if (thread.length === 1) {
    thread.push({
      from: 'staff',
      text: `${dept} received your message. We will reply here as soon as possible.`,
      time
    });
  }

  saveChatThreads();
  openStudentChatDept(dept);
  toast(`Message sent to ${dept}`);
}

function renderSubmitForm() {
  pendingConcernFiles = [];
  return `<div>
  <div class="page-hdr"><div><div class="page-title">Submit a Concern</div><div class="page-sub">A ticket number will be automatically assigned</div></div></div>
  <div style="max-width:640px;"><div class="card">
    <div class="alert-info"><span style="display:inline-flex;width:18px;height:18px;flex-shrink:0;align-items:center;justify-content:center;">${IC.info}</span><span>Our team responds within 1–3 business days.</span></div>
    <div class="form-row">
      <div class="fg"><label class="fl">Department *</label><select class="fi" id="dept-sel" onchange="updateCats()"><option value="">Select department</option><option>Accounting</option><option>Registrar</option><option>Others</option></select></div>
      <div class="fg"><label class="fl">Concern Category *</label><select class="fi" id="cat-sel"><option value="">Select department first</option></select></div>
    </div>
    <div class="fg"><label class="fl">Subject *</label><input class="fi" id="subj-inp" placeholder="Brief description of your concern"/></div>
    <div class="fg"><label class="fl">Details *</label><textarea class="fi" id="detail-inp" rows="5" placeholder="Explain your concern in detail…"></textarea></div>
    <div class="fg"><label class="fl">Supporting Documents</label>
      <div class="upload-zone" onclick="triggerConcernFilePicker()">
        <div class="upload-zone-icon">${IC.upload}</div><p>Click to upload or drag and drop</p><span>PNG, JPG, PDF, DOC up to 10MB</span>
      </div>
      <input type="file" id="concern-files" multiple accept=".png,.jpg,.jpeg,.pdf,.doc,.docx" style="display:none" onchange="handleConcernFilesSelected(event)">
      <div id="concern-files-list" style="margin-top:8px;font-size:13px;"><span style="color:var(--n400);">No files selected</span></div>
    </div>
    <div style="display:flex;gap:10px;"><button class="btn btn-primary" onclick="submitConcern()">Submit Concern</button><button class="btn" onclick="showPage('s-dash')">Cancel</button></div>
  </div></div></div>`;
}

function renderMyTickets() {
  const my = getCurrentStudentTickets();
  return `<div><div class="page-hdr"><div><div class="page-title">My Tickets</div><div class="page-sub">${my.length} concern(s) submitted</div></div></div>
  <div class="card">${buildFilterBar('s-tickets', false, false)}<div id="tbl-container">${filterTbl(my, false, false)}</div></div></div>`;
}

function renderNotifs() {
  const notifs = getStudentNotifications(currentUser);
  const unreadCount = notifs.filter((n) => !n.read).length;

  const relTime = (raw) => {
    const ts = getNotificationTimestamp(raw);
    if (!ts) return 'Recently';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  const listHtml = notifs.length
    ? notifs.map((n) => `<div class="notif-item"><div class="notif-dot ${n.read ? 'read' : 'unread'}"></div><div style="flex:1;"><div class="notif-title" style="${!n.read ? 'color:var(--cg-dark);' : ''}">${n.title}</div><div class="notif-body">${n.body}</div><div class="notif-time">${relTime(n.time)}</div></div></div>`).join('')
    : `<div style="padding:20px 0;text-align:center;color:var(--n400);font-size:13px;">No notifications yet.</div>`;

  return `<div><div class="page-hdr"><div><div class="page-title">Notifications</div><div class="page-sub">${unreadCount} unread</div></div>${unreadCount ? `<button class="btn btn-sm" onclick="markStudentNotificationsAsRead()">Mark all read</button>` : ''}</div>
  <div class="card">${listHtml}</div></div>`;
}

function markStudentNotificationsAsRead() {
  markAllStudentNotificationsRead(currentUser);
  buildSidebar();
  showPage('s-notifs');
}

function renderStaffNotifs(label) {
  const notifs = getStaffAnnouncementNotifications(currentUser);
  const unreadCount = notifs.filter((n) => !n.read).length;

  const relTime = (raw) => {
    const ts = getNotificationTimestamp(raw);
    if (!ts) return 'Recently';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  const listHtml = notifs.length
    ? notifs.map((n) => `<div class="notif-item"><div class="notif-dot ${n.read ? 'read' : 'unread'}"></div><div style="flex:1;"><div class="notif-title" style="${!n.read ? 'color:var(--cg-dark);' : ''}">${n.title}</div><div class="notif-body">${n.body}</div><div class="notif-time">${relTime(n.time)}</div></div></div>`).join('')
    : `<div style="padding:20px 0;text-align:center;color:var(--n400);font-size:13px;">No notifications yet.</div>`;

  return `<div><div class="page-hdr"><div><div class="page-title">Notifications</div><div class="page-sub">${label} · ${unreadCount} unread</div></div>${unreadCount ? `<button class="btn btn-sm" onclick="markStaffNotificationsAsRead()">Mark all read</button>` : ''}</div>
  <div class="card">${listHtml}</div></div>`;
}

function markStaffNotificationsAsRead() {
  markAllStaffNotificationsRead(currentUser);
  buildSidebar();
  if (currentRole === 'accounting') {
    showPage('a-notifs');
    return;
  }
  if (currentRole === 'registrar') {
    showPage('r-notifs');
  }
}

/* ── DEPT PAGES ── */
function renderAccDash() {
  return deptDash('Accounting Dashboard', 'Manage financial concerns — ' + TICKETS.filter((t) => t.dept === 'Accounting' && t.status === 'Pending').length + ' pending', TICKETS.filter((t) => t.dept === 'Accounting'), 'a-notifs');
}

function renderRegDash() {
  return deptDash('Registrar Dashboard', 'Manage academic record concerns — ' + TICKETS.filter((t) => t.dept === 'Registrar' && t.status === 'Pending').length + ' pending', TICKETS.filter((t) => t.dept === 'Registrar'), 'r-notifs');
}

function deptDash(title, sub, tickets, notifsPageId = '') {
  const [p, ip, r] = [tickets.filter((t) => t.status === 'Pending').length, tickets.filter((t) => t.status === 'In Progress').length, tickets.filter((t) => t.status === 'Resolved').length];
  const unread = typeof countUnreadStaffNotifications === 'function' ? countUnreadStaffNotifications(currentUser) : 0;
  const notifBtn = notifsPageId
    ? `<button class="btn btn-sm" onclick="showPage('${notifsPageId}')">${IC.bell} Notifications${unread > 0 ? ` (${unread})` : ''}</button>`
    : '';
  return `<div><div class="page-hdr"><div><div class="page-title">${title}</div><div class="page-sub">${sub}</div></div><div>${notifBtn}</div></div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.list}</div><div class="stat-label">Total Tickets</div><div class="stat-val">${tickets.length}</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:#f59e0b;"></div><div class="stat-icon" style="background:#fffbeb;color:#f59e0b;">${IC.bell}</div><div class="stat-label">Pending</div><div class="stat-val" style="color:#92600a;">${p}</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:var(--blue);"></div><div class="stat-icon" style="background:var(--blue-bg);color:var(--blue);">${IC.chart}</div><div class="stat-label">In Progress</div><div class="stat-val" style="color:var(--blue);">${ip}</div></div>
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.check}</div><div class="stat-label">Resolved</div><div class="stat-val" style="color:var(--cg-dark);">${r}</div></div>
  </div>
  <div class="card"><div class="card-hdr"><div class="card-title">All Tickets <span style="font-size:11px;color:var(--n400);font-weight:400;margin-left:4px;">(${tickets.length} total)</span></div></div>
  ${tickets.length === 0 ? `<div class="empty-state">${IC.list}<p>No tickets yet</p></div>` : tbl(tickets, true, true)}</div></div>`;
}

function renderAccConcerns() {
  const my = TICKETS.filter((t) => t.dept === 'Accounting');
  const newCount = my.filter((t) => t.status === 'Pending').length;
  return `<div><div class="page-hdr"><div><div class="page-title">Financial Concerns</div><div class="page-sub">${my.length} total · <span style="color:#92600a;font-weight:700;">${newCount} pending</span></div></div></div>
  <div style="margin-bottom:12px;">${['Tuition payment', 'Balance inquiries', 'Refund requests', 'Payment verification'].map((c) => `<span class="chip">${c}</span>`).join('')}</div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;background:var(--cg-pale);border:1px solid var(--cg-pale2);border-radius:var(--radius);">
      <span style="color:var(--cg-dark);">${IC.graduation}</span>
      <span style="font-size:12px;color:var(--cg-dark);font-weight:600;">Student course and year level are shown in the <strong>Course & Year</strong> column below.</span>
    </div>
    ${buildFilterBar('a-concerns', true, true)}<div id="tbl-container">${filterTbl(my, true, true)}</div>
  </div></div>`;
}

function renderRegConcerns() {
  const my = TICKETS.filter((t) => t.dept === 'Registrar');
  const newCount = my.filter((t) => t.status === 'Pending').length;
  return `<div><div class="page-hdr"><div><div class="page-title">Academic Concerns</div><div class="page-sub">${my.length} total · <span style="color:#92600a;font-weight:700;">${newCount} pending</span></div></div></div>
  <div style="margin-bottom:12px;">${['Enrollment issues', 'TOR requests', 'Certificate requests', 'Grade concerns'].map((c) => `<span class="chip">${c}</span>`).join('')}</div>
  <div class="card">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:10px 14px;background:var(--cg-pale);border:1px solid var(--cg-pale2);border-radius:var(--radius);">
      <span style="color:var(--cg-dark);">${IC.graduation}</span>
      <span style="font-size:12px;color:var(--cg-dark);font-weight:600;">Student course and year level are shown in the <strong>Course & Year</strong> column below.</span>
    </div>
    ${buildFilterBar('r-concerns', true, true)}<div id="tbl-container">${filterTbl(my, true, true)}</div>
  </div></div>`;
}

function renderReports(dept) {
  const deptTickets = TICKETS.filter((t) => t.dept === dept);
  const monthKey = new Date().toISOString().slice(0, 7);
  const totalThisMonth = deptTickets.filter((t) => String(t.date || '').slice(0, 7) === monthKey).length;
  const resolvedCount = deptTickets.filter((t) => t.status === 'Resolved').length;
  const pendingCount = deptTickets.filter((t) => t.status === 'Pending').length;
  const inProgressCount = deptTickets.filter((t) => t.status === 'In Progress').length;

  const categoryCounts = {};
  deptTickets.forEach((t) => {
    const key = String(t.category || 'Uncategorized').trim() || 'Uncategorized';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  });

  const bars = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const maxBar = bars.length ? Math.max(...bars.map(([, v]) => v)) : 1;
  const totalTickets = deptTickets.length;
  return `<div><div class="page-hdr"><div><div class="page-title">${dept} Reports</div><div class="page-sub">Performance overview</div></div></div>
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.list}</div><div class="stat-label">Total This Month</div><div class="stat-val">${totalThisMonth}</div></div>
    <div class="stat-card"><div class="stat-top-bar"></div><div class="stat-icon" style="background:var(--cg-pale);color:var(--cg);">${IC.check}</div><div class="stat-label">Resolved</div><div class="stat-val" style="color:var(--cg-dark);">${resolvedCount}</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:var(--blue);"></div><div class="stat-icon" style="background:var(--blue-bg);color:var(--blue);">${IC.chart}</div><div class="stat-label">Pending</div><div class="stat-val" style="color:var(--blue);">${pendingCount}</div></div>
    <div class="stat-card"><div class="stat-top-bar" style="background:var(--gold);"></div><div class="stat-icon" style="background:var(--gold-bg);color:var(--gold);">${IC.bell}</div><div class="stat-label">Total Tickets</div><div class="stat-val">${totalTickets}</div></div>
  </div>
  <div class="two-col-wide">
    <div class="card"><div class="card-title">Volume by category</div>${bars.length ? bars.map(([l, v]) => `<div class="rep-row"><div class="rep-label">${l}</div><div style="flex:1;"><div class="prog-bar"><div class="prog-fill" style="width:${Math.max(8, Math.round((v / maxBar) * 100))}%;"></div></div></div><div class="rep-count">${v}</div></div>`).join('') : `<div class="empty-state">${IC.list}<p>No ticket data yet</p></div>`}</div>
    <div class="card"><div class="card-title">Status breakdown</div>${[['Pending', pendingCount, 'badge-pending'], ['In Progress', inProgressCount, 'badge-progress'], ['Resolved', resolvedCount, 'badge-resolved']].map(([s, v, c]) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--n100);"><span class="badge ${c}">${s}</span><span style="font-size:22px;font-weight:800;color:var(--n700);">${v}</span></div>`).join('')}</div>
  </div></div>`;
}
