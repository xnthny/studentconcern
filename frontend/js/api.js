// API module - API calls and form handlers

var pendingConcernFiles = [];

function triggerConcernFilePicker() {
  var el = document.getElementById('concern-files');
  if (el) el.click();
}

function formatConcernFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function isConcernImageType(type) {
  return type === 'image/png' || type === 'image/jpeg';
}

function readFileAsDataUrl(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      resolve(reader.result);
    };
    reader.onerror = function() {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

function renderConcernSelectedFiles() {
  var el = document.getElementById('concern-files-list');
  if (!el) return;
  if (pendingConcernFiles.length === 0) {
    el.innerHTML = '<span style="color:var(--n400);">No files selected</span>';
    return;
  }
  el.innerHTML = pendingConcernFiles.map(function(f, i) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--n100);">' +
      '<span style="flex:1;font-size:13px;color:var(--n600);">' + f.name + '</span>' +
      '<span style="font-size:11px;color:var(--n400);">' + formatConcernFileSize(f.size) + '</span>' +
      '<button onclick="removeConcernSelectedFile(' + i + ')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:18px;line-height:1;padding:0 4px;">&times;</button>' +
      '</div>';
  }).join('');
}

async function handleConcernFilesSelected(event) {
  var allowed = ['image/png', 'image/jpeg', 'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  var maxSize = 10 * 1024 * 1024;
  var maxPreviewImageSize = 2 * 1024 * 1024;
  var files = Array.from(event.target.files || []);
  var errors = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (!allowed.includes(f.type)) { errors.push(f.name + ': unsupported type'); continue; }
    if (f.size > maxSize) { errors.push(f.name + ': exceeds 10 MB'); continue; }

    var attachment = {
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedAt: new Date().toISOString()
    };

    if (isConcernImageType(f.type) && f.size <= maxPreviewImageSize) {
      try {
        attachment.previewDataUrl = await readFileAsDataUrl(f);
      } catch (e) {
        errors.push(f.name + ': image preview unavailable');
      }
    }

    if (isConcernImageType(f.type) && f.size > maxPreviewImageSize) {
      errors.push(f.name + ': preview skipped (image is over 2 MB)');
    }

    pendingConcernFiles.push(attachment);
  }

  if (errors.length) toast(errors.join(' | '), 'error');
  event.target.value = '';
  renderConcernSelectedFiles();
}

function removeConcernSelectedFile(index) {
  pendingConcernFiles.splice(index, 1);
  renderConcernSelectedFiles();
}

function updateCats() {
  const dept = document.getElementById('dept-sel')?.value;
  const cats = {
    Accounting: ['Tuition payment issue', 'Balance inquiry', 'Refund request', 'Payment verification'],
    Registrar: ['Enrollment issue', 'Subject registration', 'TOR request', 'Certificate request', 'Grade concern'],
    Others: ['General concern', 'Technical issue', 'Student services concern']
  };
  const sel = document.getElementById('cat-sel');
  if (!sel) return;
  if (!cats[dept]) {
    sel.innerHTML = '<option value="">Select department first</option>';
    return;
  }
  sel.innerHTML = cats[dept].map((c) => `<option>${c}</option>`).join('');
}

