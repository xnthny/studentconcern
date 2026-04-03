// Tickets module

function openTicket(id) {
  const t = TICKETS.find((x) => x.id === id);
  if (!t) return;
  const isStaff = currentRole !== 'student',
    isRes = t.status === 'Resolved';
  const canReply = !isRes && (currentRole === 'student' || currentRole === 'accounting' || currentRole === 'registrar');
  const canDeleteAccountingConcern = currentRole === 'accounting' && t.dept === 'Accounting';
  const sInfo = typeof getTicketStudentInfo === 'function' ? getTicketStudentInfo(t) : getStudentInfo(t.student);
  document.getElementById('main').innerHTML = `<div>
  <button class="back-btn" onclick="showPage('${currentPageId}')">${IC.arrow} Back to list</button>
  <div class="page-hdr"><div><div class="page-title">${t.subject}</div><div class="page-sub" style="display:flex;align-items:center;gap:8px;margin-top:4px;"><span style="font-weight:700;color:var(--cg-dark);">${t.id}</span><span style="color:var(--n300);">·</span><span>${t.dept}</span><span style="color:var(--n300);">·</span><span>${t.category}</span></div></div><div style="display:flex;align-items:center;gap:8px;">${badge(t.status)}</div></div>
  <div class="two-col">
    <div>
      <div class="card"><div class="card-title">Conversation Thread</div><div class="thread" id="thread-body">${renderThread(t)}</div>${canReply ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--n100);"><div style="font-size:14px;font-weight:700;color:var(--n700);margin-bottom:10px;">Send a Reply</div><textarea class="fi" id="reply-txt" rows="3" style="margin-bottom:10px;" placeholder="Type your message…"></textarea><input type="file" id="reply-file" style="display:none;" onchange="handleReplyFileUpload(event,'${t.id}')"/><div style="display:flex;gap:8px;"><button class="btn btn-primary" onclick="sendReply('${t.id}')"><span style="display:inline-flex;width:16px;height:16px;">${IC.send}</span> Send Reply</button><button class="btn" onclick="openReplyFilePicker()">Attach File</button></div></div>` : ''}</div>
      ${isRes && currentRole === 'student' ? `<div class="card"><div class="card-title">Rate this Service</div><div class="stars" id="stars-row">${[1, 2, 3, 4, 5].map((i) => `<span class="star" data-v="${i}" onclick="rateStar(${i})">★</span>`).join('')}</div><div style="font-size:11px;color:var(--n300);margin-top:8px;" id="rate-lbl">Click a star to rate</div><textarea class="fi" rows="2" style="margin:12px 0;" placeholder="Optional comment…"></textarea><button class="btn btn-primary btn-sm" onclick="toast('Thank you for your feedback!')">Submit Rating</button></div>` : ''}
    </div>
    <div>
      <div class="card"><div class="card-title">Ticket Information</div><table class="info-tbl">${[
        ['Ticket #', `<span style="font-weight:800;color:var(--cg-dark);">${t.id}</span>`],
        ['Status', badge(t.status)],
        ['Department', t.dept],
        ['Category', t.category],
        ['Submitted by', t.student],
        ...(isStaff && sInfo.course ? [['Course', sInfo.course], ['Year Level', sInfo.year || '—']] : isStaff ? [['Course', '—']] : []),
        ['Date Filed', t.date]
      ]
        .map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`)
        .join('')}</table>${!isStaff ? `<div style="margin-top:12px;"><button class="btn btn-danger btn-sm" onclick="confirmDeleteMyTicket('${t.id}')">Delete Ticket</button></div>` : ''}</div>
      ${isStaff ? `<div class="card"><div class="card-title">Update Status</div><select class="status-sel" id="status-upd">${['Pending', 'In Progress', 'Resolved'].map((s) => `<option${s === t.status ? ' selected' : ''}>${s}</option>`).join('')}</select><textarea class="fi" rows="2" style="margin-bottom:10px;" id="status-note" placeholder="Staff note (optional)…"></textarea><button class="btn btn-primary" style="width:100%;" onclick="updateTicketStatus('${t.id}')">Update Status</button>${canDeleteAccountingConcern ? `<button class="btn btn-danger" style="width:100%;margin-top:8px;" onclick="confirmDeleteAccountingConcern('${t.id}')">Delete Concern</button>` : ''}</div>` : ''}
    </div>
  </div></div>`;
}

