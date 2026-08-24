const API = window.API_BASE || "";
let state = {
  token: localStorage.getItem("sdm_token") || null,
  user: JSON.parse(localStorage.getItem("sdm_user") || "null"),
  screen: "login",
  stages: [],
  docTypes: [],
  customers: [],
  activeCustomer: null,
  documents: [],
  timeline: [],
  pendingUpload: null,
};

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

async function api(path, opts = {}) {
  const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
  if (state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(API + path, Object.assign({}, opts, { headers }));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function initials(name) { return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2); }
function statusBadge(status) {
  const map = { completed: ["badge-green", "Completed"], "in-progress": ["badge-orange", "In Progress"], pending: ["badge-blue", "Pending"], rejected: ["badge-red", "Action Required"] };
  const [cls, label] = map[status] || ["badge-gray", "Not Started"];
  return `<span class="badge ${cls}">${label}</span>`;
}
function cellsHTML(step) {
  let out = "";
  for (let i = 1; i <= 10; i++) {
    let cls = "cell";
    if (i < step) cls += " done"; else if (i === step) cls += " current";
    out += `<div class="${cls}">${i}</div>`;
  }
  return out;
}

async function boot() {
  if (state.token) {
    try {
      state.user = await api("/api/me");
      state.stages = await api("/api/stages");
      state.docTypes = await api("/api/document-types");
      state.screen = "dashboard";
    } catch (e) {
      logout();
      return;
    }
  }
  render();
}

function logout() {
  localStorage.removeItem("sdm_token");
  localStorage.removeItem("sdm_user");
  state = Object.assign(state, { token: null, user: null, screen: "login" });
  render();
}

async function doLogin(mobile, password, errEl, name = "Staff") {
  errEl.textContent = "";
  mobile = String(mobile || "").trim();
  password = String(password || "");
  name = String(name || "Staff").trim() || "Staff";
  if (!/^\d{10}$/.test(mobile)) { errEl.textContent = "Please enter your 10-digit mobile number."; return; }
  if (password.length < 6) { errEl.textContent = "Please enter a password of at least 6 characters."; return; }

  try {
    const data = await api("/api/login", { method: "POST", body: JSON.stringify({ mobile, password, name }) });
    if (data.pending || data.requested) {
      errEl.textContent = data.message || "Account request sent. Admin approval ke baad login kar sakte ho.";
      return;
    }
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("sdm_token", data.token);
    localStorage.setItem("sdm_user", JSON.stringify(data.user));
    state.stages = await api("/api/stages");
    state.docTypes = await api("/api/document-types");
    goTo("dashboard");
  } catch (e) {
    // New staff do not need a separate registration screen. If this mobile
    // is not registered yet, create its pending access request automatically.
    try {
      const req = await fetch(API + "/api/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, password })
      });
      const data = await req.json().catch(() => ({}));
      if (req.ok) {
        errEl.textContent = data.message || "Account request sent. Admin approval ke baad login kar sakte ho.";
        return;
      }
      if (req.status === 409) {
        errEl.textContent = "Aapka account already active hai. Registered password use karke login karein.";
        return;
      }
    } catch (_) {}
    if (/pending admin approval|waiting for admin approval/i.test(e.message || "")) {
      errEl.textContent = "Aapka account admin approval ka wait kar raha hai.";
    } else {
      errEl.textContent = e.message || "Login nahi ho paya. Please try again.";
    }
  }
}

async function goTo(screen, custId) {
  state.screen = screen;
  state.pendingUpload = null;
  try {
    if (screen === "dashboard") {
      state.stats = await api("/api/stats");
      state.customers = await api("/api/customers");
    } else if (screen === "customers") {
      state.customers = await api("/api/customers");
    } else if (screen === "details" && custId) {
      state.activeCustomer = await api("/api/customers/" + custId);
    } else if (screen === "documents") {
      state.documents = await api("/api/customers/" + state.activeCustomer.id + "/documents");
    } else if (screen === "timeline") {
      state.timeline = await api("/api/customers/" + state.activeCustomer.id + "/timeline");
    }
  } catch (e) { toast(e.message); }
  render();
}

