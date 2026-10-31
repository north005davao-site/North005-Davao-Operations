// OUTLET RENTALS & LOAD ALLOWANCE MODULE — North-005 Davao Operations ERP
// Redesigned with Active Booth Code Monthly Payment Management, Calendar, A.R. Receipts, and Inventory
(()=>{
const NAME = "OUTLET RENTALS & LOAD ALLOWANCE";
const BUCKET = "rental-receipts";
const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MN_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const money = n => "₱" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const fd = s => {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  return MN_SHORT[m - 1] + " " + d + ", " + y;
};
const esc = window.esc || (s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));

// Next due date calculation: 1 month after Date Paid with month-end day clamping
function calcNextDueDate(datePaidStr) {
  if (!datePaidStr) return "";
  const [y, m, d] = datePaidStr.split("-").map(Number);
  const targetMonthIndex = m; // in 0-indexed JS Date, m-1 is current, m is next month
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(d, daysInTargetMonth);
  return iso(new Date(targetYear, targetMonth, targetDay));
}

// Module State
const R = {
  tab: "booths", // "booths" | "inventory"
  view: "list",  // "list" | "detail"
  boothCode: null, // selected booth for detail view
  m: iso(new Date()).slice(0, 7), // selected dashboard month "YYYY-MM"
  calYear: new Date().getFullYear(), // calendar year for booth detail
  q: "", // search input
  muni: "", // municipality filter
  brgy: "", // barangay filter
  statusFilter: "", // "paid" | "pending" | "overdue" | ""
  kpiFilter: "", // "paid" | "pending" | "overdue" | "collected" | ""
  sub: false,
  busy: false
};
window.RENTS = R;

const adm = () => me && me.role === "admin";
const sup = () => me && (me.role === "admin" || me.role === "supervisor");
const MU = () => window.MUNI || {};

// -------------------------------------------------------------------------
// Supabase Data Access & Fallbacks
// -------------------------------------------------------------------------
let ACTIVE_BOOTHS = [];
let MONTH_PAYMENTS = [];
let INVENTORY_DATA = [];
let timer = null;

async function fetchActiveBooths() {
  const { data, error } = await sb
    .from("registry_outlets")
    .select("booth_code,sr_name,municipality,barangay,purok,collector,status")
    .eq("status", "ACTIVE")
    .range(0, 4999);
  if (error || !data) return [];
  return data.sort((a, b) => {
    const na = parseInt(String(a.booth_code).replace(/\D/g, "")) || 0;
    const nb = parseInt(String(b.booth_code).replace(/\D/g, "")) || 0;
    return na - nb || String(a.booth_code).localeCompare(String(b.booth_code));
  });
}

async function fetchPaymentsForPeriod(periodStr) {
  try {
    const { data, error } = await sb
      .from("booth_payments")
      .select("*, attachments:booth_payment_attachments(*)")
      .eq("payment_period", periodStr)
      .range(0, 4999);
    if (error) return [];
    return data || [];
  } catch (e) {
    return [];
  }
}

async function fetchAllBoothPayments(boothCode) {
  try {
    const { data, error } = await sb
      .from("booth_payments")
      .select("*, attachments:booth_payment_attachments(*)")
      .eq("booth_code", boothCode)
      .order("date_paid", { ascending: false })
      .range(0, 4999);
    if (error) return [];
    return data || [];
  } catch (e) {
    return [];
  }
}

async function fetchInventory() {
  try {
    const { data, error } = await sb
      .from("equipment_inventory")
      .select("*")
      .range(0, 99);
    if (error || !data) return [];
    return data;
  } catch (e) {
    return [];
  }
}

async function signedUrl(path) {
  if (!path) return null;
  try {
    const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  } catch (e) {
    return null;
  }
}

function subscribe() {
  if (R.sub) return;
  R.sub = true;
  sb.channel("booth_rentals_chan")
    .on("postgres_changes", { event: "*", schema: "public", table: "booth_payments" }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!QUIETW() && cur === NAME && !R.busy && !document.querySelector("dialog[open]")) go(cur);
      }, 700);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "booth_payment_attachments" }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!QUIETW() && cur === NAME && !R.busy && !document.querySelector("dialog[open]")) go(cur);
      }, 700);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "equipment_inventory" }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!QUIETW() && cur === NAME && !R.busy && !document.querySelector("dialog[open]")) go(cur);
      }, 700);
    })
    .subscribe();
}

// -------------------------------------------------------------------------
// Main Entry Point
// -------------------------------------------------------------------------
async function rent(v) {
  subscribe();
  LOAD(v);
  v.dataset.mod = cur;

  if (R.tab === "inventory") {
    INVENTORY_DATA = await fetchInventory();
    return renderInventory(v);
  }

  // Booth Payments tab
  ACTIVE_BOOTHS = await fetchActiveBooths();
  MONTH_PAYMENTS = await fetchPaymentsForPeriod(R.m);

  if (R.view === "detail" && R.boothCode) {
    return renderDetail(v);
  }
  return renderList(v);
}

