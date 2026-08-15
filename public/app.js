const API = window.API_BASE || "";
let state = {
  token: localStorage.getItem("sdm_token") || null,
  user: JSON.parse(localStorage.getItem("sdm_user") || "null"),
  screen: "login",
  stages: [],
  customers: [],
  activeCustomer: null,
  documents: [],
  timeline: [],
  loading: false,
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

async function doLogin(mobile, password, errEl) {
  errEl.textContent = "";
  try {
    const data = await api("/api/login", { method: "POST", body: JSON.stringify({ mobile, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem("sdm_token", data.token);
    localStorage.setItem("sdm_user", JSON.stringify(data.user));
    state.stages = await api("/api/stages");
    goTo("dashboard");
  } catch (e) {
    errEl.textContent = e.message;
  }
}

async function goTo(screen, custId) {
  state.screen = screen;
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

async function handleUpload(fileInput) {
  const file = fileInput.files[0];
  if (!file || !state.activeCustomer) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(",")[1];
    try {
      const doc = await api(`/api/customers/${state.activeCustomer.id}/documents`, {
        method: "POST", body: JSON.stringify({ fileName: file.name, base64 }),
      });
      toast(doc.status === "Uploaded" ? `Detected: ${doc.type}` : `Uploaded — please confirm type manually`);
      goTo("documents");
    } catch (e) { toast(e.message); }
  };
  reader.readAsDataURL(file);
}

function custRow(c) {
  return `<div class="cust-row" onclick="goTo('details','${c.id}')">
    <div class="avatar" style="width:36px;height:36px;">${initials(c.name)}</div>
    <div class="meta"><div class="name">${c.name}</div><div class="sub">${c.capacity} · Step ${c.step}/10</div></div>
    ${statusBadge(c.status)}
  </div>`;
}

function render() {
  const el = document.getElementById("app");

  if (state.screen === "login") {
    el.innerHTML = `
      <div class="login-screen">
        <div class="mark">☀️</div>
        <h2>Solar Doc Manager</h2>
        <p class="sub">Log in to track your solar projects</p>
        <div class="field"><label>Mobile Number</label><input id="li-mobile" placeholder="98XXXXXXXX"></div>
        <div class="field"><label>Password</label><input id="li-pass" type="password" placeholder="••••••••"></div>
        <div class="login-err" id="li-err"></div>
        <button class="btn btn-gold" style="width:100%;" onclick="doLogin(document.getElementById('li-mobile').value, document.getElementById('li-pass').value, document.getElementById('li-err'))">Login</button>
        <div class="demo-hint">
          Demo admin: 9000000001 / admin123<br>
          Demo staff: 9000000002 / staff123
        </div>
      </div>`;
    return;
  }

  let body = "";
  const showNav = true;

  if (state.screen === "dashboard") {
    const s = state.stats || { total: 0, inProgress: 0, completed: 0, pending: 0 };
    body = `
      <div class="greet"><h2>Hello, ${state.user.name.split(" ")[0]} 👋</h2></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${s.total}</div><div class="lbl">Total Customers</div></div>
        <div class="stat-card"><div class="num" style="color:var(--orange);">${s.inProgress}</div><div class="lbl">In Progress</div></div>
        <div class="stat-card"><div class="num" style="color:var(--green);">${s.completed}</div><div class="lbl">Completed</div></div>
        <div class="stat-card"><div class="num" style="color:var(--blue);">${s.pending}</div><div class="lbl">Pending</div></div>
      </div>
      <div class="list-block"><h4>Customers</h4>
      ${state.customers.slice(0, 6).map(custRow).join("") || `<div class="empty">No customers yet.</div>`}
      </div>`;
  }

  else if (state.screen === "customers") {
    body = `
      <div class="app-header" style="position:static;"><h2>Customers</h2></div>
      <div class="search-bar"><input placeholder="🔍 Search by name or mobile…" oninput="filterCustomers(this.value)"></div>
      <div class="list-block" id="cust-list" style="margin-top:6px;">
      ${state.customers.map(custRow).join("") || `<div class="empty">No customers found.</div>`}
      </div>`;
  }

  else if (state.screen === "details") {
    const c = state.activeCustomer;
    body = `
      <div class="detail-hero">
        <div class="row">
          <div class="avatar" style="width:46px;height:46px;">${initials(c.name)}</div>
          <div><div class="name">${c.name}</div><div class="sub">${c.capacity} System · ${c.type} Customer</div><div class="sub">${c.mobile} · ${c.address}</div></div>
        </div>
        <div class="status-pill"><div><div class="l">Current Status</div><div class="v">${state.stages[c.step - 1]}</div></div>${statusBadge(c.status)}</div>
      </div>
      <div class="stepper-panel" style="margin-top:12px;"><div class="cells">${cellsHTML(c.step)}</div></div>
      <div style="padding:14px 18px;">
      ${state.stages.map((s, i) => {
        const n = i + 1;
        const dot = n < c.step ? "✓" : n === c.step ? "●" : "○";
        const color = n < c.step ? "var(--green)" : n === c.step ? "var(--orange)" : "var(--gray)";
        return `<div class="stage-row"><span class="dot" style="color:${color};">${dot}</span><span style="flex:1;">${s}</span>${n === c.step ? statusBadge(c.status) : n < c.step ? statusBadge("completed") : statusBadge("pending")}</div>`;
      }).join("")}
      </div>
      <div style="display:flex;gap:8px;padding:0 18px 16px;">
        <button class="btn btn-navy" style="flex:1;" onclick="goTo('documents')">Documents</button>
        <button class="btn btn-ghost" style="flex:1;" onclick="goTo('timeline')">History</button>
      </div>`;
  }

  else if (state.screen === "documents") {
    body = `
      ${state.documents.map((d) => `<div class="doc-row"><div class="l"><div class="ic">📄</div><div>${d.type}${d.status === "Needs Confirmation" ? " <span style='color:var(--orange);font-size:10px;'>(low confidence — confirm)</span>" : ""}</div></div>${statusBadge(d.status === "Uploaded" ? "completed" : d.status === "Needs Confirmation" ? "in-progress" : "pending")}</div>`).join("") || `<div class="empty">No documents uploaded yet.</div>`}
      <div class="fab-wrap">
        <input type="file" id="file-input" onchange="handleUpload(this)">
        <button class="btn btn-gold" style="width:100%;" onclick="document.getElementById('file-input').click()">+ Upload Document</button>
        <p style="font-size:10.5px;color:var(--text-soft);margin-top:8px;text-align:center;">Filename is auto-classified (e.g. "aadhaar_xxx.jpg" → Aadhaar Card). Low-confidence matches ask for manual confirmation.</p>
      </div>`;
  }

  else if (state.screen === "timeline") {
    body = `<div class="timeline">
      ${state.timeline.map((t) => `<div class="tl-item"><div class="tl-dot"></div><div><div class="date">${t.at}</div><div class="ttl">${t.title}</div></div></div>`).join("") || `<div class="empty">No activity yet.</div>`}
    </div>`;
  }

  const header = state.screen === "dashboard"
    ? `<div class="app-header"><h2 style="flex:1;">Solar Doc Manager</h2><span class="back-btn" title="Logout" onclick="logout()">⎋</span></div>`
    : state.screen === "customers"
    ? "" // list has its own header
    : `<div class="app-header"><span class="back-btn" onclick="goTo(state.screen==='timeline'||state.screen==='documents'?'details':'dashboard', state.activeCustomer && state.activeCustomer.id)">←</span><h2>${state.screen === "details" ? "Customer" : state.screen === "documents" ? "Documents" : "Timeline"}</h2></div>`;

  el.innerHTML = `
    ${header}
    <div class="app-body">${body}</div>
    ${showNav ? `<div class="bottom-nav">
      <div class="nav-item ${state.screen === "dashboard" ? "active" : ""}" onclick="goTo('dashboard')"><div>🏠</div>Home</div>
      <div class="nav-item ${["customers","details","documents","timeline"].includes(state.screen) ? "active" : ""}" onclick="goTo('customers')"><div>👥</div>Customers</div>
    </div>` : ""}
  `;
}

function filterCustomers(q) {
  const list = document.getElementById("cust-list");
  const filtered = state.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.mobile.includes(q));
  list.innerHTML = filtered.map(custRow).join("") || `<div class="empty">No matches.</div>`;
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((e) => console.log("SW registration failed", e));
  });
}
