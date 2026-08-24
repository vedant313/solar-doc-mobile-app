/* Solar Doc Manager — passwordless master-admin OTP login */
(function () {
  const originalRender = window.render;
  const originalApi = window.api;
  const originalGoTo = window.goTo;

  state.otpStep = "phone";
  state.companyFilter = localStorage.getItem("sdm_company_filter") || "all";

  window.api = async function (path, opts = {}) {
    let p = path;
    const admin = state.user && state.user.role === "admin";
    if (admin && (path === "/api/customers" || path === "/api/stats") && state.companyFilter !== "all") {
      p += "?companyId=" + encodeURIComponent(state.companyFilter);
    }
    return originalApi(p, opts);
  };

  async function sendOtp() {
    const err = document.getElementById("otp-err");
    if (err) err.textContent = "";
    try {
      const r = await originalApi("/api/admin/request-otp", { method: "POST", body: JSON.stringify({}) });
      state.otpStep = "otp";
      render();
      toast(r.message || "OTP sent to your registered mobile.");
    } catch (e) { if (err) err.textContent = e.message; }
  }

  async function verifyOtp() {
    const otp = (document.getElementById("otp-code")?.value || "").replace(/\D/g, "").slice(0, 6);
    const err = document.getElementById("otp-err");
    if (err) err.textContent = "";
    if (otp.length !== 6) { if (err) err.textContent = "Enter the 6-digit OTP."; return; }
    try {
      const data = await originalApi("/api/admin/verify-otp", { method: "POST", body: JSON.stringify({ otp }) });
      state.token = data.token; state.user = data.user; state.companyFilter = "all";
      localStorage.setItem("sdm_token", data.token);
      localStorage.setItem("sdm_user", JSON.stringify(data.user));
      localStorage.setItem("sdm_company_filter", "all");
      state.stages = await originalApi("/api/stages");
      state.docTypes = await originalApi("/api/document-types");
      state.screen = "dashboard";
      render();
      await originalGoTo("dashboard");
    } catch (e) { if (err) err.textContent = e.message; }
  }

  async function selectCompany(id) {
    state.companyFilter = id;
    localStorage.setItem("sdm_company_filter", id);
    await originalGoTo("dashboard");
  }
  window.sendOtp = sendOtp; window.verifyOtp = verifyOtp; window.selectCompany = selectCompany;

  window.render = function () {
    if (state.screen === "login") {
      const el = document.getElementById("app");
      if (state.otpStep === "otp") {
        el.innerHTML = `<div class="login-screen"><div class="mark">🔐</div><h2>Verify OTP</h2><p class="sub">Enter the 6-digit OTP sent to your registered admin mobile.</p><div class="field"><label>OTP</label><input id="otp-code" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code"></div><div class="login-err" id="otp-err"></div><button class="btn btn-gold" style="width:100%;margin-bottom:8px;" onclick="verifyOtp()">Verify & Continue</button><button class="btn btn-ghost" style="width:100%;" onclick="state.otpStep='phone';render()">Back</button></div>`;
      } else {
        el.innerHTML = `<div class="login-screen"><div class="mark">☀️</div><h2>Solar Doc Manager</h2><p class="sub">Secure Admin Login</p><div class="field"><label>Registered Admin Mobile</label><input value="••••••••••••" disabled></div><div class="login-err" id="otp-err"></div><button class="btn btn-gold" style="width:100%;" onclick="sendOtp()">Send OTP</button><div class="demo-hint">A one-time OTP will be sent to the registered admin mobile.</div></div>`;
      }
      return;
    }
    originalRender();
    if (state.screen === "dashboard" && state.user?.role === "admin") {
      const body = document.querySelector(".greet");
      if (body) {
        const active = state.companyFilter || "all";
        const buttons = [["all","🌐","All"],["dhule","📍","Dhule"],["pune","📍","Pune"],["mumbai","📍","Mumbai"]].map(([id,ic,label]) => `<button onclick="selectCompany('${id}')" style="padding:9px 3px;border-radius:9px;border:1px solid ${active===id?"var(--gold)":"var(--line)"};background:${active===id?"#FEF1DD":"var(--card)"};font-size:10px;font-weight:700;color:${active===id?"#946400":"var(--text)"};">${ic}<br>${label}</button>`).join("");
        body.insertAdjacentHTML("afterend", `<div style="padding:10px 18px 4px;"><div style="font-size:10px;color:var(--text-soft);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px;">View Branch</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">${buttons}</div></div>`);
      }
    }
  };
  render();
})();