// -------------------------------------------------------------------------
// TAB 1: BOOTH PAYMENTS LIST VIEW
// -------------------------------------------------------------------------
function renderList(v) {
  const today = iso(new Date());
  const [curYear, curMonthNum] = R.m.split("-").map(Number);
  const monthLabel = MN[curMonthNum - 1] + " " + curYear;

  // Build Map of payments for selected month
  const payMap = new Map();
  MONTH_PAYMENTS.forEach(p => {
    payMap.set(p.booth_code, p);
  });

  // Calculate Dashboard Counts
  let countPaid = 0;
  let countPending = 0;
  let countOverdue = 0;
  let totalCollected = 0;

  const boothRows = ACTIVE_BOOTHS.map(b => {
    const pay = payMap.get(b.booth_code);
    let status = "pending";
    if (pay) {
      status = "paid";
      countPaid++;
      totalCollected += Number(pay.amount || 0);
    } else {
      // If payment not recorded for period:
      // Overdue if period is in the past, or if today is past the 25th of that period
      const periodEnd = new Date(curYear, curMonthNum, 0); // last day of month
      const periodEndIso = iso(periodEnd);
      if (today > periodEndIso) {
        status = "overdue";
        countOverdue++;
      } else {
        status = "pending";
        countPending++;
      }
    }
    return {
      ...b,
      payment: pay || null,
      status
    };
  });

  // Filter Rows
  let filtered = boothRows;

  // KPI card filter
  if (R.kpiFilter === "paid" || R.kpiFilter === "collected") {
    filtered = filtered.filter(r => r.status === "paid");
  } else if (R.kpiFilter === "pending") {
    filtered = filtered.filter(r => r.status === "pending");
  } else if (R.kpiFilter === "overdue") {
    filtered = filtered.filter(r => r.status === "overdue");
  }

  // Status dropdown filter
  if (R.statusFilter) {
    filtered = filtered.filter(r => r.status === R.statusFilter);
  }

  // Search filter
  if (R.q) {
    const q = R.q.toLowerCase();
    filtered = filtered.filter(r =>
      [r.booth_code, r.sr_name, r.municipality, r.barangay, r.purok, r.collector]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  // Municipality filter
  if (R.muni) {
    filtered = filtered.filter(r => (r.municipality || "").toUpperCase() === R.muni.toUpperCase());
  }

  // Barangay filter
  if (R.brgy) {
    filtered = filtered.filter(r => (r.barangay || "").toUpperCase() === R.brgy.toUpperCase());
  }

  // Extract unique Municipalities & Barangays for dropdowns
  const muniList = [...new Set(ACTIVE_BOOTHS.map(b => b.municipality).filter(Boolean))].sort();
  const brgyList = [...new Set(
    ACTIVE_BOOTHS
      .filter(b => !R.muni || (b.municipality || "").toUpperCase() === R.muni.toUpperCase())
      .map(b => b.barangay)
      .filter(Boolean)
  )].sort();

  // Pagination
  const pg = PAGER.paginate("rent_active_booths", filtered);

  v.innerHTML = `
<div class="hdr2">
  <div>
    <div style="font-size:18px;font-weight:700">🏢 Outlet Rentals &amp; Load Allowance</div>
    <div class="chip">Active Booth Code Monthly Payment Management &amp; Equipment Inventory</div>
  </div>
  <div style="display:flex;gap:6px;align-items:center">
    <button class="chip2 on" id="tab-booths">🏢 Booth Payments</button>
    <button class="chip2" id="tab-inventory">📦 Equipment Inventory</button>
  </div>
</div>

<!-- SECTION 10: PAYMENT OVERVIEW DASHBOARD -->
<div class="box" style="margin-bottom:14px;background:linear-gradient(170deg,#10265a,#0a1a3f);border:1px solid var(--line)">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:8px">
      <b style="font-size:15px;color:var(--gold)">Payment Overview Dashboard</b>
      <span class="chip">${esc(monthLabel)}</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <button class="chip2" id="db-prev-m">‹</button>
      <input type="month" id="db-month-picker" value="${R.m}" style="padding:5px 8px;width:150px;font-size:13px;border-radius:8px">
      <button class="chip2" id="db-next-m">›</button>
      <button class="ghost" id="db-curr-m" style="padding:5px 10px;font-size:12px">Current Month</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:0;width:100%">
    <div class="kpi ${R.kpiFilter === 'paid' ? 'on' : ''}" id="kpi-paid" style="cursor:pointer;border:1px solid ${R.kpiFilter === 'paid' ? '#22c55e' : 'transparent'};border-radius:10px;padding:12px 14px">
      <small style="color:#22c55e">✓ PAID BOOTHS</small>
      <b style="color:#22c55e">${countPaid}</b>
      <small style="color:var(--mu)">Click to filter</small>
    </div>
    <div class="kpi ${R.kpiFilter === 'pending' ? 'on' : ''}" id="kpi-pending" style="cursor:pointer;border:1px solid ${R.kpiFilter === 'pending' ? '#e0b13a' : 'transparent'};border-radius:10px;padding:12px 14px">
      <small style="color:#e0b13a">⏳ PENDING BOOTHS</small>
      <b style="color:#e0b13a">${countPending}</b>
      <small style="color:var(--mu)">Click to filter</small>
    </div>
    <div class="kpi ${R.kpiFilter === 'overdue' ? 'on' : ''}" id="kpi-overdue" style="cursor:pointer;border:1px solid ${R.kpiFilter === 'overdue' ? '#ef4444' : 'transparent'};border-radius:10px;padding:12px 14px">
      <small style="color:#ef4444">⚠️ OVERDUE BOOTHS</small>
      <b style="color:#ef4444">${countOverdue}</b>
      <small style="color:var(--mu)">Click to filter</small>
    </div>
    <div class="kpi ${R.kpiFilter === 'collected' ? 'on' : ''}" id="kpi-collected" style="cursor:pointer;border:1px solid ${R.kpiFilter === 'collected' ? 'var(--gold)' : 'transparent'};border-radius:10px;padding:12px 14px">
      <small style="color:var(--gold)">💰 TOTAL COLLECTED</small>
      <b style="color:var(--gold)">${money(totalCollected)}</b>
      <small style="color:var(--mu)">Click to filter</small>
    </div>
  </div>
</div>

<!-- SECTION 1: SEARCH & FILTERS -->
<div class="tbar" id="pl-filters">
  <input id="rf-q" placeholder="Search active booth code, teller, municipality, barangay…" value="${esc(R.q)}" style="flex:2;min-width:180px">
  <select id="rf-muni" style="min-width:140px">
    <option value="">All Municipalities</option>
    ${muniList.map(m => `<option value="${esc(m)}"${m === R.muni ? " selected" : ""}>${esc(m)}</option>`).join("")}
  </select>
  <select id="rf-brgy" style="min-width:140px">
    <option value="">All Barangays</option>
    ${brgyList.map(b => `<option value="${esc(b)}"${b === R.brgy ? " selected" : ""}>${esc(b)}</option>`).join("")}
  </select>
  <select id="rf-status" style="min-width:120px">
    <option value="">All Statuses</option>
    <option value="paid"${R.statusFilter === "paid" ? " selected" : ""}>Paid</option>
    <option value="pending"${R.statusFilter === "pending" ? " selected" : ""}>Pending</option>
    <option value="overdue"${R.statusFilter === "overdue" ? " selected" : ""}>Overdue</option>
  </select>
  <button class="ghost" id="rf-clear" style="padding:6px 12px;font-size:12px">Clear</button>
  <span class="chip">${filtered.length} active booth${filtered.length === 1 ? "" : "s"}</span>
</div>

<!-- SECTION 1: DATA GRID -->
<div class="tw" id="rf-table">
  ${filtered.length === 0 ? `
    <div class="empty">
      <b>No Active Booths Found</b><br>
      ${ACTIVE_BOOTHS.length === 0 ? "No active booth records in Master Registry. Please ensure outlets have status 'ACTIVE'." : "Try adjusting your search or filters."}
    </div>` : `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Booth Code</th>
          <th>Teller / SR Name</th>
          <th>Municipality</th>
          <th>Barangay</th>
          <th>Status (${esc(monthLabel)})</th>
          <th>Amount Paid</th>
          <th>Date Paid</th>
          <th>Next Due Date</th>
          <th>Receipt</th>
          <th style="width:140px;text-align:right">Action</th>
        </tr>
      </thead>
      <tbody>
      ${pg.slice.map((r, i) => {
        const rowNum = (pg.st.page - 1) * pg.st.size + i + 1;
        const p = r.payment;
        const attachCount = p && p.attachments ? p.attachments.length : 0;
        const stPill = r.status === "paid"
          ? `<span class="pill" style="background:#22c55e">Paid</span>`
          : r.status === "overdue"
          ? `<span class="pill" style="background:#ef4444">Overdue</span>`
          : `<span class="pill" style="background:#e0b13a">Pending</span>`;
        return `
          <tr data-booth="${esc(r.booth_code)}">
            <td style="color:var(--mu);font-size:12px">${rowNum}</td>
            <td>
              <a href="#" class="booth-link" data-booth="${esc(r.booth_code)}" style="font-weight:700;color:var(--gold);text-decoration:underline">
                ${esc(r.booth_code)}
              </a>
            </td>
            <td>${esc(r.sr_name || "—")}</td>
            <td>${MU()[r.municipality] ? `<span class="pill" style="background:${MU()[r.municipality][1]}">${MU()[r.municipality][0]}</span>` : esc(r.municipality || "—")}</td>
            <td>${esc(r.barangay || "—")}</td>
            <td>${stPill}</td>
            <td style="font-weight:600">${p ? money(p.amount) : "—"}</td>
            <td style="font-size:12px">${p ? fd(p.date_paid) : "—"}</td>
            <td style="font-size:12px">${p ? fd(p.next_due_date) : "—"}</td>
            <td>
              ${attachCount > 0 ? `<button class="ghost" data-view-rec="${esc(p.id)}" style="padding:3px 8px;font-size:11px" title="View A.R. Receipt">📎 ${attachCount}</button>` : `<span style="color:var(--mu)">—</span>`}
            </td>
            <td style="text-align:right;white-space:nowrap">
              <button class="ghost" data-booth="${esc(r.booth_code)}" style="padding:5px 10px;font-size:12px">
                Manage Payments →
              </button>
            </td>
          </tr>
        `;
      }).join("")}
      </tbody>
    </table>
  `}
</div>
${filtered.length > 0 ? pg.bar : ""}
`;

  // Wire Top Tabs
  const tb = v.querySelector("#tab-booths"), ti = v.querySelector("#tab-inventory");
  if (tb) tb.onclick = () => { R.tab = "booths"; rent(v); };
  if (ti) ti.onclick = () => { R.tab = "inventory"; rent(v); };

  // Wire Dashboard Month Controls
  const stepMonth = k => {
    let [y, m] = R.m.split("-").map(Number);
    m += k;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    R.m = y + "-" + String(m).padStart(2, "0");
    PAGER.reset("rent_active_booths");
    rent(v);
  };
  const prevM = v.querySelector("#db-prev-m"), nextM = v.querySelector("#db-next-m"), currM = v.querySelector("#db-curr-m"), mp = v.querySelector("#db-month-picker");
  if (prevM) prevM.onclick = () => stepMonth(-1);
  if (nextM) nextM.onclick = () => stepMonth(1);
  if (currM) currM.onclick = () => { R.m = iso(new Date()).slice(0, 7); PAGER.reset("rent_active_booths"); rent(v); };
  if (mp) mp.onchange = e => { if (e.target.value) { R.m = e.target.value; PAGER.reset("rent_active_booths"); rent(v); } };

  // Wire KPI Clickable Cards
  const toggleKpi = filterVal => {
    R.kpiFilter = R.kpiFilter === filterVal ? "" : filterVal;
    PAGER.reset("rent_active_booths");
    renderList(v);
  };
  const kp = v.querySelector("#kpi-paid"), kpen = v.querySelector("#kpi-pending"), ko = v.querySelector("#kpi-overdue"), kc = v.querySelector("#kpi-collected");
  if (kp) kp.onclick = () => toggleKpi("paid");
  if (kpen) kpen.onclick = () => toggleKpi("pending");
  if (ko) ko.onclick = () => toggleKpi("overdue");
  if (kc) kc.onclick = () => toggleKpi("collected");

  // Wire Filter Inputs
  const qInp = v.querySelector("#rf-q");
  if (qInp) {
    qInp.oninput = e => {
      R.q = e.target.value;
      PAGER.reset("rent_active_booths");
      renderList(v);
      const n = v.querySelector("#rf-q");
      if (n) { n.focus(); n.setSelectionRange(R.q.length, R.q.length); }
    };
  }
  const muniSel = v.querySelector("#rf-muni");
  if (muniSel) muniSel.onchange = e => { R.muni = e.target.value; R.brgy = ""; PAGER.reset("rent_active_booths"); renderList(v); };

  const brgySel = v.querySelector("#rf-brgy");
  if (brgySel) brgySel.onchange = e => { R.brgy = e.target.value; PAGER.reset("rent_active_booths"); renderList(v); };

  const stSel = v.querySelector("#rf-status");
  if (stSel) stSel.onchange = e => { R.statusFilter = e.target.value; R.kpiFilter = ""; PAGER.reset("rent_active_booths"); renderList(v); };

  const clrBtn = v.querySelector("#rf-clear");
  if (clrBtn) clrBtn.onclick = () => {
    R.q = ""; R.muni = ""; R.brgy = ""; R.statusFilter = ""; R.kpiFilter = "";
    PAGER.reset("rent_active_booths");
    renderList(v);
  };

  // Wire Pager correctly to container v!
  PAGER.bind(v, pg.st, () => renderList(v));

  // Wire Booth Clicks -> Open Detail Page
  v.querySelectorAll("[data-booth]").forEach(b => {
    b.onclick = e => {
      e.preventDefault();
      const code = b.dataset.booth;
      if (code) {
        R.boothCode = code;
        R.view = "detail";
        renderDetail(v);
      }
    };
  });

  // Wire Receipt View in List
  v.querySelectorAll("[data-view-rec]").forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      const payId = b.dataset.viewRec;
      const pay = MONTH_PAYMENTS.find(p => p.id === payId);
      if (pay && pay.attachments && pay.attachments.length) {
        viewAttachmentsDialog(pay.attachments);
      }
    };
  });
}