async function submitAddCustomer(form) {
  const body = {
    name: form.name.value.trim(), mobile: form.mobile.value.trim(), email: form.email.value.trim(),
    address: form.address.value.trim(), consumerNo: form.consumerNo.value.trim(),
    capacity: form.capacity.value.trim(), type: form.type.value,
  };
  if (!body.name || !body.mobile) { toast("Name and mobile are required"); return; }
  try {
    const c = await api("/api/customers", { method: "POST", body: JSON.stringify(body) });
    toast("Customer added");
    goTo("details", c.id);
  } catch (e) { toast(e.message); }
}

function pickFile(inputId) { document.getElementById(inputId).click(); }

function stageFileForUpload(fileInput) {
  const file = fileInput.files[0];
  if (!file || !state.activeCustomer) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.pendingUpload = { fileName: file.name, base64: reader.result.split(",")[1] };
    render();
  };
  reader.readAsDataURL(file);
}

async function confirmUpload(typeSelect, customTypeInput) {
  if (!state.pendingUpload) return;
  let type = typeSelect.value;
  if (type === "Other") type = (customTypeInput.value || "Other").trim();
  try {
    const doc = await api(`/api/customers/${state.activeCustomer.id}/documents`, {
      method: "POST",
      body: JSON.stringify({ fileName: state.pendingUpload.fileName, base64: state.pendingUpload.base64, type }),
    });
    toast(`Saved as: ${doc.type}`);
    state.pendingUpload = null;
    goTo("documents");
  } catch (e) { toast(e.message); }
}

function cancelUpload() { state.pendingUpload = null; render(); }

async function deleteDoc(docId) {
  if (!confirm("Delete this document?")) return;
  try {
    await api(`/api/documents/${docId}`, { method: "DELETE" });
    toast("Document deleted");
    goTo("documents");
  } catch (e) { toast(e.message); }
}

function custRow(c) {
  return `<div class="cust-row" onclick="goTo('details','${c.id}')">
    <div class="avatar" style="width:36px;height:36px;">${initials(c.name)}</div>
    <div class="meta"><div class="name">${c.name}</div><div class="sub">${c.capacity || "—"} · Step ${c.step}/10</div></div>
    ${statusBadge(c.status)}
  </div>`;
}

function docTypeOptions(selected) { return state.docTypes.map((t) => `<option value="${t}" ${t === selected ? "selected" : ""}>${t}</option>`).join(""); }
function backTargetFor(screen) { const map = { timeline: "details", documents: "details", add: "dashboard" }; return map[screen] || "dashboard"; }

