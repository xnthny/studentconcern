// Helper functions and utilities

function badge(s) {
  const m = {
    Pending: 'badge-pending',
    'In Progress': 'badge-progress',
    Resolved: 'badge-resolved',
    Rejected: 'badge-rejected'
  };
  return `<span class="badge ${m[s] || 'badge-pending'}">${s}</span>`;
}

function isCurrentStudentTicket(t) {
  if (!t || !currentUser) return false;
  const ids = [currentUser.student_id, currentUser.id]
    .filter(Boolean)
    .map((v) => String(v).trim());
  const ownerIds = [t.studentId, t.student_id]
    .filter(Boolean)
    .map((v) => String(v).trim());
  if (ids.length && ownerIds.some((oid) => ids.includes(oid))) {
    return true;
  }
  return String(t.student || '').trim().toLowerCase() === String(currentUser.name || '').trim().toLowerCase();
}

function getCurrentStudentTickets() {
  return TICKETS.filter((t) => isCurrentStudentTicket(t));
}

function abbrevCourse(course) {
  if (!course) return '—';
  const map = {
    'BS Computer Science': 'BS CS',
    'BS Criminology': 'BS Crim',
    'BSED': 'BSED',
    'CBA': 'CBA',
    'Electrical Engineering': 'BSEE',
    'Mechanical Engineering': 'BSME',
    'COED': 'COED',
    'Hospital Management': 'Hosp. Mgt',
    'Tourism Management': 'Tourism Mgt'
  };
  return map[course] || course;
}

function getTicketStudentInfo(ticket) {
  if (!ticket) return { course: '', year: '' };

  // Prefer explicit values saved on the ticket itself.
  const directCourse = String(ticket.course || ticket.studentCourse || '').trim();
  const directYear = String(ticket.year || ticket.studentYear || '').trim();
  if (directCourse || directYear) {
    return { course: directCourse, year: directYear };
  }

  // Fallback to legacy name-based lookup.
  const byName = getStudentInfo(ticket.student);
  if (byName?.course || byName?.year) {
    return { course: byName.course || '', year: byName.year || '' };
  }

  const idCandidates = [ticket.studentId, ticket.student_id, ticket.studentUsername, ticket.studentUname, ticket.student_uname]
    .filter(Boolean)
    .map((v) => String(v).trim());
  const normalizedStudentName = String(ticket.student || '').trim().toLowerCase();

  const user = USERS.find((u) => {
    const byId = idCandidates.includes(String(u?.id || '').trim());
    const byUname = idCandidates.includes(String(u?.uname || '').trim().toLowerCase());
    const byNameMatch = String(u?.name || '').trim().toLowerCase() === normalizedStudentName;
    return byId || byNameMatch;
  });
  if (user?.course || user?.year) {
    return { course: user.course || '', year: user.year || '' };
  }

  const account = Object.entries(ACCOUNTS || {}).find(([key, acc]) => {
    const accId = String(acc?.id || '').trim();
    const accKey = String(key || '').trim().toLowerCase();
    const accName = String(acc?.name || '').trim().toLowerCase();
    const byId = idCandidates.includes(accId);
    const byKey = idCandidates.includes(accKey);
    const byName = !!normalizedStudentName && accName === normalizedStudentName;
    return byId || byKey || byName;
  });
  if (account && account[1] && (account[1].course || account[1].year)) {
    return { course: account[1].course || '', year: account[1].year || '' };
  }

  return { course: '', year: '' };
}

function deptPill(ticket) {
  const info = getTicketStudentInfo(ticket);
  if (!info.course) return `<span style="color:var(--n300);font-size:11px;">—</span>`;
  const short = abbrevCourse(info.course);
  return `<div style="display:flex;flex-direction:column;gap:2px;">
    <span style="font-size:11.5px;font-weight:700;color:var(--n700);">${short}</span>
    <span style="font-size:10.5px;color:var(--n400);">${info.year || ''}</span>
  </div>`;
}

function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : '') + msg;
  t.className = 'show ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  setTimeout(() => (t.className = ''), 2800);
}

function showToast(m, t) {
  toast(m, t);
}