// -------------------------------------------------------------------------
// TAB 1: INDIVIDUAL BOOTH MONTHLY PAYMENT DETAIL VIEW
// -------------------------------------------------------------------------
async function renderDetail(v) {
  const code = R.boothCode;
  const boothInfo = ACTIVE_BOOTHS.find(b => b.booth_code === code) || { booth_code: code };
  const allPayments = await fetchAllBoothPayments(code);
  const today = iso(new Date());

  // Filter payments by selected calendar year
  const calYear = R.calYear;

  // Build map of month (1-12) to payments in calYear
  const monthPayMap = new Map();
  allPayments.forEach(p => {
    if (p.payment_period && p.payment_period.startsWith(String(calYear) + "-")) {
      const mNum = parseInt(p.payment_period.split("-")[1], 10);
      monthPayMap.set(mNum, p);
    }
  });

  // 12 Months Cards HTML
  const monthsHtml = MN.map((mName, idx) => {
    const mNum = idx + 1;
    const periodStr = `${calYear}-${String(mNum).padStart(2, "0")}`;
    const p = monthPayMap.get(mNum);
    const isCurrentMonth = today.slice(0, 7) === periodStr;
    const isPastMonth = today.slice(0, 7) > periodStr;

    let cardStatus = "norecord";
    let statusLabel = "No Record";
    let statusColor = "var(--mu)";
    let bgTint = "rgba(255,255,255,0.02)";

    if (p) {
      cardStatus = "paid";
      statusLabel = "Paid";
      statusColor = "#22c55e";
      bgTint = "rgba(34,197,94,0.08)";
    } else if (isPastMonth) {
      cardStatus = "overdue";
      statusLabel = "Overdue";
      statusColor = "#ef4444";
      bgTint = "rgba(239,68,68,0.08)";
    } else if (isCurrentMonth) {
      cardStatus = "pending";
      statusLabel = "Pending";
      statusColor = "#e0b13a";
      bgTint = "rgba(224,177,58,0.08)";
    }

    const attachCount = p && p.attachments ? p.attachments.length : 0;

    return `
      <div class="month-card" data-period="${periodStr}" data-mname="${mName}" style="
        background:${bgTint};
        border:1px solid ${p ? '#22c55e' : isPastMonth ? 'rgba(239,68,68,0.4)' : isCurrentMonth ? 'rgba(224,177,58,0.5)' : 'var(--line)'};
        border-radius:12px;
        padding:14px;
        cursor:pointer;
        transition:all 0.18s ease;
        position:relative;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <b style="font-size:14.5px;color:#fff">${mName}</b>
          <span class="pill" style="background:${statusColor};font-size:11px">${statusLabel}</span>
        </div>
        <div style="font-size:13px;margin-bottom:4px">
          ${p ? `<span style="font-size:15px;font-weight:700;color:var(--gold)">${money(p.amount)}</span>` : `<span style="color:var(--mu);font-size:12px">No payment recorded</span>`}
        </div>
        <div style="font-size:11.5px;color:var(--mu);min-height:16px">
          ${p ? `Paid: ${fd(p.date_paid)}` : `Period: ${periodStr}`}
        </div>
        <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:11px">
          ${attachCount > 0 ? `<span style="color:#22c55e">📎 ${attachCount} Receipt${attachCount > 1 ? "s" : ""}</span>` : `<span style="color:var(--mu)">No attachment</span>`}
          <span style="color:var(--gold);font-size:12px">Edit →</span>
        </div>
      </div>
    `;
  }).join("");

  v.innerHTML = `
<div class="tbar" style="margin-bottom:12px">
  <button class="ghost" id="bd-back" style="padding:7px 14px;font-size:13px">← Back to Active Booths</button>
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <b style="font-size:18px;color:var(--gold)">BOOTH CODE: ${esc(code)}</b>
    ${boothInfo.sr_name ? `<span class="chip">Teller: ${esc(boothInfo.sr_name)}</span>` : ""}
    ${boothInfo.municipality ? `<span class="chip">${esc(boothInfo.municipality)}</span>` : ""}
    ${boothInfo.barangay ? `<span class="chip">${esc(boothInfo.barangay)}</span>` : ""}
    <span class="pill" style="background:#22c55e">ACTIVE</span>
  </div>
</div>

<!-- SECTION 2: MONTHLY PAYMENT CALENDAR -->
<div class="box" style="margin-bottom:18px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px">
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
    <div>
      <div style="font-size:16px;font-weight:700">📅 Monthly Payment Calendar</div>
      <div class="chip" style="margin-top:3px">January – December layout. Select any month to create, view, or manage its payment record.</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <button class="chip2" id="yr-prev">‹</button>
      <b style="font-size:16px;min-width:60px;text-align:center">${calYear}</b>
      <button class="chip2" id="yr-next">›</button>
      <button class="ghost" id="yr-curr" style="padding:4px 10px;font-size:12px">Current Year</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;width:100%">
    ${monthsHtml}
  </div>
</div>

<!-- SECTION 5: MONTHLY PAYMENT HISTORY -->
<div class="box" style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <b style="font-size:16px">📜 Payment History — ${esc(code)}</b>
    <span class="chip">${allPayments.length} recorded payment${allPayments.length === 1 ? "" : "s"}</span>
  </div>

  ${allPayments.length === 0 ? `
    <div class="empty">No payment records saved for this booth yet. Click any month in the calendar above to record a payment.</div>
  ` : `
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>Payment Period</th>
            <th>Description</th>
            <th>Amount</th>
            <th>Date Paid</th>
            <th>Next Due Date</th>
            <th>Receipt / Attachment</th>
            <th>Status</th>
            <th>Remarks</th>
            <th style="width:100px;text-align:right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${allPayments.map(p => {
            const attachCount = p.attachments ? p.attachments.length : 0;
            const isDueSoon = p.next_due_date && today <= p.next_due_date && (new Date(p.next_due_date) - new Date(today)) / 864e5 <= 7;
            const isPastDue = p.next_due_date && today > p.next_due_date;
            const dueBadge = isPastDue
              ? `<small style="color:#ef4444;display:block">Overdue</small>`
              : isDueSoon
              ? `<small style="color:#06b6d4;display:block">Due Soon</small>`
              : "";
            return `
              <tr>
                <td><b>${esc(p.payment_period)}</b></td>
                <td>${esc(p.payment_description || "Rent Fee")}</td>
                <td style="font-weight:700;color:var(--gold)">${money(p.amount)}</td>
                <td style="font-size:12px">${fd(p.date_paid)}</td>
                <td style="font-size:12px">
                  ${fd(p.next_due_date)}
                  ${dueBadge}
                </td>
                <td>
                  ${attachCount > 0 ? `
                    <button class="ghost" data-view-rec="${esc(p.id)}" style="padding:3px 8px;font-size:11px">
                      📎 View (${attachCount})
                    </button>
                  ` : `<span style="color:var(--mu)">No receipt</span>`}
                </td>
                <td><span class="pill" style="background:#22c55e">Paid</span></td>
                <td style="font-size:12px;color:var(--mu)">${esc(p.remarks || "—")}</td>
                <td style="text-align:right;white-space:nowrap">
                  <button class="ghost" data-edit-pay="${esc(p.id)}" style="padding:4px 9px;font-size:12px">Edit</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `}