function confirmDeleteAccountingConcern(id) {
  if (currentRole !== 'accounting') return;
  const t = TICKETS.find((x) => x.id === id && x.dept === 'Accounting');
  if (!t) return;

  openModal(
    'Delete Concern',
    `Delete ticket ${t.id}?`,
    '<div style="padding:6px 0;color:#b91c1c;font-size:13px;line-height:1.6;">This will permanently remove this concern from Accounting records.</div>',
    `<button class="btn" onclick="closeModalNow()">Cancel</button><button class="btn btn-danger" onclick="deleteAccountingConcern('${t.id}')">Delete</button>`
  );
}

function deleteAccountingConcern(id) {
  if (currentRole !== 'accounting') return;

  const before = TICKETS.length;
  TICKETS = TICKETS.filter((t) => !(t.id === id && t.dept === 'Accounting'));
  if (TICKETS.length === before) {
    closeModalNow();
    toast('Concern not found', 'error');
    return;
  }

  // Persist this deleted concern id so it will stay deleted after refresh/sign-out.
  try {
    const raw = localStorage.getItem('deletedConcernIds');
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? list : [];
    if (!next.includes(String(id))) {
      next.push(String(id));
    }
    localStorage.setItem('deletedConcernIds', JSON.stringify(next));
  } catch (e) {}

  saveTickets();
  closeModalNow();
  toast('Concern deleted');
  showPage('a-concerns');
}

function confirmDeleteMyTicket(id) {
  const ticket = TICKETS.find((x) => x.id === id);
  if (!ticket || currentRole !== 'student') return;

  openModal(
    'Delete Ticket',
    `Are you sure you want to delete ticket ${ticket.id}?`,
    '<div style="padding:6px 0;color:#b91c1c;font-size:13px;line-height:1.6;">This will permanently remove this concern from your ticket list.</div>',
    `<button class="btn" onclick="closeModalNow()">Cancel</button><button class="btn btn-danger" onclick="deleteMyTicket('${ticket.id}')">Delete</button>`
  );
}

function deleteMyTicket(id) {
  if (currentRole !== 'student') return;

  const beforeCount = TICKETS.length;
    TICKETS = TICKETS.filter((ticket) => !(ticket.id === id && isCurrentStudentTicket(ticket)));

  if (TICKETS.length === beforeCount) {
    closeModalNow();
    toast('Ticket not found', 'error');
    return;
  }

  saveTickets();
  closeModalNow();
  toast('Ticket deleted');
  showPage('s-tickets');
}