function openModal(title, sub, body, footer) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sub').textContent = sub || '';
  document.getElementById('modal-body').innerHTML = body || '';
  document.getElementById('modal-footer').innerHTML = footer || `<button class="btn" onclick="closeModalNow()">Close</button>`;
  document.getElementById('modal').classList.add('open');
}

function closeModal(e) {
  if (e.target === document.getElementById('modal')) closeModalNow();
}

function closeModalNow() {
  document.getElementById('modal').classList.remove('open');
}

function togglePw(id) {
  const i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
}

function tbl(tickets, showStu = true, showDeptInfo = false) {
  if (!tickets.length) return `<div class="empty-state">${IC.list}<p>No tickets found</p></div>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    <th>Ticket #</th>
    ${showStu ? '<th>Student</th>' : ''}
    ${showDeptInfo ? '<th>Course & Year</th>' : ''}
    <th>Category</th>
    <th>Subject</th>
    <th>Status</th>
    <th>Date</th>
    <th></th>
  </tr></thead><tbody>
  ${tickets
    .map((t) => {
      return `<tr>
      <td><span style="font-weight:800;color:var(--cg-dark);font-size:12px;">${t.id}</span></td>
      ${showStu ? `<td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--cg-pale);color:var(--cg-dark);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0;">${t.student.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div>
          <span style="font-weight:600;">${t.student}</span>
        </div>
      </td>` : ''}
      ${showDeptInfo ? `<td>${deptPill(t)}</td>` : ''}
      <td style="color:var(--n500);">${t.category}</td>
      <td style="max-width:170px;"><span style="font-weight:500;">${t.subject}</span></td>
      <td>${badge(t.status)}</td>
      <td style="color:var(--n300);font-size:11px;">${t.date.slice(5)}</td>
      <td><div style="display:flex;gap:6px;justify-content:flex-end;"><button class="btn btn-sm btn-primary" onclick="openTicket('${t.id}')">Open</button>${!showStu && currentPageId === 's-tickets' ? `<button class="btn btn-sm btn-danger" onclick="confirmDeleteMyTicket('${t.id}')">${IC.trash} Delete</button>` : ''}${showStu && currentRole === 'accounting' && (currentPageId === 'a-concerns' || currentPageId === 'a-dash') ? `<button class="btn btn-sm btn-danger" onclick="confirmDeleteAccountingConcern('${t.id}')">Delete</button>` : ''}</div></td>
    </tr>`;
    })
    .join('')}</tbody></table></div>`;
}

function filterTbl(all, showStu, showDeptInfo = false) {
  let f = all;
  if (activeFilter !== 'All') f = f.filter((t) => t.status === activeFilter);
  if (searchQuery) f = f.filter((t) => (t.subject + t.student + t.category + t.id).toLowerCase().includes(searchQuery.toLowerCase()));
  return tbl(f, showStu, showDeptInfo);
}

function buildFilterBar(pid, showStu, showDeptInfo = false) {
  return `<div class="filter-bar">${['All', 'Pending', 'In Progress', 'Resolved']
    .map((s) => `<button class="filter-btn${activeFilter === s ? ' active' : ''}" onclick="setFilter('${s}','${pid}',${showStu},${showDeptInfo})">${s}</button>`)
    .join('')}<input class="search-input" placeholder="Search…" oninput="setSearch(this.value,'${pid}',${showStu},${showDeptInfo})"/></div>`;
}

function setFilter(f, pid, sh, sd) {
  activeFilter = f;
  searchQuery = '';
  showPage(pid);
}

function setSearch(q, pid, sh, sd) {
  searchQuery = q;
  const el = document.getElementById('tbl-container');
  if (!el) return;
  const dept = pid === 'a-concerns' ? 'Accounting' : pid === 'r-concerns' ? 'Registrar' : null;
  let data = dept ? TICKETS.filter((t) => t.dept === dept) : pid === 'ad-tickets' ? TICKETS : getCurrentStudentTickets();
  if (activeFilter !== 'All') data = data.filter((t) => t.status === activeFilter);
  if (q) data = data.filter((t) => (t.subject + t.student + t.category + t.id).toLowerCase().includes(q.toLowerCase()));
  el.innerHTML = tbl(data, sh !== false && sh !== 'false', sd === true || sd === 'true');
}