</div>
`;

  // Wire Back Button
  const bkB = v.querySelector("#bd-back");
  if (bkB) bkB.onclick = () => { R.view = "list"; R.boothCode = null; renderList(v); };

  // Wire Calendar Year Navigation
  const yp = v.querySelector("#yr-prev"), yn = v.querySelector("#yr-next"), yc = v.querySelector("#yr-curr");
  if (yp) yp.onclick = () => { R.calYear--; renderDetail(v); };
  if (yn) yn.onclick = () => { R.calYear++; renderDetail(v); };
  if (yc) yc.onclick = () => { R.calYear = new Date().getFullYear(); renderDetail(v); };

  // Wire Month Card Clicks -> Open Payment Entry Form
  v.querySelectorAll(".month-card").forEach(mc => {
    mc.onclick = () => {
      const period = mc.dataset.period;
      const mName = mc.dataset.mname;
      const existingPay = allPayments.find(p => p.payment_period === period);
      openPaymentDialog(code, period, mName, existingPay, v);
    };
  });

  // Wire Edit Payment in History
  v.querySelectorAll("[data-edit-pay]").forEach(b => {
    b.onclick = () => {
      const payId = b.dataset.editPay;
      const existingPay = allPayments.find(p => p.id === payId);
      if (existingPay) {
        const [y, m] = existingPay.payment_period.split("-").map(Number);
        const mName = MN[m - 1];
        openPaymentDialog(code, existingPay.payment_period, mName, existingPay, v);
      }
    };
  });

  // Wire View Receipt in History
  v.querySelectorAll("[data-view-rec]").forEach(b => {
    b.onclick = () => {
      const payId = b.dataset.viewRec;
      const pay = allPayments.find(p => p.id === payId);
      if (pay && pay.attachments && pay.attachments.length) {
        viewAttachmentsDialog(pay.attachments);
      }
    };
  });
}

// -------------------------------------------------------------------------
// SECTION 2, 3, 4: PAYMENT ENTRY / EDIT MODAL & CONFIRMATION FLOWS
// -------------------------------------------------------------------------
function openPaymentDialog(boothCode, periodStr, monthName, existingPay, v) {
  const isNew = !existingPay;
  const today = iso(new Date());
  const initialDatePaid = existingPay ? existingPay.date_paid : today;
  const initialDueDate = existingPay ? existingPay.next_due_date : calcNextDueDate(initialDatePaid);
  const initialDesc = existingPay ? existingPay.payment_description : "Rent Fee";
  const isStandardDesc = initialDesc === "Rent Fee" || initialDesc === "POS LOAD 1 MONTH";

  let stagedFiles = [];
  let existingAttachments = existingPay && existingPay.attachments ? [...existingPay.attachments] : [];
  let manualDueDate = existingPay ? !!existingPay.due_date_override : false;
  let formDirty = false;

  const d = document.createElement("dialog");
  d.style.cssText = "max-width:540px;width:95vw;border-radius:16px;border:1px solid var(--line);background:var(--panel);color:var(--tx);padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.7)";

  d.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
  <div>
    <h3 style="margin:0;font-size:17px;color:#fff">${isNew ? "Record Payment" : "Edit Payment Record"}</h3>
    <div class="chip" style="margin-top:3px">Booth <b>${esc(boothCode)}</b> · Period <b>${esc(monthName)} ${esc(periodStr.slice(0, 4))}</b></div>
  </div>
  <button class="ghost" id="dlg-x" style="padding:4px 9px;font-size:12px">✕</button>
</div>

<div class="g2" style="gap:10px 14px">
  <div style="grid-column:span 2">
    <label>Payment Description</label>
    <select id="pf-desc" style="width:100%">
      <option value="Rent Fee"${initialDesc === "Rent Fee" ? " selected" : ""}>Rent Fee</option>
      <option value="POS LOAD 1 MONTH"${initialDesc === "POS LOAD 1 MONTH" ? " selected" : ""}>POS LOAD 1 MONTH</option>
      <option value="Other"${!isStandardDesc ? " selected" : ""}>Other (custom description)</option>
    </select>
    <input id="pf-desc-custom" placeholder="Enter custom description…" value="${!isStandardDesc ? esc(initialDesc) : ""}" style="margin-top:6px;display:${!isStandardDesc ? "block" : "none"}">
  </div>

  <div>
    <label>Amount (₱)</label>
    <input type="number" id="pf-amount" step="0.01" min="0" inputmode="decimal" placeholder="0.00" value="${existingPay ? existingPay.amount : ""}">
  </div>

  <div>
    <label>Date Paid</label>
    <input type="date" id="pf-date-paid" value="${initialDatePaid}">
  </div>

  <div>
    <label>Payment Period</label>
    <input type="text" id="pf-period" value="${esc(periodStr)}" readonly style="opacity:0.8;background:rgba(0,0,0,0.2)">
  </div>

  <div>
    <label>Next Due Date <small style="color:var(--mu)">(Auto-calculated +1 mo)</small></label>
    <input type="date" id="pf-due-date" value="${initialDueDate}">
  </div>

  <div style="grid-column:span 2">
    <label>Remarks / Notes <small style="color:var(--mu)">(optional)</small></label>
    <input type="text" id="pf-remarks" placeholder="Add remarks…" value="${esc(existingPay ? existingPay.remarks || "" : "")}">
  </div>
</div>

<!-- SECTION 4: ACKNOWLEDGEMENT RECEIPT (A.R.) UPLOAD -->
<div style="margin-top:14px">
  <label style="display:flex;justify-content:space-between;align-items:center">
    <span>Acknowledgement Receipt (A.R.)</span>
    <small style="color:var(--mu)">JPG, PNG, PDF up to 20MB</small>
  </label>
  <div id="pf-dropzone" style="
    border:2px dashed var(--line);
    border-radius:12px;
    padding:16px;
    text-align:center;
    background:rgba(0,0,0,0.18);
    cursor:pointer;
    transition:border-color 0.2s;
  ">
    <div style="font-size:22px;margin-bottom:4px">📎</div>
    <div style="font-size:13px;font-weight:600">Click to browse, drag &amp; drop, or press Ctrl+V to paste</div>
    <div style="font-size:11.5px;color:var(--mu);margin-top:2px">Proof of payment on recorded date</div>
    <input type="file" id="pf-file-inp" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden>
  </div>

  <div id="pf-file-list" style="margin-top:8px;display:flex;flex-direction:column;gap:6px"></div>
</div>

<div class="msg" id="pf-msg" style="margin-top:10px;text-align:left"></div>

<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;align-items:center">
  <button class="btn" id="pf-save-btn" style="width:auto;padding:10px 22px;margin:0">Save</button>
  <button class="ghost" id="pf-cancel-btn">Cancel</button>
  ${!isNew && adm() ? `<button class="ghost" id="pf-del-btn" style="margin-left:auto;color:#ef4444;border-color:#ef4444">Delete Record</button>` : ""}
</div>
`;

  document.body.appendChild(d);
  d.showModal();

  const msg = d.querySelector("#pf-msg");
  const descSel = d.querySelector("#pf-desc");
  const descCust = d.querySelector("#pf-desc-custom");
  const amtInp = d.querySelector("#pf-amount");
  const dpInp = d.querySelector("#pf-date-paid");
  const ddInp = d.querySelector("#pf-due-date");
  const remInp = d.querySelector("#pf-remarks");
  const dropzone = d.querySelector("#pf-dropzone");
  const fileInp = d.querySelector("#pf-file-inp");
  const fileListEl = d.querySelector("#pf-file-list");

  // Track changes for Cancel confirmation
  [descSel, descCust, amtInp, dpInp, ddInp, remInp].forEach(el => {
    if (el) el.addEventListener("input", () => { formDirty = true; });
  });

  // Description change
  descSel.onchange = () => {
    formDirty = true;
    descCust.style.display = descSel.value === "Other" ? "block" : "none";
    if (descSel.value === "Other") descCust.focus();
  };

  // Date Paid -> Auto-calculate Next Due Date
  dpInp.oninput = () => {
    formDirty = true;
    if (!manualDueDate && dpInp.value) {
      ddInp.value = calcNextDueDate(dpInp.value);
    }
  };
  ddInp.oninput = () => {
    manualDueDate = true;
    formDirty = true;
  };

  // Render Attached Files list
  const renderFiles = () => {
    fileListEl.innerHTML = "";
    // Existing Attachments
    existingAttachments.forEach((att, idx) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.04);padding:6px 10px;border-radius:8px;font-size:12px;border:1px solid var(--line)";
      row.innerHTML = `
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px">
          📄 ${esc(att.file_name || "Attachment")}
        </span>
        <div style="display:flex;gap:6px">
          <button class="ghost" data-view-idx="${idx}" style="padding:2px 7px;font-size:11px">View</button>
          <button class="ghost" data-del-idx="${idx}" style="padding:2px 7px;font-size:11px;color:#ef4444;border-color:#ef4444">✕</button>
        </div>
      `;
      row.querySelector("[data-view-idx]").onclick = async () => {
        const u = await signedUrl(att.storage_path);
        if (u) window.open(u, "_blank");
      };
      row.querySelector("[data-del-idx]").onclick = () => {
        formDirty = true;
        existingAttachments.splice(idx, 1);
        renderFiles();
      };
      fileListEl.appendChild(row);
    });

    // Staged New Files
    stagedFiles.forEach((f, idx) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:rgba(224,177,58,0.08);padding:6px 10px;border-radius:8px;font-size:12px;border:1px solid rgba(224,177,58,0.3)";
      row.innerHTML = `
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px">
          📎 <b>[New]</b> ${esc(f.name)} <small style="color:var(--mu)">(${(f.size / 1024).toFixed(0)} KB)</small>
        </span>
        <button class="ghost" data-rem-staged="${idx}" style="padding:2px 7px;font-size:11px;color:#ef4444;border-color:#ef4444">✕</button>
      `;
      row.querySelector("[data-rem-staged]").onclick = () => {
        stagedFiles.splice(idx, 1);
        renderFiles();
      };
      fileListEl.appendChild(row);
    });
  };
  renderFiles();

  // Add files helper
  const addFiles = fileArr => {
    for (const f of fileArr) {
      if (f.size > 20 * 1048576) {
        msg.textContent = `File "${f.name}" exceeds 20 MB limit.`;
        continue;
      }
      stagedFiles.push(f);
      formDirty = true;
    }
    renderFiles();
  };

  // Upload handlers
  dropzone.onclick = () => fileInp.click();
  fileInp.onchange = e => {
    if (e.target.files && e.target.files.length) {
      addFiles([...e.target.files]);
      fileInp.value = "";
    }
  };

  dropzone.ondragover = e => { e.preventDefault(); dropzone.style.borderColor = "var(--gold)"; };
  dropzone.ondragleave = () => { dropzone.style.borderColor = "var(--line)"; };
  dropzone.ondrop = e => {
    e.preventDefault();
    dropzone.style.borderColor = "var(--line)";
    if (e.dataTransfer && e.dataTransfer.files) addFiles([...e.dataTransfer.files]);
  };

  // Ctrl+V Paste handler inside dialog
  const pasteHandler = e => {
    if (!d.open) return;
    const items = [...(e.clipboardData?.files || [])];
    if (items.length) {
      e.preventDefault();
      addFiles(items);
    }
  };
  document.addEventListener("paste", pasteHandler);

  const cleanClose = () => {
    document.removeEventListener("paste", pasteHandler);
    d.close();
    d.remove();
  };

  // SECTION 3: CANCEL BUTTON & CONFIRMATION
  const cancelAction = () => {
    if (!formDirty && stagedFiles.length === 0) {
      cleanClose();
      return;
    }
    const cDlg = document.createElement("dialog");
    cDlg.style.cssText = "max-width:380px;width:90vw;border-radius:14px;border:1px solid var(--line);background:var(--panel);color:var(--tx);padding:20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.8)";
    cDlg.innerHTML = `
      <h4 style="margin:0 0 8px;font-size:16px;color:#fff">Discard Unsaved Changes?</h4>
      <p style="font-size:13.5px;color:var(--mu);margin:0 0 16px;line-height:1.45">Are you sure you want to cancel? Any unsaved changes will be discarded.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="ghost" id="cd-yes" style="color:#ef4444;border-color:#ef4444;padding:8px 16px">Yes, Cancel</button>
        <button class="btn" id="cd-no" style="width:auto;padding:8px 16px;margin:0">Continue Editing</button>
      </div>
    `;
    document.body.appendChild(cDlg);
    cDlg.showModal();
    cDlg.querySelector("#cd-yes").onclick = () => { cDlg.close(); cDlg.remove(); cleanClose(); };
    cDlg.querySelector("#cd-no").onclick = () => { cDlg.close(); cDlg.remove(); };
  };

  d.querySelector("#dlg-x").onclick = cancelAction;
  d.querySelector("#pf-cancel-btn").onclick = cancelAction;

  // SECTION 3: SAVE BUTTON & CONFIRMATION
  d.querySelector("#pf-save-btn").onclick = () => {
    const finalDesc = descSel.value === "Other" ? descCust.value.trim() : descSel.value;
    const amountVal = parseFloat(amtInp.value);
    const datePaidVal = dpInp.value;
    const dueDateVal = ddInp.value;

    if (!finalDesc) { msg.textContent = "Please enter a payment description."; return; }
    if (isNaN(amountVal) || amountVal <= 0) { msg.textContent = "Please enter a valid payment amount greater than 0."; return; }
    if (!datePaidVal) { msg.textContent = "Please choose the date paid."; return; }
    if (!dueDateVal) { msg.textContent = "Please provide the next due date."; return; }

    // Confirm Save Dialog
    const sDlg = document.createElement("dialog");
    sDlg.style.cssText = "max-width:420px;width:90vw;border-radius:14px;border:1px solid var(--line);background:var(--panel);color:var(--tx);padding:22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.8)";
    sDlg.innerHTML = `
      <div style="font-size:28px;margin-bottom:6px">📋</div>
      <h4 style="margin:0 0 8px;font-size:16px;color:#fff">Confirm Payment Record</h4>
      <p style="font-size:13px;color:var(--mu);margin:0 0 14px;line-height:1.45">
        Are you sure you want to save this payment record? Please verify the amount, payment date, and attached acknowledgement receipt before proceeding.
      </p>
      <div style="text-align:left;background:rgba(0,0,0,0.25);padding:10px 14px;border-radius:8px;font-size:12.5px;margin-bottom:16px">
        <div>Booth: <b>${esc(boothCode)}</b></div>
        <div>Description: <b>${esc(finalDesc)}</b></div>
        <div>Amount: <b style="color:var(--gold)">${money(amountVal)}</b></div>
        <div>Date Paid: <b>${fd(datePaidVal)}</b></div>
        <div>Next Due Date: <b>${fd(dueDateVal)}</b></div>
        <div>Receipts: <b>${existingAttachments.length + stagedFiles.length} file(s)</b></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn" id="sd-confirm" style="width:auto;padding:9px 20px;margin:0">Confirm Save</button>
        <button class="ghost" id="sd-back" style="padding:9px 16px">Go Back</button>
      </div>
    `;
    document.body.appendChild(sDlg);
    sDlg.showModal();

    sDlg.querySelector("#sd-back").onclick = () => { sDlg.close(); sDlg.remove(); };

    sDlg.querySelector("#sd-confirm").onclick = async () => {
      sDlg.close();
      sDlg.remove();

      const saveBtn = d.querySelector("#pf-save-btn");
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      msg.style.color = "var(--gold)";
      msg.textContent = "Saving payment record…";

      try {
        const payload = {
          booth_code: boothCode,
          payment_description: finalDesc,
          amount: amountVal,
          date_paid: datePaidVal,
          payment_period: periodStr,
          next_due_date: dueDateVal,
          due_date_override: manualDueDate,
          remarks: remInp.value.trim() || null,
          status: "Paid",
          updated_at: new Date().toISOString()
        };

        let paymentId = existingPay ? existingPay.id : null;

        if (isNew) {
          payload.created_by = me ? me.id : null;
          const { data: ins, error: insErr } = await sb
            .from("booth_payments")
            .insert(payload)
            .select()
            .single();
          if (insErr) throw insErr;
          paymentId = ins.id;
        } else {
          const { error: upErr } = await sb
            .from("booth_payments")
            .update(payload)
            .eq("id", paymentId);
          if (upErr) throw upErr;
        }

        // Upload any staged new attachments
        if (stagedFiles.length > 0) {
          msg.textContent = `Uploading ${stagedFiles.length} receipt attachment(s)…`;
          for (const file of stagedFiles) {
            const ext = file.name.split(".").pop().toLowerCase() || "jpg";
            const storagePath = `${boothCode}/${periodStr}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const { error: upErr } = await sb.storage
              .from(BUCKET)
              .upload(storagePath, file, { contentType: file.type });
            if (upErr) {
              console.warn("Receipt upload issue:", upErr);
            }
            await sb.from("booth_payment_attachments").insert({
              payment_id: paymentId,
              booth_code: boothCode,
              storage_path: storagePath,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              uploaded_by: me ? me.id : null
            });
          }
        }

        // Remove deleted attachments from DB & Storage
        if (existingPay && existingPay.attachments) {
          const keptIds = new Set(existingAttachments.map(a => a.id));
          const toRemove = existingPay.attachments.filter(a => !keptIds.has(a.id));
          for (const rem of toRemove) {
            await sb.storage.from(BUCKET).remove([rem.storage_path]);
            await sb.from("booth_payment_attachments").delete().eq("id", rem.id);
          }
        }

        cleanClose();
        alert("Payment record successfully saved!");
        rent(v);
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
        msg.style.color = "#ff8b9b";
        msg.textContent = "Could not save payment: " + (err?.message || String(err));
      }
    };
  };

  // Delete Record Handler (Admin Only)
  const delBtn = d.querySelector("#pf-del-btn");
  if (delBtn) {
    delBtn.onclick = async () => {
      if (!confirm("Permanently delete this payment record and all attached receipts?")) return;
      delBtn.disabled = true;
      msg.textContent = "Deleting…";
      try {
        if (existingAttachments.length > 0) {
          await sb.storage.from(BUCKET).remove(existingAttachments.map(a => a.storage_path));
        }
        const { error: delErr } = await sb
          .from("booth_payments")
          .delete()
          .eq("id", existingPay.id);
        if (delErr) throw delErr;
        cleanClose();
        alert("Payment record deleted.");
        rent(v);
      } catch (e) {
        delBtn.disabled = false;
        msg.style.color = "#ff8b9b";
        msg.textContent = "Could not delete: " + (e?.message || String(e));
      }
    };
  }
}

// -------------------------------------------------------------------------
// SECTION 4: ATTACHMENTS VIEW DIALOG
// -------------------------------------------------------------------------
function viewAttachmentsDialog(attachments) {
  const d = document.createElement("dialog");
  d.style.cssText = "max-width:560px;width:95vw;border-radius:14px;border:1px solid var(--line);background:var(--panel);color:var(--tx);padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.8)";
  d.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h4 style="margin:0;font-size:16px;color:#fff">📎 Acknowledgement Receipts (${attachments.length})</h4>
      <button class="ghost" id="vd-close" style="padding:4px 9px;font-size:12px">✕</button>
    </div>
    <div id="vd-list" style="display:flex;flex-direction:column;gap:12px;max-height:65vh;overflow-y:auto">
      <div class="spin" style="margin:20px auto"></div>
    </div>
  `;
  document.body.appendChild(d);
  d.showModal();

  d.querySelector("#vd-close").onclick = () => { d.close(); d.remove(); };

  (async () => {
    const listEl = d.querySelector("#vd-list");
    const itemsHtml = await Promise.all(attachments.map(async att => {
      const u = await signedUrl(att.storage_path);
      const isImg = !att.file_type || /^image\//.test(att.file_type);
      return `
        <div style="border:1px solid var(--line);border-radius:10px;padding:10px;background:rgba(0,0,0,0.25)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <b style="font-size:13px">${esc(att.file_name || "Receipt")}</b>
            ${u ? `<a href="${u}" target="_blank" download="${esc(att.file_name || 'receipt')}" class="btn" style="width:auto;padding:4px 10px;font-size:11px;margin:0">Download</a>` : ""}
          </div>
          ${isImg && u ? `
            <div style="text-align:center;background:#050d24;border-radius:8px;padding:6px">
              <a href="${u}" target="_blank">
                <img src="${u}" alt="${esc(att.file_name)}" style="max-width:100%;max-height:280px;object-fit:contain;border-radius:6px">
              </a>
            </div>
          ` : `
            <div style="padding:16px;text-align:center;color:var(--mu);font-size:13px">
              Document attachment (PDF / file). <a href="${u}" target="_blank" style="color:var(--gold);text-decoration:underline">Click to open &amp; view</a>
            </div>
          `}
        </div>
      `;
    }));
    listEl.innerHTML = itemsHtml.join("");
  })();
}

// -------------------------------------------------------------------------
// SECTION 6: INVENTORY MANAGEMENT
// -------------------------------------------------------------------------
function renderInventory(v) {
  // Map existing quantities or default to 0
  const invMap = new Map();
  INVENTORY_DATA.forEach(item => {
    invMap.set(`${item.category}_${item.equipment_type}`, item);
  });

  const getQty = (cat, eq) => {
    const it = invMap.get(`${cat}_${eq}`);
    return it && Number.isInteger(it.quantity) ? it.quantity : 0;
  };

  // Categories quantities
  const activeCell = getQty("active", "cellphone");
  const activePrint = getQty("active", "printer");
  const activePos = getQty("active", "pos");
  const activeTotal = activeCell + activePrint + activePos;

  const resCell = getQty("reserve", "cellphone");
  const resPrint = getQty("reserve", "printer");
  const resPos = getQty("reserve", "pos");
  const resTotal = resCell + resPrint + resPos;

  const repCell = getQty("repair", "cellphone");
  const repPrint = getQty("repair", "printer");
  const repPos = getQty("repair", "pos");
  const repTotal = repCell + repPrint + repPos;

  // Combined Totals
  const totalCellphones = activeCell + resCell + repCell;
  const totalPrinters = activePrint + resPrint + repPrint;
  const totalPos = activePos + resPos + repPos;
  const grandTotal = totalCellphones + totalPrinters + totalPos;

  v.innerHTML = `
<div class="hdr2">
  <div>
    <div style="font-size:18px;font-weight:700">📦 Equipment Inventory Management</div>
    <div class="chip">Track Cellphones, Portable Printers, and POS units across 3 condition categories</div>
  </div>
  <div style="display:flex;gap:6px;align-items:center">
    <button class="chip2" id="tab-booths">🏢 Booth Payments</button>
    <button class="chip2 on" id="tab-inventory">📦 Equipment Inventory</button>
  </div>
</div>

<!-- INVENTORY DASHBOARD SUMMARY CARDS -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px;width:100%">
  <!-- CARD A: ACTIVE -->
  <div class="box" style="margin:0;background:var(--panel);border:1px solid #22c55e;border-radius:14px;padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <b style="font-size:16px;color:#22c55e">🟢 ACTIVE INVENTORY</b>
      <span class="pill" style="background:#22c55e">${activeTotal} Total</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>📱 Cellphones</span>
        <b style="font-size:16px">${activeCell}</b>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>🖨️ Portable Printers</span>
        <b style="font-size:16px">${activePrint}</b>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>📟 POS Units</span>
        <b style="font-size:16px">${activePos}</b>
      </div>
    </div>
  </div>

  <!-- CARD B: RESERVE / ONHAND -->
  <div class="box" style="margin:0;background:var(--panel);border:1px solid #e0b13a;border-radius:14px;padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <b style="font-size:16px;color:#e0b13a">🟡 RESERVE / ONHAND</b>
      <span class="pill" style="background:#e0b13a">${resTotal} Total</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>📱 Cellphones</span>
        <b style="font-size:16px">${resCell}</b>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>🖨️ Portable Printers</span>
        <b style="font-size:16px">${resPrint}</b>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>📟 POS Units</span>
        <b style="font-size:16px">${resPos}</b>
      </div>
    </div>
  </div>

  <!-- CARD C: DAMAGE / FOR REPAIR -->
  <div class="box" style="margin:0;background:var(--panel);border:1px solid #ef4444;border-radius:14px;padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <b style="font-size:16px;color:#ef4444">🔴 DAMAGE / FOR REPAIR</b>
      <span class="pill" style="background:#ef4444">${repTotal} Total</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:13.5px">
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>📱 Cellphones</span>
        <b style="font-size:16px">${repCell}</b>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>🖨️ Portable Printers</span>
        <b style="font-size:16px">${repPrint}</b>
      </div>
      <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:6px">
        <span>📟 POS Units</span>
        <b style="font-size:16px">${repPos}</b>
      </div>
    </div>
  </div>
</div>

<!-- COMBINED INVENTORY SUMMARY & ACTIONS -->
<div class="box" style="background:linear-gradient(170deg,#10265a,#0a1a3f);border:1px solid var(--gold);border-radius:14px;padding:20px;margin-bottom:16px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
    <div>
      <b style="font-size:17px;color:var(--gold)">📊 Combined Inventory Summary</b>
      <div class="chip" style="margin-top:2px">Automatically calculated from Active, Reserve, and Damage categories</div>
    </div>
    ${sup() ? `<button class="btn" id="inv-edit-btn" style="width:auto;padding:9px 20px;margin:0">✏️ Edit Inventory Quantities</button>` : ""}
  </div>

  <div class="kpis" style="margin:0">
    <div class="kpi">
      <small>TOTAL CELLPHONES</small>
      <b style="color:var(--tx)">${totalCellphones}</b>
      <small style="color:var(--mu)">Active + Reserve + Repair</small>
    </div>
    <div class="kpi">
      <small>TOTAL PRINTERS</small>
      <b style="color:var(--tx)">${totalPrinters}</b>
      <small style="color:var(--mu)">Active + Reserve + Repair</small>
    </div>
    <div class="kpi">
      <small>TOTAL POS UNITS</small>
      <b style="color:var(--tx)">${totalPos}</b>
      <small style="color:var(--mu)">Active + Reserve + Repair</small>
    </div>
    <div class="kpi">
      <small style="color:var(--gold)">GRAND TOTAL EQUIPMENT</small>
      <b style="color:var(--gold)">${grandTotal}</b>
      <small style="color:var(--mu)">All 9 equipment slots</small>
    </div>
  </div>
</div>
`;

  // Wire Top Tabs
  const tb = v.querySelector("#tab-booths"), ti = v.querySelector("#tab-inventory");
  if (tb) tb.onclick = () => { R.tab = "booths"; rent(v); };
  if (ti) ti.onclick = () => { R.tab = "inventory"; rent(v); };

  // Wire Edit Quantities
  const editBtn = v.querySelector("#inv-edit-btn");
  if (editBtn) {
    editBtn.onclick = () => openInventoryEditModal(invMap, v);
  }
}

// Inventory Edit Modal
function openInventoryEditModal(invMap, v) {
  const getQty = (cat, eq) => {
    const it = invMap.get(`${cat}_${eq}`);
    return it && Number.isInteger(it.quantity) ? it.quantity : 0;
  };
  const getRem = (cat, eq) => {
    const it = invMap.get(`${cat}_${eq}`);
    return it && it.remarks ? it.remarks : "";
  };

  const d = document.createElement("dialog");
  d.style.cssText = "max-width:580px;width:95vw;border-radius:16px;border:1px solid var(--line);background:var(--panel);color:var(--tx);padding:22px;box-shadow:0 20px 60px rgba(0,0,0,0.8)";

  d.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
  <h3 style="margin:0;font-size:17px;color:#fff">✏️ Update Equipment Inventory</h3>
  <button class="ghost" id="ie-close" style="padding:4px 9px;font-size:12px">✕</button>
</div>
<div class="chip" style="margin-bottom:14px">Quantities must be whole non-negative numbers (0, 1, 2…).</div>

<div style="display:flex;flex-direction:column;gap:14px;max-height:65vh;overflow-y:auto;padding-right:4px">
  <!-- ACTIVE -->
  <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:12px">
    <b style="color:#22c55e;font-size:14px">ACTIVE INVENTORY</b>
    <div class="g2" style="margin-top:8px;gap:8px 12px">
      <div><label>Cellphone</label><input type="number" id="iq-act-cell" min="0" step="1" value="${getQty('active','cellphone')}"></div>
      <div><label>Portable Printer</label><input type="number" id="iq-act-print" min="0" step="1" value="${getQty('active','printer')}"></div>
      <div><label>POS Unit</label><input type="number" id="iq-act-pos" min="0" step="1" value="${getQty('active','pos')}"></div>
      <div><label>Remarks</label><input type="text" id="ir-act" placeholder="Optional notes…" value="${esc(getRem('active','cellphone'))}"></div>
    </div>
  </div>

  <!-- RESERVE -->
  <div style="background:rgba(224,177,58,0.06);border:1px solid rgba(224,177,58,0.3);border-radius:10px;padding:12px">
    <b style="color:#e0b13a;font-size:14px">RESERVE / ONHAND</b>
    <div class="g2" style="margin-top:8px;gap:8px 12px">
      <div><label>Cellphone</label><input type="number" id="iq-res-cell" min="0" step="1" value="${getQty('reserve','cellphone')}"></div>
      <div><label>Portable Printer</label><input type="number" id="iq-res-print" min="0" step="1" value="${getQty('reserve','printer')}"></div>
      <div><label>POS Unit</label><input type="number" id="iq-res-pos" min="0" step="1" value="${getQty('reserve','pos')}"></div>
      <div><label>Remarks</label><input type="text" id="ir-res" placeholder="Optional notes…" value="${esc(getRem('reserve','cellphone'))}"></div>
    </div>
  </div>

  <!-- DAMAGE -->
  <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px">
    <b style="color:#ef4444;font-size:14px">DAMAGE / FOR REPAIR</b>
    <div class="g2" style="margin-top:8px;gap:8px 12px">
      <div><label>Cellphone</label><input type="number" id="iq-rep-cell" min="0" step="1" value="${getQty('repair','cellphone')}"></div>
      <div><label>Portable Printer</label><input type="number" id="iq-rep-print" min="0" step="1" value="${getQty('repair','printer')}"></div>
      <div><label>POS Unit</label><input type="number" id="iq-rep-pos" min="0" step="1" value="${getQty('repair','pos')}"></div>
      <div><label>Remarks</label><input type="text" id="ir-rep" placeholder="Optional notes…" value="${esc(getRem('repair','cellphone'))}"></div>
    </div>
  </div>
</div>

<div class="msg" id="ie-msg" style="margin-top:10px"></div>

<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end">
  <button class="ghost" id="ie-cancel">Cancel</button>
  <button class="btn" id="ie-save" style="width:auto;padding:10px 24px;margin:0">Save Quantities</button>
</div>
`;

  document.body.appendChild(d);
  d.showModal();

  const msg = d.querySelector("#ie-msg");
  const close = () => { d.close(); d.remove(); };
  d.querySelector("#ie-close").onclick = close;
  d.querySelector("#ie-cancel").onclick = close;

  d.querySelector("#ie-save").onclick = async () => {
    const parse = id => {
      const v2 = parseInt(d.querySelector("#" + id).value, 10);
      return isNaN(v2) || v2 < 0 ? null : v2;
    };

    const qActCell = parse("iq-act-cell"), qActPrint = parse("iq-act-print"), qActPos = parse("iq-act-pos");
    const qResCell = parse("iq-res-cell"), qResPrint = parse("iq-res-print"), qResPos = parse("iq-res-pos");
    const qRepCell = parse("iq-rep-cell"), qRepPrint = parse("iq-rep-print"), qRepPos = parse("iq-rep-pos");

    if ([qActCell, qActPrint, qActPos, qResCell, qResPrint, qResPos, qRepCell, qRepPrint, qRepPos].some(x => x === null)) {
      msg.textContent = "All quantities must be valid non-negative whole numbers (0 or greater).";
      return;
    }

    const rAct = d.querySelector("#ir-act").value.trim() || null;
    const rRes = d.querySelector("#ir-res").value.trim() || null;
    const rRep = d.querySelector("#ir-rep").value.trim() || null;

    const btn = d.querySelector("#ie-save");
    btn.disabled = true;
    btn.textContent = "Saving…";

    const rows = [
      { category: "active", equipment_type: "cellphone", quantity: qActCell, remarks: rAct },
      { category: "active", equipment_type: "printer", quantity: qActPrint, remarks: rAct },
      { category: "active", equipment_type: "pos", quantity: qActPos, remarks: rAct },

      { category: "reserve", equipment_type: "cellphone", quantity: qResCell, remarks: rRes },
      { category: "reserve", equipment_type: "printer", quantity: qResPrint, remarks: rRes },
      { category: "reserve", equipment_type: "pos", quantity: qResPos, remarks: rRes },

      { category: "repair", equipment_type: "cellphone", quantity: qRepCell, remarks: rRep },
      { category: "repair", equipment_type: "printer", quantity: qRepPrint, remarks: rRep },
      { category: "repair", equipment_type: "pos", quantity: qRepPos, remarks: rRep }
    ].map(r => ({ ...r, updated_by: me ? me.id : null, updated_at: new Date().toISOString() }));

    try {
      const { error } = await sb
        .from("equipment_inventory")
        .upsert(rows, { onConflict: "category,equipment_type" });
      if (error) throw error;
      close();
      alert("Inventory quantities successfully saved!");
      rent(v);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Save Quantities";
      msg.style.color = "#ff8b9b";
      msg.textContent = "Could not save inventory: " + (e?.message || String(e));
    }
  };
}

// -------------------------------------------------------------------------
// Register Module in window.MODS
// -------------------------------------------------------------------------
window.MODS = Object.assign(window.MODS || {}, { [NAME]: rent });
})();