function submitConcern() {
  const dept = document.getElementById('dept-sel')?.value,
    subj = document.getElementById('subj-inp')?.value?.trim(),
    detail = document.getElementById('detail-inp')?.value?.trim(),
    cat = document.getElementById('cat-sel')?.value;
  if (!dept) {
    toast('Please select a department', 'error');
    return;
  }
  if (!subj) {
    toast('Please enter a subject', 'error');
    return;
  }
  if (!detail) {
    toast('Please provide details', 'error');
    return;
  }

  // Create a safe unique ticket id (avoid deleted/reserved ids like TKT-903).
  const existingIds = new Set((Array.isArray(TICKETS) ? TICKETS : []).map((t) => String(t?.id || '').trim()));
  const deletedIds = new Set(typeof getDeletedConcernIds === 'function' ? getDeletedConcernIds() : []);
  let nextNum = 901;
  (Array.isArray(TICKETS) ? TICKETS : []).forEach((t) => {
    const m = String(t?.id || '').trim().match(/^TKT-(\d+)$/i);
    if (!m) return;
    const n = Number(m[1]);
    if (!Number.isNaN(n) && n >= nextNum) {
      nextNum = n + 1;
    }
  });
  let tid = `TKT-${String(nextNum).padStart(3, '0')}`;
  while (existingIds.has(tid) || deletedIds.has(tid)) {
    nextNum += 1;
    tid = `TKT-${String(nextNum).padStart(3, '0')}`;
  }
  var attachments = pendingConcernFiles.map(function(f) {
    return {
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedAt: f.uploadedAt,
      previewDataUrl: f.previewDataUrl || ''
    };
  });
  var studentId = currentUser.student_id || currentUser.id || '';
  var fallbackUser = (USERS || []).find(function(u) {
    var byId = String(u && u.id || '').trim() === String(studentId).trim();
    var byName = String(u && u.name || '').trim().toLowerCase() === String(currentUser.name || '').trim().toLowerCase();
    return byId || byName;
  }) || null;
  var fallbackAccount = Object.entries(ACCOUNTS || {}).find(function(entry) {
    var key = String(entry[0] || '').toLowerCase();
    var acc = entry[1] || {};
    var byId = String(acc.id || '').trim() === String(studentId).trim();
    var byName = String(acc.name || '').trim().toLowerCase() === String(currentUser.name || '').trim().toLowerCase();
    var byKey = String(studentId || '').trim().toLowerCase() === key;
    return byId || byName || byKey;
  });
  var fallbackAccData = fallbackAccount ? fallbackAccount[1] : null;

  const newTicket = {
    id: tid,
    student: currentUser.name,
    studentId: studentId,
    studentUsername: currentUser.username || currentUser.uname || '',
    course: currentUser.course || (fallbackUser && fallbackUser.course) || (fallbackAccData && fallbackAccData.course) || '',
    year: currentUser.year || currentUser.year_level || (fallbackUser && fallbackUser.year) || (fallbackAccData && fallbackAccData.year) || '',
    dept,
    category: cat || dept,
    subject: subj,
    details: detail,
    status: 'Pending',
    date: new Date().toISOString().slice(0, 10),
    replies: [],
    attachments: attachments
  };

  TICKETS.unshift(newTicket);
  saveTickets();
  pendingConcernFiles = [];

  // Also try backend API (optional)
  if (typeof apiSubmitTicket !== 'undefined') {
    apiSubmitTicket(dept, subj, detail, cat)
      .then((response) => {
        console.log('Ticket synced with backend');
      })
      .catch((error) => {
        console.log('Backend sync failed, using local storage:', error.message);
      });
  }

  document.getElementById('main').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;">
  <div class="card" style="max-width:480px;text-align:center;padding:48px 36px;width:100%;">
    <div class="success-icon"><span style="color:var(--cg);width:30px;height:30px;display:flex;">${IC.check}</span></div>
    <div style="font-size:22px;font-weight:800;color:var(--n800);margin-bottom:8px;">Concern Submitted!</div>
    <div style="font-size:13px;color:var(--n400);margin-bottom:28px;line-height:1.6;">Your concern has been received. Our team will review it within 1\u20133 business days.${attachments.length ? ' <strong>' + attachments.length + ' document(s) attached.</strong>' : ''}</div>
    <div class="tkt-num-box"><div style="font-size:10px;color:rgba(200,230,215,0.6);font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px;">Your Ticket Number</div><div style="font-size:36px;font-weight:900;color:#fff;letter-spacing:4px;">${tid}</div><div style="font-size:11px;color:rgba(200,230,215,0.5);margin-top:6px;">Save this to track your concern</div></div>
    <div style="display:flex;gap:10px;justify-content:center;"><button class="btn btn-primary" onclick="showPage('s-tickets')">View My Tickets</button><button class="btn" onclick="showPage('s-submit')">Submit Another</button></div>
  </div></div>`;
}
