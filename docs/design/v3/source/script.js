const D = __MAIN__;
const X = __EXTRA__;
const P = X.pro;
const MS = 86400000;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const T0 = Date.parse(D.start + 'T00:00:00Z');
const N = D.days.length;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const keyAt = (i) => iso(T0 + i * MS);
const idxOf = (k) => Math.round((Date.parse(k + 'T00:00:00Z') - T0) / MS);
const fmt = (n, dp) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
const dLabel = (k) => (+k.slice(8, 10)) + ' ' + MON[+k.slice(5, 7) - 1];
const dLabelY = (k) => dLabel(k) + ' ' + k.slice(0, 4);
const niceMax = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10; return n * p; };
const axisFor = (yMax) => [0, 1, 2, 3, 4].map((i) => ({ label: fmt(yMax * i / 4), pct: i * 25 }));
const pathOf = (pts) => { let d = ''; let pen = false; for (const p of pts) { if (p === null) { pen = false; continue; } d += (pen ? ' L ' : ' M ') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); pen = true; } return d.trim(); };
const areaOf = (pts) => { const ok = pts.filter((p) => p !== null); if (!ok.length) return ''; return 'M ' + ok[0][0].toFixed(2) + ' 100 L ' + ok.map((p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L ') + ' L ' + ok[ok.length - 1][0].toFixed(2) + ' 100 Z'; };
const smoothOf = (pts) => {
  if (pts.length < 3) return pathOf(pts);
  const c = (v) => Math.max(0, Math.min(100, v));
  let d = 'M ' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] || p2;
    d += ' C ' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(2) + ' ' + c(p1[1] + (p2[1] - p0[1]) / 6).toFixed(2) + ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(2) + ' ' + c(p2[1] - (p3[1] - p1[1]) / 6).toFixed(2) + ' ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
  }
  return d;
};
const lkr = (n, signed) => { if (n === null || n === undefined) return '—'; const a = Math.abs(n); const sg = n < 0 ? '− ' : (signed ? '+ ' : ''); return sg + 'LKR ' + (a >= 1e6 ? fmt(a / 1e6, 2) + ' M' : a >= 1e3 ? fmt(a / 1e3, 1) + ' K' : fmt(a)); };
const localHM = (ts) => { const d = new Date(Date.parse(ts) + 330 * 60000); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
const hm = (min) => (min >= 60 ? Math.floor(min / 60) + ' h ' + Math.round(min % 60) + ' m' : Math.round(min) + ' m');
const medianInv = (() => { const v = D.monthly.map((r) => r.inv).filter((x) => x !== null).sort((a, b) => a - b); return Math.round(v[Math.floor(v.length / 2)] / 100) * 100; })();
const billByEnd = {}; for (const b of X.billRows) billByEnd[b.e] = b;
const ACT = 'color: var(--gen); background: var(--gen-a16);';

class Component extends DCLogic {
  state = {
    theme: 'dark', railOpen: true, role: 'admin', page: 'overview', phone: false, mTab: 'gen',
    cebStyle: 'bars', cebCount: 8, cebEnd: D.monthly.length - 1, cebThr: medianInv,
    range: 'month', endIdx: N - 1, dayStyle: 'area', thrDay: 140, thrMonth: 4200, drag: '',
    cFrom: '2036-07-01', cTo: '2036-08-15',
    hrIdx: N - 1, hrStyle: 'area',
    proRange: 30, adminTab: 'bills'
  };

  shellVals(page) {
    const s = this.state; const open = s.railOpen; const adm = s.role === 'admin';
    const item = (k, label) => ({ style: (page === k ? ACT : '') + (k === 'admin' && !adm ? ' display: none;' : '') + (open ? '' : ' justify-content: center; padding: 0;'), tip: open ? '' : label });
    const roleLabel = { admin: 'Admin', viewer: 'Viewer', visitor: 'Visitor' }[s.role];
    const roleSub = { admin: 'Full access', viewer: 'Real data, read only', visitor: 'Demo data' }[s.role];
    return {
      theme: s.theme, railW: open ? 244 : 84, labelShow: open ? 'inline' : 'none',
      navOv: item('overview', 'Overview'), navPro: item('pro', 'Pro metrics'), navAdm: item('admin', 'Admin'), navSet: item('settings', 'Settings'),
      goOv: () => this.setState({ page: 'overview' }), goPro: () => this.setState({ page: 'pro' }), goAdm: () => this.setState({ page: 'admin' }), goSet: () => this.setState({ page: 'settings' }),
      roleLabel: roleLabel, roleSub: roleSub, roleInitial: roleLabel[0], roleTip: open ? '' : roleLabel + ' · ' + roleSub,
      cycleRole: () => this.setState(s.role === 'visitor' ? { page: 'door' } : { page: 'settings' }),
      toggleRail: () => this.setState({ railOpen: !open }), collapseRot: open ? 0 : 180, collapseTip: open ? '' : 'Expand sidebar',
      toggleTheme: () => this.setState({ theme: s.theme === 'dark' ? 'light' : 'dark' }),
      themeTip: s.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', sunShow: s.theme === 'dark' ? 'block' : 'none', moonShow: s.theme === 'dark' ? 'none' : 'block',
      pageTitle: { overview: 'Overview', pro: 'Pro metrics', admin: 'Admin', settings: 'Settings', door: 'Sign in' }[page], weatherShow: page === 'pro' ? 'inline-flex' : 'none',
      isOv: page === 'overview' && !s.phone, isOvM: page === 'overview' && !!s.phone, isPro: page === 'pro', isAdm: page === 'admin', isSet: page === 'settings', isDoor: page === 'door'
    };
  }

  renderVals() {
    const s = this.state;
    const page = (s.page === 'admin' && s.role !== 'admin') ? 'overview' : s.page;
    return Object.assign({}, this.shellVals(page), this.overviewVals(s), this.proVals(s), this.settingsVals(s), this.adminVals(s), this.doorVals(s));
  }

  overviewVals(s) {
    const k = D.kpi;
    const kpis = [
      { label: 'This billing period', value: fmt(k.billPeriodKwh), unit: 'kWh', sub: 'since ' + dLabel(k.billPeriodStart) + ' · awaiting bill', tip: 'Billing period ' + dLabel(k.billPeriodStart) + ' to today. Generation is recorded on ' + k.billPeriodDays + ' of ' + k.billPeriodOf + ' days; the CEB bill for this period has not been issued yet.' },
      { label: 'All-time generation', value: fmt(k.totalGenKwh / 1000, 1), unit: 'MWh', sub: 'since ' + dLabelY(D.start) + ' · 21 months', tip: fmt(k.totalGenKwh) + ' kWh generated since the first reading, across ' + k.billCount + ' bill periods.' },
      { label: 'All-time earnings', value: 'LKR ' + fmt(k.totalEarnLkr / 1e6, 2), unit: 'M', sub: 'from ' + k.billCount + ' CEB bills · 20 months', tip: 'Sum of ' + k.billCount + ' CEB bills (Feb 2035 to Sep 2036): about LKR ' + fmt(k.totalEarnLkr / k.billCount / 1000) + ' K per bill.' }
    ];
    const L = D.live;
    const fillPct = Math.round(L.todayKwh / L.target * 100);
    const gaugeDash = Math.max(0.5, Math.min(100, L.kw / 40 * 100)).toFixed(1) + ' 100';

    // ---- CEB vs inverter
    const rows = D.monthly;
    const endI = Math.min(Math.max(s.cebEnd, 0), rows.length - 1);
    const count = s.cebCount === 'all' ? rows.length : s.cebCount;
    const startI = Math.max(0, endI - count + 1);
    const win = rows.slice(startI, endI + 1);
    let maxV = 1; for (const r of win) maxV = Math.max(maxV, r.inv || 0, r.ceb || 0);
    const yMax = niceMax(Math.max(maxV * 1.06, s.cebThr * 1.04));
    const n = win.length;
    const thr = s.cebThr;
    const STRIPE = 'repeating-linear-gradient(135deg,var(--gen) 0 5px,var(--gen-a30) 5px 9px)';
    let aboveC = 0; let withC = 0;
    const cebCols = win.map((r, i) => {
      const partial = r.dp < r.dn; const prov = r.st === 'provisional';
      const hi = r.inv !== null && r.inv > thr; if (r.inv !== null) withC += 1; if (hi) aboveC += 1;
      const invPct = (r.inv || 0) / yMax * 100; const cebPct = r.ceb ? r.ceb / yMax * 100 : 0;
      const dim = hi ? '' : ' opacity: .5;';
      const invStyle = 'height: ' + invPct.toFixed(1) + '%; ' + (partial || prov ? 'background: ' + STRIPE + '; border: 1px solid var(--gen);' : 'background: var(--gen);') + dim;
      const cebStyle = prov ? 'height: ' + (invPct * 0.9).toFixed(1) + '%; border: 1.5px dashed var(--ceb); opacity: .6;' : 'height: ' + cebPct.toFixed(1) + '%; background: var(--ceb);';
      let tag = ''; let tagStyle = 'color: var(--ink2);'; let tip = r.m + ' ' + r.y + ' · ' + dLabel(r.ps) + ' to ' + dLabel(r.pe) + ' · Inverter ' + fmt(r.inv) + ' kWh' + (hi ? ' (above the line)' : '');
      if (prov) { tag = 'awaiting bill'; tip += ' · CEB bill not issued yet · ' + r.dp + ' of ' + r.dn + ' days so far'; }
      else {
        const v = (r.ceb - r.inv) / r.inv * 100; tip += ' · CEB ' + fmt(r.ceb) + ' kWh';
        if (partial) { tag = r.dp + '/' + r.dn + ' d'; tagStyle = 'color: var(--warn);'; tip += ' · only ' + r.dp + ' of ' + r.dn + ' days recorded, so the variance is not shown'; }
        else { tag = (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%'; tip += ' · variance ' + tag; }
      }
      return { label: r.m + (n <= 12 && (i === 0 || r.m === 'Jan') ? ' ' + String(r.y).slice(2) : ''), tag: tag, tagStyle: tagStyle, tip: tip, invStyle: invStyle, cebStyle: cebStyle, invPct: invPct, cebPct: cebPct, cebDot: r.ceb ? 'block' : 'none', dot: hi ? 11 : 8, dotHalf: hi ? 5.5 : 4 };
    });
    const xAt = (i) => (i + 0.5) / n * 100;
    const invPts = win.map((r, i) => [xAt(i), 100 - (r.inv || 0) / yMax * 100]);
    const cebPts = win.map((r, i) => (r.ceb ? [xAt(i), 100 - r.ceb / yMax * 100] : null));
    const setCeb = (p) => () => this.setState(p);
    const half = Math.max(1, Math.floor(count / 2));
    const cebVal = (e) => { const r = e.currentTarget.getBoundingClientRect(); return Math.round(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) * yMax / 10) * 10; };

    // earnings difference (LR-004), aligned to the columns above
    let edSum = 0; let edN = 0;
    let maxAbs = 1; for (const r of win) { const b = billByEnd[r.pe]; if (b && b.d !== null) maxAbs = Math.max(maxAbs, Math.abs(b.d)); }
    const edCols = win.map((r) => {
      const b = billByEnd[r.pe];
      if (!b || r.st === 'provisional') return { label: r.m, amount: '', amountColor: 'var(--ink2)', style: 'display: none;', dashShow: 'none', tip: r.m + ' ' + r.y + ': bill not issued yet, nothing to compare' };
      if (b.d === null) return { label: r.m, amount: 'n/a', amountColor: 'var(--ink2)', style: 'display: none;', dashShow: 'block', tip: r.m + ' ' + r.y + ': not compared. Only ' + r.dp + ' of ' + r.dn + ' days have inverter data, so no figure is guessed.' };
      const dd = -b.d; edSum += dd; edN += 1;
      const h = Math.max(3, Math.abs(dd) / maxAbs * 46);
      const pos = dd >= 0;
      return { label: r.m, amount: (dd < 0 ? '−' : '+') + fmt(Math.abs(dd) / 1000, 1) + ' K', amountColor: pos ? 'var(--good)' : 'var(--warn)', style: pos ? 'bottom: 50%; height: ' + h.toFixed(1) + '%; background: var(--good);' : 'top: 50%; height: ' + h.toFixed(1) + '%; background: var(--warn);', dashShow: 'none', tip: r.m + ' ' + r.y + ': CEB paid LKR ' + fmt(b.earn) + ' (' + fmt(b.ceb) + ' kWh) vs inverter generation worth LKR ' + fmt(b.inv * b.rate) + ' (' + fmt(b.inv) + ' kWh at LKR ' + fmt(b.rate, 2) + ' per kWh) = ' + lkr(dd, true) + (pos ? ': CEB paid more than the inverter recorded' : ': CEB paid less than the inverter generated') };
    });
    const E = { value: X.ed.value, earn: X.ed.earn, diff: -X.ed.diff, pct: -X.ed.pct, n: X.ed.n, excl: X.ed.excl, from: X.ed.from, to: X.ed.to };

    // ---- inverter generation over time
    let from; let to;
    if (s.range === 'custom') {
      from = idxOf(s.cFrom); to = idxOf(s.cTo);
      if (to < from) { const t = from; from = to; to = t; }
      from = Math.max(0, from); to = Math.min(N - 1, to);
      if (to - from > 365) to = from + 365;
    } else {
      const len = s.range === 'week' ? 7 : s.range === 'month' ? 30 : 365;
      to = Math.min(Math.max(s.endIdx, 0), N - 1); from = Math.max(0, to - len + 1);
    }
    const grouped = (to - from + 1) > 62;
    let pts = [];
    if (!grouped) {
      for (let i = from; i <= to; i++) { const v = D.days[i]; const key = keyAt(i); pts.push({ v: v, label: (to - from) > 14 ? (+key.slice(8, 10) % 5 === 0 || +key.slice(8, 10) === 1 ? String(+key.slice(8, 10)) : '') : dLabel(key), full: dLabelY(key) }); }
    } else {
      const buckets = {}; const order = [];
      for (let i = from; i <= to; i++) {
        const key = keyAt(i); const ym = key.slice(0, 7);
        if (!buckets[ym]) { buckets[ym] = { sum: 0, present: 0, total: 0 }; order.push(ym); }
        buckets[ym].total += 1; if (D.days[i] !== null) { buckets[ym].sum += D.days[i]; buckets[ym].present += 1; }
      }
      pts = order.map((ym) => { const b = buckets[ym]; return { v: b.present ? b.sum : null, label: MON[+ym.slice(5, 7) - 1], full: MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) + (b.present < b.total ? ' (' + b.present + '/' + b.total + ' days)' : '') }; });
    }
    const dthr = grouped ? s.thrMonth : s.thrDay;
    const unit = grouped ? 'kWh/month' : 'kWh/day';
    let dMax = 1; for (const p of pts) if (p.v !== null) dMax = Math.max(dMax, p.v);
    const dyMax = niceMax(Math.max(dMax * 1.1, dthr));
    const m = pts.length;
    const above = pts.filter((p) => p.v !== null && p.v > dthr).length;
    const withData = pts.filter((p) => p.v !== null).length;
    const dayCols = pts.map((p) => {
      const pct = p.v === null ? 0 : p.v / dyMax * 100; const hi = p.v !== null && p.v > dthr;
      const style = p.v === null ? 'height: 3px; background: var(--nodata);' : 'height: ' + pct.toFixed(1) + '%; background: ' + (hi ? 'var(--gen)' : 'var(--gen-a34)') + ';';
      return { label: p.label, style: style, tip: p.full + ': ' + (p.v === null ? 'no data recorded' : fmt(p.v, grouped ? 0 : 1) + ' kWh' + (hi ? ' · above the line' : '')), pct: pct, dot: hi ? 9 : 6, dotHalf: hi ? 4.5 : 3, dotFill: hi ? 'var(--gen)' : 'var(--ink2)', dotShow: p.v === null ? 'none' : 'block' };
    });
    const dx = (i) => (i + 0.5) / m * 100;
    const linePts = pts.map((p, i) => (p.v === null ? null : [dx(i), 100 - p.v / dyMax * 100]));
    const setThr = (v) => { const val = Math.max(0, Math.round(v)); this.setState(grouped ? { thrMonth: val } : { thrDay: val }); };
    const dayVal = (e) => { const r = e.currentTarget.getBoundingClientRect(); return Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) * dyMax; };
    const setRange = (r) => () => this.setState({ range: r, endIdx: N - 1 });
    const step = s.range === 'week' ? 7 : s.range === 'month' ? 30 : s.range === 'year' ? 365 : Math.max(1, to - from + 1);

    // ---- one day, hour by hour
    const hi = Math.min(Math.max(s.hrIdx, 0), N - 1);
    const hrow = X.hourly[hi]; const hkey = keyAt(hi);
    const hMax = hrow ? Math.max.apply(null, hrow) : 1;
    const hyMax = niceMax(Math.max(hMax * 1.12, 1));
    const hrCols = Array.from({ length: 15 }, (_, j) => {
      const v = hrow ? hrow[j] : null; const h = j + 5; const pct = v === null ? 0 : v / hyMax * 100;
      return { label: String(h), pct: pct, tip: dLabelY(hkey) + ' · ' + h + ':00 to ' + (h + 1) + ':00 · ' + (v === null ? 'no data' : fmt(v, 1) + ' kWh'), barStyle: s.hrStyle === 'bars' && v !== null ? 'height: ' + pct.toFixed(1) + '%; background: var(--gen);' : 'display: none;', dotShow: s.hrStyle === 'area' && v !== null ? 'block' : 'none' };
    });
    const hrPts = hrow ? hrow.map((v, j) => [(j + 0.5) / 15 * 100, 100 - v / hyMax * 100]) : [];
    const hrLine = hrPts.length ? smoothOf(hrPts) : '';
    const hrArea = hrPts.length ? hrLine + ' L ' + hrPts[14][0].toFixed(2) + ' 100 L ' + hrPts[0][0].toFixed(2) + ' 100 Z' : '';
    const pk = X.peaks[hi];

    // ---- statistics over the range shown above (daily values always)
    let total = 0; let present = 0; let best = null; let worst = null;
    for (let i = from; i <= to; i++) {
      const v = D.days[i]; if (v === null) continue; present += 1; total += v;
      if (!best || v > best.v) best = { v: v, i: i };
      if (!worst || v < worst.v) worst = { v: v, i: i };
    }
    const span = to - from + 1; const avg = present ? total / present : null;
    const lo = worst ? worst.v * 0.8 : 0; const hiV = best ? best.v * 1.06 : 1;
    const sy = (v) => 100 - (v - lo) / (hiV - lo) * 100;
    const sx = (i) => (span > 1 ? (i - from) / (span - 1) * 100 : 50);
    const spPts = []; for (let i = from; i <= to; i++) spPts.push(D.days[i] === null ? null : [sx(i), sy(D.days[i])]);
    const stats = [
      { shortLabel: 'Avg / day', label: 'Average per day', value: fmt(avg, 1), unit: 'kWh', sub: 'over ' + present + ' recorded days', color: 'var(--ink2)', tip: 'Total for the range divided by the days that have data. Days with no reading are left out, never counted as zero.' },
      { shortLabel: 'Best day', label: 'Best day', value: fmt(best && best.v, 1), unit: 'kWh', sub: best ? dLabelY(keyAt(best.i)) : '', color: 'var(--gen)', tip: 'Highest single-day generation in the range.' },
      { shortLabel: 'Lowest day', label: 'Lowest day', value: fmt(worst && worst.v, 1), unit: 'kWh', sub: worst ? dLabelY(keyAt(worst.i)) : '', color: 'var(--warn)', tip: 'Lowest single-day generation in the range. A measured zero would show as 0.' }
    ];

    return {
      mKpis: [
        { label: 'This period', value: fmt(k.billPeriodKwh), unit: 'kWh', sub: 'awaiting bill' },
        { label: 'All-time gen', value: fmt(k.totalGenKwh / 1000, 1), unit: 'MWh', sub: 'since ' + dLabelY(D.start).slice(-8) },
        { label: 'All-time earned', value: 'LKR ' + fmt(k.totalEarnLkr / 1e6, 2), unit: 'M', sub: k.billCount + ' CEB bills' }
      ],
      cebAboveShort: withC ? aboveC + ' of ' + withC + ' above' : 'no data', edBills: E.n, barPadM: m > 40 ? 6 : m > 20 ? 10 : 16,
      mTabs: [['gen', 'Generation'], ['day', 'Day'], ['stats', 'Stats']].map((o) => ({ label: o[1], on: s.mTab === o[0], pick: () => this.setState({ mTab: o[0] }) })),
      tabGen: s.mTab === 'gen', tabDay: s.mTab === 'day', tabStats: s.mTab === 'stats',
      mCebDragStart: (e) => { e.currentTarget.setPointerCapture(e.pointerId); this.setState({ drag: 'ceb' }); },
      mCebDragMove: (e) => { if (this.state.drag === 'ceb') { const r = e.currentTarget.parentElement.getBoundingClientRect(); this.setState({ cebThr: Math.round(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) * yMax / 10) * 10 }); } },
      mDayDragStart: (e) => { e.currentTarget.setPointerCapture(e.pointerId); this.setState({ drag: 'day' }); },
      mDayDragMove: (e) => { if (this.state.drag === 'day') { const r = e.currentTarget.parentElement.getBoundingClientRect(); setThr(Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height)) * dyMax); } },
      kpis: kpis,
      fillPct: fillPct, fillTop: Math.max(0, 100 - Math.min(100, fillPct)), todayKwh: fmt(L.todayKwh, 1), target: L.target, toGo: fmt(Math.max(0, L.target - L.todayKwh), 1) + ' kWh', peakKw: D.peak.kw, peakAt: D.peak.t,
      liveKw: fmt(L.kw, 1), gaugeDash: gaugeDash, liveSharePct: Math.round(L.kw / 40 * 100),

      cebStyles: [['bars', 'Bars'], ['line', 'Lines'], ['area', 'Area']].map((o) => ({ label: o[1], on: s.cebStyle === o[0], pick: setCeb({ cebStyle: o[0] }) })),
      cebCounts: [[8, '8'], [12, '12'], ['all', 'All']].map((o) => ({ label: o[1], on: s.cebCount === o[0], pick: setCeb({ cebCount: o[0], cebEnd: rows.length - 1 }) })),
      cebIsBars: s.cebStyle === 'bars', cebIsLine: s.cebStyle !== 'bars', cebAreaShow: s.cebStyle === 'area' ? 'block' : 'none',
      cebRangeLabel: win[0].m + ' ' + win[0].y + ' to ' + win[n - 1].m + ' ' + win[n - 1].y,
      cebPrev: () => this.setState({ cebEnd: Math.max(count - 1, endI - half) }), cebNext: () => this.setState({ cebEnd: Math.min(rows.length - 1, endI + half) }),
      cebPrevOff: startI === 0, cebNextOff: endI >= rows.length - 1,
      cebAxis: axisFor(yMax).reverse(), cebCols: cebCols, cebLineInv: pathOf(invPts), cebLineCeb: pathOf(cebPts), cebAreaInv: areaOf(invPts),
      cebThr: thr, cebThrPct: Math.min(100, thr / yMax * 100), onCebThr: (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) this.setState({ cebThr: Math.max(0, Math.round(v)) }); },
      cebAboveText: withC ? 'Inverter above: ' + aboveC + ' of ' + withC + ' periods' : 'no data in range',
      cebDragStart: (e) => { e.currentTarget.setPointerCapture(e.pointerId); this.setState({ drag: 'ceb', cebThr: cebVal(e) }); },
      cebDragMove: (e) => { if (this.state.drag === 'ceb') this.setState({ cebThr: cebVal(e) }); },

      edWindow: edN ? lkr(edSum, true) : '—', edColor: edSum >= 0 ? 'var(--good)' : 'var(--warn)',
      edWindowSub: edN ? 'in view · ' + edN + ' of ' + n + ' compared · each bill at its own rate' : 'no comparable bill in view',
      edValue: lkr(E.value), edPaid: lkr(E.earn), edAllColor: E.diff >= 0 ? 'var(--good)' : 'var(--warn)', edAll: lkr(E.diff, true),
      edAllTip: 'Over ' + E.n + ' complete bills (' + dLabelY(E.from) + ' to ' + dLabelY(E.to) + '), ' + fmt(E.pct, 1) + '% of what the generation was worth. ' + E.excl + ' bills left out for missing days or no rate.',
      edCols: edCols,

      rangeOpts: [['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['custom', 'Custom']].map((o) => ({ label: o[1], on: s.range === o[0], pick: setRange(o[0]) })),
      dayStyles: [['area', 'Area'], ['line', 'Line'], ['bars', 'Bars']].map((o) => ({ label: o[1], on: s.dayStyle === o[0], pick: () => this.setState({ dayStyle: o[0] }) })),
      dayGranularity: grouped ? 'Monthly totals' : 'Daily',
      dayRangeLabel: dLabelY(keyAt(from)) + ' to ' + dLabelY(keyAt(to)),
      dayPrev: () => this.setState({ endIdx: Math.max(step - 1, to - step) }), dayNext: () => this.setState({ endIdx: Math.min(N - 1, to + step) }),
      dayNavOff: s.range === 'custom' || from === 0, dayNextOff: s.range === 'custom' || to >= N - 1,
      isCustom: s.range === 'custom', cFrom: s.cFrom, cTo: s.cTo, minDate: D.start, maxDate: D.daysEnd,
      onFrom: (e) => { if (e.target.value) this.setState({ cFrom: e.target.value }); }, onTo: (e) => { if (e.target.value) this.setState({ cTo: e.target.value }); },
      thrValue: dthr, thrUnit: unit, thrPct: Math.min(100, dthr / dyMax * 100), onThr: (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) setThr(v); },
      aboveText: withData ? above + ' of ' + withData + (grouped ? ' months' : ' days') + ' above' : 'no data in range',
      dayIsBars: s.dayStyle === 'bars', dayIsLine: s.dayStyle !== 'bars', dayAreaShow: s.dayStyle === 'area' ? 'block' : 'none',
      barPad: m > 40 ? 8 : m > 20 ? 14 : 22,
      dayAxis: axisFor(dyMax).reverse(), dayCols: dayCols, dayLine: pathOf(linePts), dayArea: areaOf(linePts),
      dragStart: (e) => { e.currentTarget.setPointerCapture(e.pointerId); this.setState({ drag: 'day' }); setThr(dayVal(e)); },
      dragMove: (e) => { if (this.state.drag === 'day') setThr(dayVal(e)); },
      dragEnd: () => this.setState({ drag: '' }),

      hrStyles: [['area', 'Area'], ['bars', 'Bars']].map((o) => ({ label: o[1], on: s.hrStyle === o[0], pick: () => this.setState({ hrStyle: o[0] }) })),
      hrDate: hkey, onHrDate: (e) => { if (e.target.value) this.setState({ hrIdx: Math.min(N - 1, Math.max(0, idxOf(e.target.value))) }); },
      hrPrev: () => this.setState({ hrIdx: hi - 1 }), hrNext: () => this.setState({ hrIdx: hi + 1 }), hrPrevOff: hi <= 0, hrNextOff: hi >= N - 1,
      hrTotal: hrow ? fmt(D.days[hi], 1) + ' kWh that day' : 'No data',
      hrPeak: pk ? 'Peak ' + pk.kw + ' kW at ' + pk.t : 'Peak: unknown', hrNote: hrow ? '' : 'No readings were recorded for this day, so nothing is drawn (not a zero).',
      hrAxis: axisFor(hyMax).reverse(), hrCols: hrCols, hrIsArea: s.hrStyle === 'area' && !!hrow, hrLine: hrLine, hrArea: hrArea,

      statsRange: dLabelY(keyAt(from)) + ' to ' + dLabelY(keyAt(to)) + ' · ' + present + ' of ' + span + ' days with data',
      stats: stats, spLine: pathOf(spPts), spArea: areaOf(spPts), spAvgY: avg === null ? 50 : sy(avg).toFixed(2),
      bestX: best ? sx(best.i).toFixed(2) : 50, bestY: best ? sy(best.v).toFixed(2) : 50, worstX: worst ? sx(worst.i).toFixed(2) : 50, worstY: worst ? sy(worst.v).toFixed(2) : 50,
      bestTip: best ? 'Best day · ' + dLabelY(keyAt(best.i)) + ' · ' + fmt(best.v, 1) + ' kWh' : '', worstTip: worst ? 'Lowest day · ' + dLabelY(keyAt(worst.i)) + ' · ' + fmt(worst.v, 1) + ' kWh' : ''
    };
  }

  proVals(s) {
    const nDays = s.proRange;
    const days = P.upDays.slice(-nDays);
    const known = days.filter((d) => d.p !== null && d.p !== undefined);
    const avgUp = known.length ? known.reduce((a, d) => a + d.p, 0) / known.length : null;
    const downMin = days.reduce((a, d) => a + (d.trip || 0) + (d.gap || 0), 0);
    const trips = days.reduce((a, d) => a + (d.tc || 0), 0);
    const affected = days.filter((d) => (d.trip || 0) + (d.gap || 0) > 0).length;
    const commsMin = days.reduce((a, d) => a + (d.comms || 0), 0);
    const openAlarms = P.alarms.filter((a) => a.open).length;
    const missing = D.days.filter((v) => v === null).length;
    const compPct = (1 - missing / N) * 100;
    const upColor = avgUp === null ? 'var(--nodata)' : avgUp >= 99 ? 'var(--good)' : avgUp >= 95 ? 'var(--warn)' : 'var(--bad)';
    const proKpis = [
      { label: 'Uptime', value: fmt(avgUp, 1), unit: '%', sub: 'daylight hours · ' + known.length + ' days', color: upColor, dash: (avgUp || 0).toFixed(1) + ' 100', tip: 'Share of the daylight window (sunrise + 30 min to sunset − 30 min) the inverter was running, averaged over the days shown. Night is never counted as downtime.' },
      { label: 'Time stopped', value: hm(downMin), unit: '', sub: trips + ' trips · ' + affected + ' of ' + days.length + ' days', color: 'var(--warn)', dash: (affected / days.length * 100).toFixed(1) + ' 100', tip: 'Total minutes the inverter was stopped inside daylight windows (trips and unexplained gaps). The ring is the share of days affected.' },
      { label: 'Open alarms', value: String(openAlarms), unit: '', sub: P.alarms.length + ' in the log below', color: openAlarms ? 'var(--bad)' : 'var(--good)', dash: '100 100', tip: 'Alarms the inverter reports as still active right now.' },
      { label: 'Data completeness', value: fmt(compPct, 1), unit: '%', sub: (N - missing) + ' of ' + N + ' days collected', color: compPct >= 99 ? 'var(--good)' : 'var(--warn)', dash: compPct.toFixed(1) + ' 100', tip: 'Days since the first reading that have a daily total. Missing days are shown as unknown everywhere, never as zero.' }
    ];
    const upCols = days.map((d) => {
      const p = d.p; const none = p === null || p === undefined;
      const h = none ? 24 : Math.max(26, Math.min(100, 26 + (p - 90) / 10 * 74));
      const col = none ? 'var(--nodata)' : p >= 99 ? 'var(--good)' : p >= 95 ? 'var(--warn)' : 'var(--bad)';
      return { style: 'height: ' + h.toFixed(0) + '%; background: ' + col + ';', tip: dLabelY(d.d) + ': ' + (none ? 'no uptime data' : fmt(p, 1) + '% uptime') + (d.trip ? ' · stopped ' + hm(d.trip) + ' (' + d.tc + ' trip' + (d.tc === 1 ? '' : 's') + ')' : '') + (d.comms ? ' · logger offline ' + hm(d.comms) : '') };
    });
    const lvl = { 1: ['Low', 'background: var(--chip-bg); color: var(--ink2);'], 2: ['Medium', 'background: var(--warn-a20); color: var(--warn);'], 3: ['High', 'background: var(--bad-a20); color: var(--bad);'] };
    const alarmRows = P.alarms.slice(0, 8).map((a) => { const l = lvl[a.lvl] || lvl[1]; return { when: localHM(a.at), code: a.code, msg: a.code === '1D4C2' ? 'Lost internet (logger)' : a.msg, len: a.open ? 'open' : (a.min < 1 ? '< 1 min' : fmt(a.min, 0) + ' min'), lvl: l[0], lvlStyle: l[1], tip: a.msg + ' · ' + a.adv };
    });
    const dataRows = [
      { label: 'Days with a collected reading', value: fmt(compPct, 1) + '%', pct: compPct, color: 'var(--good)', tip: (N - missing) + ' of ' + N + ' days since the first reading.' },
      { label: 'Logger connection · ' + days.length + ' days', value: commsMin ? hm(commsMin) + ' offline' : 'no gaps', pct: Math.max(0, 100 - commsMin / (days.length * 660) * 100), color: commsMin ? 'var(--warn)' : 'var(--good)', tip: 'Minutes the data logger lost its internet link inside daylight windows. Counted as a data gap, not as inverter downtime.' },
      { label: 'Nightly collections · last 7', value: '7 of 7', pct: 100, color: 'var(--good)', tip: 'The collector re-reads the last 7 days every night and fills any hole.' },
      { label: 'Days with alarms known', value: days.length + ' of ' + days.length, pct: 100, color: 'var(--good)', tip: 'Uptime is only trusted when the alarm log for that day was readable.' }
    ];
    const meanA = P.strings.reduce((a, r) => a + r.a, 0) / P.strings.length; const maxA = Math.max.apply(null, P.strings.map((r) => r.a));
    const minA = Math.min.apply(null, P.strings.map((r) => r.a));
    const stringRows = P.strings.map((r) => { const dev = (r.a / meanA - 1) * 100; const low = dev < -8; return { label: 'S' + r.n, value: fmt(r.a, 1) + ' A', pct: r.a / maxA * 100, color: low ? 'var(--warn)' : 'var(--gen)', tip: 'String ' + r.n + ': ' + fmt(r.a, 1) + ' A at about ' + r.v + ' V · ' + (dev >= 0 ? '+' : '−') + Math.abs(dev).toFixed(1) + '% vs the average' }; });
    const tv = P.temp.map((t) => t.v); const tLo = Math.floor(Math.min.apply(null, tv) / 5) * 5 - 5; const tHi = Math.ceil(Math.max.apply(null, tv) / 5) * 5 + 5;
    const ty = (v) => 100 - (v - tLo) / (tHi - tLo) * 100;
    const tPts = P.temp.map((t, i) => [(i + 0.5) / P.temp.length * 100, ty(t.v)]);
    const tempCols = P.temp.map((t, i) => ({ label: String(t.h), pct: 100 - tPts[i][1], tip: t.h + ':00 to ' + (t.h + 1) + ':00 · max ' + fmt(t.v, 1) + ' °C' }));
    const facCols = P.fac.map((f) => { const y = (v) => 50 - (v - 50) * 68; const top = y(f.hi); const h = Math.max(4, y(f.lo) - top); return { label: String(f.h), style: 'top: ' + top.toFixed(1) + '%; height: ' + h.toFixed(1) + '%;', tip: f.h + ':00 to ' + (f.h + 1) + ':00 · ' + fmt(f.lo, 2) + ' to ' + fmt(f.hi, 2) + ' Hz' }; });

    const rates = X.billRows.slice().reverse();
    const rv = rates.map((r) => r.rate); const rLo = Math.floor(Math.min.apply(null, rv)) - 1; const rHi = Math.ceil(Math.max.apply(null, rv)) + 1;
    const rPts = rates.map((r, i) => [(i + 0.5) / rates.length * 100, 100 - (r.rate - rLo) / (rHi - rLo) * 100]);
    const rateCols = rates.map((r, i) => ({ pct: 100 - rPts[i][1], tip: 'Bill ending ' + dLabelY(r.e) + ' · LKR ' + fmt(r.rate, 2) + ' per kWh (LKR ' + fmt(r.earn) + ' for ' + fmt(r.ceb) + ' kWh)' }));
    const rateAxis = [0, 50, 100].map((p) => ({ pct: p, label: fmt(rLo + (rHi - rLo) * p / 100) }));

    const cur = D.monthly.filter((r) => r.y === 2036 && r.st === 'finalized' && r.dp === r.dn);
    const yoy = cur.map((r) => ({ r: r, p: D.monthly.find((q) => q.y === 2035 && q.m === r.m && q.st === 'finalized' && q.dp === q.dn) })).filter((q) => q.p).slice(-8);
    const yMax2 = niceMax(Math.max.apply(null, yoy.map((q) => Math.max(q.r.inv, q.p.inv))) * 1.05);
    const yoyCols = yoy.map((q) => { const d = (q.r.inv - q.p.inv) / q.p.inv * 100; return { label: q.r.m, delta: (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '%', deltaStyle: 'font-weight: 700; font-size: 10.5px; color: ' + (d >= 0 ? 'var(--good)' : 'var(--warn)') + ';', prevStyle: 'height: ' + (q.p.inv / yMax2 * 100).toFixed(1) + '%;', curStyle: 'height: ' + (q.r.inv / yMax2 * 100).toFixed(1) + '%;', tip: q.r.m + ' bill period: ' + fmt(q.p.inv) + ' kWh in 2035, ' + fmt(q.r.inv) + ' kWh in 2036 (' + (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1) + '%). Weather differs between years, so read it as a trend, not a fault.' }; });

    return {
      proRanges: [[14, '14 days'], [30, '30 days'], [60, '60 days']].map((o) => ({ label: o[1], on: s.proRange === o[0], pick: () => this.setState({ proRange: o[0] }) })),
      proKpis: proKpis, upCols: upCols, upFrom: dLabelY(days[0].d), upTo: dLabelY(days[days.length - 1].d),
      alarmTotal: P.alarms.length + ' recent', alarmRows: alarmRows, dataRows: dataRows,
      acv: P.acv, pf: P.pf, stringRows: stringRows, stringNote: (minA / meanA >= 0.92 ? 'All strings within 8% of the average.' : 'A string is more than 8% below the average: worth a look.'),
      tempAxis: [0, 50, 100].map((p) => ({ pct: p, label: fmt(tLo + (tHi - tLo) * p / 100) })), tempLine: smoothOf(tPts), tempArea: smoothOf(tPts) + ' L ' + tPts[tPts.length - 1][0].toFixed(2) + ' 100 L ' + tPts[0][0].toFixed(2) + ' 100 Z', tempCols: tempCols, facCols: facCols,
      rateLine: pathOf(rPts), rateCols: rateCols, rateAxis: rateAxis, rateNote: 'LKR ' + fmt(Math.min.apply(null, rv), 2) + ' to ' + fmt(Math.max.apply(null, rv), 2) + ' per kWh across ' + rates.length + ' bills. Each bill is judged at its own rate, never today’s tariff.',
      yoyCols: yoyCols
    };
  }

  settingsVals(s) {
    const adm = s.role === 'admin';
    const card = (key, name, note, bg, glass, gen, ceb) => ({ name: name, note: note, bg: bg, glass: glass, gen: gen, ceb: ceb, on: s.theme === key, border: s.theme === key ? 'var(--gen)' : 'var(--glass-line)', opacity: 1, pick: () => this.setState({ theme: key }) });
    return {
      themeCards: [
        card('dark', 'Sunrise Night', 'Dark first. Orange on navy.', '#0A0F1F', 'rgba(255,255,255,.14)', '#FF8A1F', '#5AA9FF'),
        card('light', 'Sunrise Day', 'Warm paper, same orange.', '#F5F2EC', 'rgba(255,255,255,.95)', '#F26A00', '#2D7DE0'),
        { name: 'More themes later', note: 'Add a block of variables, it appears here.', bg: 'repeating-linear-gradient(135deg, rgba(128,128,128,.18) 0 8px, rgba(128,128,128,.06) 8px 16px)', glass: 'rgba(128,128,128,.2)', gen: 'rgba(128,128,128,.4)', ceb: 'rgba(128,128,128,.4)', on: false, border: 'var(--glass-line)', opacity: 0.6, pick: () => {} }
      ],
      roleOpts: [['visitor', 'Visitor'], ['viewer', 'Viewer'], ['admin', 'Admin']].map((o) => ({ label: o[1], on: s.role === o[0], pick: () => this.setState({ role: o[0] }) })),
      adminOnlyStyle: adm ? 'background: var(--good-a20); color: var(--good);' : 'background: var(--chip-bg); color: var(--ink2);', adminOnlyText: adm ? 'You can edit' : 'Read only', plantLocked: !adm,
      prefRows: [
        { label: 'LKR figures use', note: 'Each bill’s own rate keeps history honest; a reference tariff is available.', value: 'Each bill’s own rate', style: 'background: var(--gen-a16); color: var(--gen);' },
        { label: 'Weather on Pro metrics', note: 'Tiny, optional context only. Never used in a comparison.', value: 'On', style: 'background: var(--good-a20); color: var(--good);' },
        { label: 'Fault alerts', note: 'Email or push when the inverter stops. Planned (issue 151).', value: 'Coming later', style: 'background: var(--chip-bg); color: var(--ink2);' }
      ]
    };
  }

  adminVals(s) {
    return {
      adminTabs: [['bills', 'Bills'], ['access', 'Access'], ['health', 'Data health']].map((o) => ({ label: o[1], on: s.adminTab === o[0], pick: () => this.setState({ adminTab: o[0] }) })),
      tabBills: s.adminTab === 'bills', tabAccess: s.adminTab === 'access', tabHealth: s.adminTab === 'health',
      billRows: X.billRows.slice(0, 6).map((b) => ({ date: dLabelY(b.e), period: dLabel(b.s) + ' to ' + dLabel(b.e), kwh: fmt(b.ceb), earn: fmt(b.earn), rate: fmt(b.rate, 2) })),
      people: [
        { name: 'You (owner)', role: 'Admin', can: 'Everything', style: 'background: var(--gen-a16); color: var(--gen);', locked: true },
        { name: 'family.member@example.com', role: 'Viewer', can: 'Real data, read only', style: 'background: var(--ceb-a20); color: var(--ceb);', locked: false },
        { name: 'accountant@example.com', role: 'Viewer', can: 'Real data, read only', style: 'background: var(--ceb-a20); color: var(--ceb);', locked: false }
      ],
      runs: Array.from({ length: 7 }, (_, i) => ({ color: 'var(--good)', tip: dLabelY(keyAt(N - 1 - (6 - i))) + ' · 00:15 · completed, all tables written' }))
    };
  }

  doorVals(s) {
    return {
      doorSignIn: () => this.setState({ role: 'admin', page: 'overview' }), doorDemo: () => this.setState({ role: 'visitor', page: 'overview' }),
      doorRoles: [
        { name: 'Visitor', style: 'background: var(--chip-bg); color: var(--ink2);', text: 'Sees every page on demo data dated 2035 onwards. Nothing real is exposed or even sent to the browser.' },
        { name: 'Viewer', style: 'background: var(--ceb-a20); color: var(--ceb);', text: 'Invited by the owner. Real data, read only, including Pro metrics.' },
        { name: 'Admin', style: 'background: var(--gen-a16); color: var(--gen);', text: 'Everything a viewer sees, plus bill upload and approval, access, plant settings and data health.' }
      ]
    };
  }
}
