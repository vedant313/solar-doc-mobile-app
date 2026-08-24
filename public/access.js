(() => {
  const originalRender = window.render;
  let accessScreen = null;
  let accessRequests = [];

  const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
  const apiCall = (path, opts = {}) => window.api ? window.api(path, opts) : fetch((window.API_BASE || "") + path, Object.assign({headers:{"Content-Type":"application/json"}}, opts)).then(async r => { const d = await r.json().catch(()=>({})); if(!r.ok) throw Error(d.error || "Request failed"); return d; });

  function showRequestModal() {
    const old = document.getElementById("access-modal"); if (old) old.remove();
    const modal = document.createElement("div");
    modal.id = "access-modal";
    modal.innerHTML = `
      <div class="sdm-access-backdrop" onclick="if(event.target===this)this.remove()">
        <div class="sdm-access-modal">
          <div class="sdm-access-title">Request Staff Access</div>
          <div class="sdm-access-sub">Admin approval ke baad hi account active hoga.</div>
          <label>Name</label><input id="ar-name" placeholder="Full name">
          <label>Mobile Number</label><input id="ar-mobile" inputmode="numeric" maxlength="10" placeholder="10 digit mobile">
          <label>Password</label><input id="ar-pass" type="password" placeholder="Create password">
          <div id="ar-err" class="sdm-access-error"></div>
          <div class="sdm-access-actions"><button class="sdm-secondary" onclick="document.getElementById('access-modal').remove()">Cancel</button><button class="sdm-primary" onclick="window.submitAccessRequest()">Send Request</button></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  window.submitAccessRequest = async function () {
    const name = document.getElementById("ar-name").value.trim();
    const mobile = document.getElementById("ar-mobile").value.trim();
    const password = document.getElementById("ar-pass").value;
    const err = document.getElementById("ar-err"); err.textContent = "";
    if (!name || !/^\d{10}$/.test(mobile) || password.length < 6) { err.textContent = "Name, valid 10-digit mobile and 6+ character password required."; return; }
    try {
      await apiCall("/api/access/request", {method:"POST", body:JSON.stringify({name,mobile,password})});
      document.getElementById("access-modal").remove();
      alert("Access request sent. Admin approval ke baad login kar sakte ho.");
    } catch (e) { err.textContent = e.message; }
  };

  async function loadRequests() { accessRequests = await apiCall("/api/access/requests"); return accessRequests; }

  async function openAccessAdmin() {
    try { await loadRequests(); accessScreen = "requests"; renderAccessPanel(); }
    catch (e) { if (window.toast) toast(e.message); else alert(e.message); }
  }

  async function approveRequest(id, companyId) {
    try { await apiCall("/api/access/requests/" + encodeURIComponent(id), {method:"PUT", body:JSON.stringify({action:"approve",companyId})}); await loadRequests(); renderAccessPanel(); }
    catch (e) { alert(e.message); }
  }

  async function rejectRequest(id) {
    if (!confirm("Reject this access request?")) return;
    try { await apiCall("/api/access/requests/" + encodeURIComponent(id), {method:"PUT", body:JSON.stringify({action:"reject"})}); await loadRequests(); renderAccessPanel(); }
    catch (e) { alert(e.message); }
  }

  window.openStaffAccess = openAccessAdmin;
  window.approveStaffRequest = approveRequest;
  window.rejectStaffRequest = rejectRequest;
  window.closeStaffAccess = () => { accessScreen = null; originalRender(); setTimeout(() => { addAdminButton(); }, 0); };

  function renderAccessPanel() {
    const app = document.getElementById("app"); if (!app || accessScreen !== "requests") return;
    const pending = accessRequests || [];
    app.innerHTML = `
      <div class="sdm-access-page">
        <div class="sdm-access-head"><button class="sdm-back" onclick="closeStaffAccess()">←</button><div><div class="sdm-access-h1">Staff Access</div><div class="sdm-access-muted">Manage pending staff requests</div></div><div class="sdm-count">${pending.length}</div></div>
        <div class="sdm-access-content">
          ${pending.length ? pending.map(r => `
            <div class="sdm-request-card">
              <div class="sdm-request-main"><div class="sdm-avatar">${esc((r.name||"S").slice(0,1).toUpperCase())}</div><div><div class="sdm-request-name">${esc(r.name)}</div><div class="sdm-request-mobile">${esc(r.mobile)}</div><div class="sdm-request-date">${r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div></div><span class="sdm-pending">Pending</span></div>
              <div class="sdm-password-note">🔒 Password is set by the staff member and is never displayed here.</div>
              <div class="sdm-branch-label">Give access to</div>
              <div class="sdm-branch-grid"><button onclick="approveStaffRequest('${esc(r.id)}','dhule')">Dhule</button><button onclick="approveStaffRequest('${esc(r.id)}','pune')">Pune</button><button onclick="approveStaffRequest('${esc(r.id)}','mumbai')">Mumbai</button></div>
              <button class="sdm-reject" onclick="rejectStaffRequest('${esc(r.id)}')">Reject Request</button>
            </div>`).join("") : `<div class="sdm-empty"><div class="sdm-empty-icon">✓</div><b>No pending requests</b><span>New staff access requests will appear here.</span></div>`}
        </div>
      </div>`;
  }

  function addLoginRequestButton() {
    const box = document.querySelector(".login-screen");
    if (!box || document.getElementById("access-request-btn")) return;
    const b = document.createElement("button"); b.id="access-request-btn"; b.className="sdm-login-request"; b.textContent="Request Staff Access"; b.onclick=showRequestModal; box.appendChild(b);
    const h=document.createElement("div"); h.className="sdm-login-note"; h.textContent="New staff? Request access from admin."; box.appendChild(h);
  }

  function addAdminButton() {
    if (!state.user || state.user.role !== "admin" || state.screen !== "dashboard" || document.getElementById("staff-access-btn")) return;
    const target = document.querySelector(".app-body") || document.getElementById("app"); if (!target) return;
    const wrap=document.createElement("div"); wrap.id="staff-access-btn"; wrap.style="padding:8px 18px 14px;";
    wrap.innerHTML=`<button class="sdm-admin-access" onclick="openStaffAccess()"><span>👥</span><span style="flex:1;text-align:left"><b>Staff Access</b><small>Approve city/branch access</small></span><span>›</span></button>`;
    target.appendChild(wrap);
  }

  window.render = function () {
    if (accessScreen === "requests") { renderAccessPanel(); return; }
    originalRender();
    setTimeout(() => { addLoginRequestButton(); addAdminButton(); }, 0);
  };

  const style=document.createElement("style"); style.textContent=`
    .sdm-login-request{width:100%;margin-top:10px;padding:12px;border-radius:10px;border:1px solid #51648f;background:transparent;color:#fff;font-weight:700;cursor:pointer}.sdm-login-note{margin-top:9px;font-size:10.5px;color:#8494BD;text-align:center}
    .sdm-access-backdrop{position:fixed;inset:0;background:rgba(5,12,28,.72);display:flex;align-items:center;justify-content:center;padding:18px;z-index:9999}.sdm-access-modal{width:min(420px,100%);background:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 70px rgba(0,0,0,.35);color:#18233d}.sdm-access-title{font-size:18px;font-weight:800}.sdm-access-sub{font-size:12px;color:#71809d;margin:5px 0 18px}.sdm-access-modal label{display:block;font-size:11px;font-weight:700;color:#596783;margin:10px 0 5px}.sdm-access-modal input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #dce2ed;border-radius:10px;outline:none}.sdm-access-actions{display:flex;gap:8px;margin-top:18px}.sdm-primary,.sdm-secondary{flex:1;padding:11px;border-radius:10px;border:0;font-weight:700;cursor:pointer}.sdm-primary{background:#f6a51b;color:#17213b}.sdm-secondary{background:#eef1f6;color:#35415b}.sdm-access-error{color:#d64545;font-size:11px;margin-top:8px;min-height:14px}
    .sdm-access-page{min-height:100vh;background:#f5f7fb;color:#18233d}.sdm-access-head{display:flex;align-items:center;gap:12px;padding:18px;border-bottom:1px solid #e3e7ef;background:#fff;position:sticky;top:0;z-index:2}.sdm-back{border:0;background:#eef1f6;width:34px;height:34px;border-radius:10px;font-size:18px;cursor:pointer}.sdm-access-h1{font-size:18px;font-weight:800}.sdm-access-muted{font-size:11px;color:#78849c;margin-top:2px}.sdm-count{margin-left:auto;background:#fff1d8;color:#b16d00;padding:6px 10px;border-radius:20px;font-weight:800;font-size:12px}.sdm-access-content{padding:18px;max-width:900px;margin:auto}.sdm-request-card{background:#fff;border:1px solid #e0e5ee;border-radius:15px;padding:16px;margin-bottom:12px;box-shadow:0 3px 12px rgba(20,40,80,.04)}.sdm-request-main{display:flex;align-items:center;gap:11px}.sdm-avatar{width:40px;height:40px;border-radius:12px;background:#0c1e3d;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}.sdm-request-name{font-weight:800;font-size:14px}.sdm-request-mobile{font-size:12px;color:#50607b;margin-top:2px}.sdm-request-date{font-size:10px;color:#9aa5b8;margin-top:3px}.sdm-pending{margin-left:auto;background:#fff3dc;color:#a86b00;border-radius:20px;padding:5px 8px;font-size:10px;font-weight:800}.sdm-password-note{font-size:10.5px;color:#7b879d;background:#f7f9fc;border-radius:9px;padding:9px;margin:12px 0}.sdm-branch-label{font-size:11px;font-weight:800;margin-bottom:7px}.sdm-branch-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.sdm-branch-grid button{padding:11px;border:1px solid #f0b14b;background:#fffaf0;color:#8a5900;border-radius:10px;font-weight:800;cursor:pointer}.sdm-branch-grid button:hover{background:#f6a51b;color:#17213b}.sdm-reject{margin-top:9px;width:100%;padding:9px;border:0;background:transparent;color:#c34a4a;font-size:11px;font-weight:700;cursor:pointer}.sdm-empty{min-height:55vh;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#66738b;gap:6px}.sdm-empty-icon{width:48px;height:48px;border-radius:50%;background:#e8f7ee;color:#249255;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:8px}.sdm-empty span{font-size:11px}.sdm-admin-access{width:100%;display:flex;align-items:center;gap:10px;padding:13px 14px;border:1px solid #dfe5ef;border-radius:12px;background:#fff;color:#17233e;cursor:pointer}.sdm-admin-access small{display:block;color:#7b879d;font-size:10px;margin-top:2px}.sdm-admin-access:hover{border-color:#f2ae3e}
  `; document.head.appendChild(style);
})();