function renderThread(t) {
  const sti = t.student.split(' ').map((n) => n[0]).join('').slice(0, 2);
  const ownFrom = currentRole === 'student' ? 'student' : 'staff';

  // Precompute profile photos for thread avatars
  const studentUser = Array.isArray(USERS) ? USERS.find((u) => u.name === t.student) : null;
  const studentPhoto = studentUser && profilePhotos[studentUser.id] ? profilePhotos[studentUser.id] : null;
  const staffPhotoByRole = {};
  // Check ACCOUNTS first (registrar, accounting are stored here)
  Object.values(ACCOUNTS || {}).forEach((acc) => {
    if (acc.role && acc.role !== 'student' && acc.role !== 'admin' && !staffPhotoByRole[acc.role] && profilePhotos[acc.id]) {
      staffPhotoByRole[acc.role] = profilePhotos[acc.id];
    }
  });
  // Also check USERS for any dynamically added staff
  if (Array.isArray(USERS)) {
    USERS.forEach((u) => {
      if (u.role && u.role !== 'student' && u.role !== 'admin' && !staffPhotoByRole[u.role] && profilePhotos[u.id]) {
        staffPhotoByRole[u.role] = profilePhotos[u.id];
      }
    });
  }

  const formatThreadStamp = (raw) => {
    const v = String(raw || '').trim();
    if (!v) return '';

    let dt = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      dt = new Date(`${v}T00:00:00`);
    } else {
      dt = new Date(v);
    }

    if (Number.isNaN(dt?.getTime?.())) {
      return '';
    }

    return dt.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(',', ' ·');
  };

  const timeline = [{ from: 'student', date: t.date, text: t.details }, ...(Array.isArray(t.replies) ? t.replies : [])]
    .filter((m) => m && m.text);

  const attachmentPool = Array.isArray(t.attachments) ? t.attachments : [];
  const attachmentBuckets = {};
  attachmentPool.forEach((att) => {
    const key = String(att?.name || '').trim();
    if (!key) return;
    if (!Array.isArray(attachmentBuckets[key])) {
      attachmentBuckets[key] = [];
    }
    attachmentBuckets[key].push(att);
  });

  const withResolvedAttachment = (msg) => {
    if (msg && msg.attachment) {
      return msg;
    }

    const text = String(msg?.text || '').trim();
    const m = text.match(/^Attached file:\s*(.+)$/i);
    if (!m) {
      return msg;
    }

    const fileName = String(m[1] || '').trim();
    if (!fileName || !Array.isArray(attachmentBuckets[fileName]) || !attachmentBuckets[fileName].length) {
      return msg;
    }

    // Use and remove one matching attachment so repeated filenames map in order.
    const matchedAtt = attachmentBuckets[fileName].shift();
    return { ...msg, attachment: matchedAtt };
  };

  const renderMsg = (msg) => {
    const from = msg.from === 'staff' ? 'staff' : 'student';
    const date = msg.date;
    const text = String(msg.text || '').trim();
    const senderRole = String(msg.senderRole || '').toLowerCase();
    const isOwn = senderRole ? senderRole === currentRole : from === ownFrom;
    const rowClass = isOwn ? 'msg-row staff' : 'msg-row';
    const metaAlign = isOwn ? 'text-align:right;' : '';
    const metaLabel = from === 'staff' ? `${t.dept} Staff` : t.student;
    const stamp = formatThreadStamp(date);
    const metaText = stamp ? `${metaLabel} · ${stamp}` : metaLabel;
    // Resolve profile photo for this message's sender
    let _senderPhoto = null;
    if (from === 'student') {
      _senderPhoto = studentPhoto;
    } else {
      const _sid = msg.senderId;
      if (_sid && profilePhotos[_sid]) {
        _senderPhoto = profilePhotos[_sid];
      } else if (senderRole && staffPhotoByRole[senderRole]) {
        _senderPhoto = staffPhotoByRole[senderRole];
      } else {
        // Last resort: current user is viewing their own staff messages
        if (from === 'staff' && profilePhotos[currentUser.id]) {
          _senderPhoto = profilePhotos[currentUser.id];
        }
      }
    }
    const avatar = _senderPhoto
      ? `<div class="msg-av" style="background-image:url(${_senderPhoto});background-size:cover;background-position:center;"></div>`
      : from === 'staff'
        ? `<div class="msg-av" style="background:var(--cg);color:#fff;">ST</div>`
        : `<div class="msg-av" style="background:var(--cg-pale);color:var(--cg-dark);">${sti}</div>`;
    const att = msg && msg.attachment && typeof msg.attachment === 'object' ? msg.attachment : null;
    const hasImageAttachment = !!(att && att.previewDataUrl && String(att.previewDataUrl).startsWith('data:image/'));
    const bubbleBase = from === 'staff' ? 'bubble bubble-staff' : 'bubble bubble-student';
    const bubbleClass = hasImageAttachment ? 'bubble bubble-img-only' : bubbleBase;

    let bodyHtml = '';
    // For image uploads, keep the chat bubble clean: image only.
    if (text && !hasImageAttachment) {
      bodyHtml += `<div>${text}</div>`;
    }

    if (att) {
      const attName = String(att.name || 'Attached file');
      const attSize = Number(att.size || 0);
      const attType = String(att.type || '');

      bodyHtml += `<div style="margin-top:${text && !hasImageAttachment ? '8px' : '0'};">`;
      if (hasImageAttachment) {
        bodyHtml += `<img src="${att.previewDataUrl}" alt="${attName}" style="display:block;max-width:260px;max-height:180px;border-radius:10px;object-fit:contain;"/>"`;
      } else {
        bodyHtml += `<div style="margin-top:6px;font-size:11px;opacity:.9;word-break:break-word;">${attName}${attSize ? ` · ${(attSize / 1024).toFixed(1)} KB` : ''}${attType ? ` · ${attType}` : ''}</div>`;
      }
      bodyHtml += `</div>`;
    }

    return `<div class="${rowClass}">${avatar}<div><div style="font-size:10.5px;color:var(--n300);margin-bottom:4px;font-weight:600;${metaAlign}">${metaText}</div><div class="${bubbleClass}">${bodyHtml}</div></div></div>`;
  };

  let h = '';
  timeline.forEach((m) => {
    h += renderMsg(withResolvedAttachment(m));
  });
  return h;
}