function render() {
  const el = document.getElementById("app");
  if (state.screen === "login") {
    el.innerHTML = `
      <div class="login-screen">
        <div class="mark">☀️</div>
        <h2>Solar Doc Manager</h2>
        <p class="sub">Create your account with mobile & password. Admin approval is required before access.</p>
        <div class="field"><label>Name</label><input id="li-name" placeholder="Your name"></div>
        <div class="field"><label>Mobile Number</label><input id="li-mobile" inputmode="numeric" maxlength="10" placeholder="98XXXXXXXX"></div>
        <div class="field"><label>Password</label><input id="li-pass" type="password" placeholder="Create password (6+ characters)"></div>
        <div class="login-err" id="li-err"></div>
        <button class="btn btn-gold" style="width:100%;" onclick="doLogin(document.getElementById('li-mobile').value, document.getElementById('li-pass').value, document.getElementById('li-err'), document.getElementById('li-name').value)">Login / Request Access</button>
        <div class="demo-hint">New number = account/request automatically created. Admin approval ke baad same mobile + password se login hoga.</div>
      </div>`;
    return;
  }

  let body = "";
  const showNav = true;
  if (state.screen === "dashboard") {
    const s = state.stats || { total: 0, inProgress: 0, completed: 0, pending: 0 };
    body = `<div class="greet"><h2>Hello, ${state.user.name.split(" ")[0]} 👋</h2></div><div class="stat-grid">
      <div class="stat-card"><div class="num">${s.total}</div><div class="lbl">Total Customers</div></div><div class="stat-card"><div class="num" style="color:var(--orange);">${s.inProgress}</div><div class="lbl">In Progress</div></div><div class="stat-card"><div class="num" style="color:var(--green);">${s.completed}</div><div class="lbl">Completed</div></div><div class="stat-card"><div class="num" style="color:var(--blue);">${s.pending}</div><div class="lbl">Pending</div></div></div>
      <div style="padding:0 18px 6px;"><button class="btn btn-gold" style="width:100%;" onclick="goTo('add')">+ Add New Customer</button></div><div class="list-block"><h4>Customers</h4>${state.customers.slice(0, 6).map(custRow).join("") || `<div class="empty">No customers yet.</div>`}</div>`;
  } else if (state.screen === "customers") {
    body = `<div class="app-header" style="position:static;"><h2 style="flex:1;">Customers</h2><span class="back-btn" onclick="goTo('add')" title="Add Customer">＋</span></div><div class="search-bar"><input placeholder="🔍 Search by name or mobile…" oninput="filterCustomers(this.value)"></div><div class="list-block" id="cust-list" style="margin-top:6px;">${state.customers.map(custRow).join("") || `<div class="empty">No customers found.</div>`}</div>`;
  } else if (state.screen === "add") {
    body = `<div style="padding:16px 18px;"><div class="field"><label>Full Name *</label><input id="ac-name" placeholder="Customer name"></div><div class="field"><label>Mobile Number *</label><input id="ac-mobile" placeholder="98XXXXXXXX"></div><div class="field"><label>Email</label><input id="ac-email" placeholder="customer@email.com"></div><div class="field"><label>Address</label><input id="ac-address" placeholder="Village/City, District"></div><div class="field"><label>Consumer Number</label><input id="ac-consumerNo" placeholder="MSEDCL consumer no."></div><div class="field"><label>Solar Capacity</label><input id="ac-capacity" placeholder="e.g. 3kW"></div><div class="field"><label>Customer Type</label><select id="ac-type" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:var(--card);font-size:13px;"><option>Loan</option><option>Cash</option></select></div><button class="btn btn-gold" style="width:100%;" onclick="submitAddCustomer({name:{value:document.getElementById('ac-name').value},mobile:{value:document.getElementById('ac-mobile').value},email:{value:document.getElementById('ac-email').value},address:{value:document.getElementById('ac-address').value},consumerNo:{value:document.getElementById('ac-consumerNo').value},capacity:{value:document.getElementById('ac-capacity').value},type:{value:document.getElementById('ac-type').value}})">Save Customer</button></div>`;
  } else if (state.screen === "details") {
    const c = state.activeCustomer;
    body = `<div class="detail-hero"><div class="row"><div class="avatar" style="width:46px;height:46px;">${initials(c.name)}</div><div><div class="name">${c.name}</div><div class="sub">${c.capacity || "—"} System · ${c.type} Customer</div><div class="sub">${c.mobile}${c.email ? " · " + c.email : ""}</div>${c.address ? `<div class="sub">${c.address}</div>` : ""}</div></div><div class="status-pill"><div><div class="l">Current Status</div><div class="v">${state.stages[c.step - 1]}</div></div>${statusBadge(c.status)}</div></div><div class="stepper-panel" style="margin-top:12px;"><div class="cells">${cellsHTML(c.step)}</div></div><div style="padding:14px 18px;">${state.stages.map((s, i) => {const n=i+1;const dot=n<c.step?"✓":n===c.step?"●":"○";const color=n<c.step?"var(--green)":n===c.step?"var(--orange)":"var(--gray)";return `<div class="stage-row"><span class="dot" style="color:${color};">${dot}</span><span style="flex:1;">${s}</span>${n===c.step?statusBadge(c.status):n<c.step?statusBadge("completed"):statusBadge("pending")}</div>`;}).join("")}</div><div style="display:flex;gap:8px;padding:0 18px 16px;"><button class="btn btn-navy" style="flex:1;" onclick="goTo('documents')">Documents</button><button class="btn btn-ghost" style="flex:1;" onclick="goTo('timeline')">History</button></div>`;
  } else if (state.screen === "documents") {
    if (state.pendingUpload) {
      body = `<div style="padding:16px 18px;"><div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px;"><div style="font-size:12px;color:var(--text-soft);margin-bottom:4px;">Selected file</div><div style="font-size:13px;font-weight:600;">${state.pendingUpload.fileName}</div></div><div class="field"><label>What document is this?</label><select id="up-type" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:var(--card);font-size:13px;" onchange="document.getElementById('up-custom').style.display = this.value==='Other' ? 'block' : 'none';">${docTypeOptions("")}</select></div><div class="field" id="up-custom" style="display:none;"><label>Document name</label><input id="up-custom-name" placeholder="e.g. Electricity Board NOC"></div><button class="btn btn-gold" style="width:100%;margin-bottom:8px;" onclick="confirmUpload(document.getElementById('up-type'), document.getElementById('up-custom-name'))">Save Document</button><button class="btn btn-ghost" style="width:100%;" onclick="cancelUpload()">Cancel</button></div>`;
    } else {
      body = `${state.documents.map((d) => `<div class="doc-row"><div class="l"><div class="ic">📄</div><div><div>${d.type}</div><div style="font-size:10px;color:var(--text-soft);">${d.originalName || ""}</div></div></div><div style="display:flex;align-items:center;gap:8px;"><a href="${API}/api/uploads/${d.fileName}" target="_blank" style="color:var(--blue);font-size:11px;font-weight:600;">View</a><span style="color:#C0392B;cursor:pointer;font-size:14px;" onclick="deleteDoc('${d.id}')">✕</span></div></div>`).join("") || `<div class="empty">No documents uploaded yet.</div>`}<div class="fab-wrap" style="display:flex;flex-direction:column;gap:8px;"><input type="file" id="camera-input" accept="image/*" capture="environment" style="display:none;" onchange="stageFileForUpload(this)"><input type="file" id="gallery-input" accept="image/*,application/pdf" style="display:none;" onchange="stageFileForUpload(this)"><button class="btn btn-gold" style="width:100%;" onclick="pickFile('camera-input')">📷 Take Photo</button><button class="btn btn-navy" style="width:100%;" onclick="pickFile('gallery-input')">🖼️ Choose from Gallery</button></div>`;
    }
  } else if (state.screen === "timeline") {
    body = `<div class="timeline">${state.timeline.map((t) => `<div class="tl-item"><div class="tl-dot"></div><div><div class="date">${t.at}</div><div class="ttl">${t.title}</div></div></div>`).join("") || `<div class="empty">No activity yet.</div>`}</div>`;
  }

  const titles = { details: "Customer", documents: "Documents", timeline: "Timeline", add: "Add Customer" };
  const header = state.screen === "dashboard" ? `<div class="app-header"><h2 style="flex:1;">Solar Doc Manager</h2><span class="back-btn" title="Logout" onclick="logout()">⎋</span></div>` : state.screen === "customers" ? "" : `<div class="app-header"><span class="back-btn" onclick="goTo(backTargetFor('${state.screen}'), state.activeCustomer && state.activeCustomer.id)">←</span><h2>${titles[state.screen] || ""}</h2></div>`;
  el.innerHTML = `${header}<div class="app-body">${body}</div>${showNav ? `<div class="bottom-nav"><div class="nav-item ${state.screen === "dashboard" ? "active" : ""}" onclick="goTo('dashboard')"><div>🏠</div>Home</div><div class="nav-item ${["customers","details","documents","timeline","add"].includes(state.screen) ? "active" : ""}" onclick="goTo('customers')"><div>👥</div>Customers</div></div>` : ""}`;
}

function filterCustomers(q) {
  const list = document.getElementById("cust-list");
  const filtered = state.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.mobile.includes(q));
  list.innerHTML = filtered.map(custRow).join("") || `<div class="empty">No matches.</div>`;
}

boot();
if ("serviceWorker" in navigator) { window.addEventListener("load", () => { navigator.serviceWorker.register("/service-worker.js").catch((e) => console.log("SW registration failed", e)); }); }