function sendReply(id) {
  const txt = document.getElementById('reply-txt')?.value?.trim();
  if (!txt) {
    toast('Please type a message', 'error');
    return;
  }
  const t = TICKETS.find((x) => x.id === id);
  if (!t) return;
  t.replies.push({ from: currentRole === 'student' ? 'student' : 'staff', senderRole: currentRole, senderId: currentUser.id, text: txt, date: new Date().toISOString() });
  saveTickets();
  document.getElementById('thread-body').innerHTML = renderThread(t);
  document.getElementById('reply-txt').value = '';
  toast('Reply sent!');
}

function openReplyFilePicker() {
  const fileInput = document.getElementById('reply-file');
  if (fileInput) {
    fileInput.click();
  }
}

function handleReplyFileUpload(event, id) {
  const file = event?.target?.files?.[0];
  if (!file) {
    return;
  }

  // 5MB max for in-browser localStorage persistence.
  if (file.size > 5 * 1024 * 1024) {
    toast('File too large. Max 5MB.', 'error');
    event.target.value = '';
    return;
  }

  const t = TICKETS.find((x) => x.id === id);
  if (!t) {
    toast('Ticket not found', 'error');
    event.target.value = '';
    return;
  }

  if (!Array.isArray(t.attachments)) {
    t.attachments = [];
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = typeof e?.target?.result === 'string' ? e.target.result : '';
    const isImage = String(file.type || '').startsWith('image/');

    const attachment = {
      name: file.name,
      size: file.size,
      type: file.type || '',
      previewDataUrl: isImage ? dataUrl : ''
    };

    t.attachments.push(attachment);

    t.replies.push({
      from: currentRole === 'student' ? 'student' : 'staff',
      senderRole: currentRole,
      senderId: currentUser.id,
      text: isImage ? 'Sent an image' : 'Sent a file',
      attachment,
      date: new Date().toISOString()
    });

    saveTickets();
    openTicket(id);
    toast('File attached');
  };

  reader.onerror = function () {
    toast('Failed to read file', 'error');
  };

  reader.readAsDataURL(file);
  event.target.value = '';
}

function updateTicketStatus(id) {
  const t = TICKETS.find((x) => x.id === id);
  if (!t) return;
  const nextStatus = document.getElementById('status-upd').value;
  if (t.status !== nextStatus) {
    t.statusUpdatedAt = new Date().toISOString();
  }
  t.status = nextStatus;
  const note = document.getElementById('status-note').value.trim();
  if (note) t.replies.push({ from: 'staff', senderRole: currentRole, text: note, date: new Date().toISOString() });
  saveTickets();
  toast(`Status updated to "${t.status}"`);
  openTicket(id);
}

function rateStar(v) {
  const L = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  document.querySelectorAll('.star').forEach((s) => s.classList.toggle('lit', +s.dataset.v <= v));
  const l = document.getElementById('rate-lbl');
  if (l) l.textContent = `${L[v]} — ${v}/5 stars`;
}
