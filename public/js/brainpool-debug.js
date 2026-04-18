// BRAINPOOL Debug System v1.0
// 에러 자동 감지 → 🔴 배지 + /api/log 경유 Supabase 저장
// ?debug=1 → 상세 패널 / 없어도 에러 감지+저장 항상 동작
// ?owner=KEY → 🔴 배지 표시

(function () {

  const LOG_URL   = 'https://hajunai-v2.vercel.app/api/log';
  const DEBUG     = new URLSearchParams(location.search).get('debug') === '1';
  const IS_OWNER  = !!new URLSearchParams(location.search).get('owner') || DEBUG;

  // ── 서비스 감지 ───────────────────────────────────────────
  const SERVICE =
    location.hostname.includes('corering') ? 'CoreRing' :
    location.hostname.includes('corechat') ? 'CoreChat' :
    location.hostname.includes('hajunai')  ? 'HajunAI'  :
    'CoreNull';

  // ── 환경 감지 ─────────────────────────────────────────────
  function getEnv() {
    const ua = navigator.userAgent;
    if (/KAKAOTALK/i.test(ua))   return 'kakao-inapp';
    if (/Instagram/i.test(ua))   return 'instagram-inapp';
    if (/FB_IAB/i.test(ua))      return 'facebook-inapp';
    if (/iPhone|iPad/i.test(ua)) return 'ios';
    if (/Android/i.test(ua))     return 'android';
    return 'desktop';
  }

  // ── 로컬 로그 ─────────────────────────────────────────────
  const logs = [];
  const apiStats = {};
  let errorCount = 0;

  // ── Supabase 저장 (API 라우트 경유) ───────────────────────
  const SAVE_TYPES = ['js_error', 'promise_error', 'api_error'];

  function saveLog(entry) {
    if (!SAVE_TYPES.includes(entry.type)) return;
    fetch(LOG_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service:    entry.service,
        error_type: entry.type,
        message:    entry.msg,
        url:        entry.url,
        env:        entry.env,
      })
    }).catch(() => {}); // 저장 실패 무시
  }

  // ── 로그 추가 ─────────────────────────────────────────────
  function push(type, msg, isError) {
    const entry = {
      t:       new Date().toISOString().slice(11, 23),
      type,
      msg:     String(msg).slice(0, 400),
      service: SERVICE,
      url:     location.pathname,
      env:     getEnv(),
    };
    logs.unshift(entry);
    if (logs.length > 100) logs.pop();

    if (isError) {
      errorCount++;
      updateBadge();
      saveLog(entry);
    }
    if (DEBUG) renderLogs();
  }

  // ── JS 에러 감지 ──────────────────────────────────────────
  window.onerror = function (msg, src, line, col) {
    push('js_error', `${msg} @ ${src?.split('/').pop()}:${line}:${col}`, true);
  };

  window.addEventListener('unhandledrejection', e => {
    const r = e.reason instanceof Error
      ? `${e.reason.name}: ${e.reason.message}`
      : String(e.reason);
    push('promise_error', r, true);
  });

  // ── fetch 가로채기 ────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const url    = typeof args[0] === 'string' ? args[0] : args[0]?.url || '?';
    const method = args[1]?.method || 'GET';
    const key    = `${method} ${url.split('?')[0]}`;

    // 자기 자신 저장 요청은 패스
    if (url.includes('/api/log')) return _fetch(...args);

    const t0 = Date.now();
    try {
      const res = await _fetch(...args);
      const ms  = Date.now() - t0;
      apiStats[key] = apiStats[key] || { ok: 0, fail: 0 };
      if (!res.ok) {
        apiStats[key].fail++;
        apiStats[key].lastErr = `HTTP ${res.status}`;
        push('api_error', `${key} → ${res.status} (${ms}ms)`, true);
      } else {
        apiStats[key].ok++;
        push('api_ok', `${key} ✓ (${ms}ms)`, false);
      }
      if (DEBUG) renderApiStats();
      return res;
    } catch (err) {
      apiStats[key] = apiStats[key] || { ok: 0, fail: 0 };
      apiStats[key].fail++;
      apiStats[key].lastErr = err.message;
      push('api_error', `${key} → NETWORK ERR ${err.message}`, true);
      if (DEBUG) renderApiStats();
      throw err;
    }
  };

  // ── 콘솔 가로채기 (debug=1 만) ────────────────────────────
  if (DEBUG) {
    ['log', 'warn', 'error', 'info'].forEach(m => {
      const orig = console[m].bind(console);
      console[m] = function (...args) {
        orig(...args);
        push(m, args.map(a => {
          if (typeof a === 'object') { try { return JSON.stringify(a).slice(0, 200); } catch { return String(a); } }
          return String(a);
        }).join(' '), m === 'error');
      };
    });
  }

  // ── 🔴 배지 ───────────────────────────────────────────────
  let badge = null;

  function createBadge() {
    if (!IS_OWNER || badge) return;
    const s = document.createElement('style');
    s.textContent = `
      @keyframes bp-pulse {
        0%,100% { box-shadow:0 0 0 0 rgba(248,81,73,.6); }
        50%     { box-shadow:0 0 0 7px rgba(248,81,73,0); }
      }
      #__bp_badge {
        position:fixed; top:60px; right:16px; z-index:99998;
        width:22px; height:22px; border-radius:50%;
        background:#f85149; border:2px solid #fff;
        cursor:pointer; display:none;
        animation:bp-pulse 1.5s infinite;
      }
    `;
    document.head.appendChild(s);
    badge = document.createElement('div');
    badge.id = '__bp_badge';
    badge.addEventListener('click', togglePanel);
    document.body.appendChild(badge);
  }

  function updateBadge() {
    if (!IS_OWNER) return;
    if (!badge) createBadge();
    badge.style.display = errorCount > 0 ? 'block' : 'none';
    badge.title = `에러 ${errorCount}건 · 클릭해서 확인`;
  }

  // ── 상세 패널 ─────────────────────────────────────────────
  let panel = null, panelOpen = false;

  function createPanel() {
    if (panel) return;
    const s = document.createElement('style');
    s.textContent = `
      #__bp_panel {
        position:fixed; bottom:0; left:0; right:0; z-index:99999;
        background:#0d1117; border-top:2px solid #30363d;
        font-family:'JetBrains Mono',monospace; font-size:11px;
        max-height:45vh; display:flex; flex-direction:column;
        box-shadow:0 -4px 24px rgba(0,0,0,.6);
        transform:translateY(100%); transition:transform .25s ease;
      }
      #__bp_panel.open { transform:translateY(0); }
      #__bp_panel .bh {
        display:flex; align-items:center; gap:8px; padding:6px 10px;
        background:#161b22; border-bottom:1px solid #30363d; flex-shrink:0;
      }
      #__bp_panel .bh-svc {
        background:#238636; color:#fff; border-radius:4px;
        padding:1px 7px; font-size:10px; letter-spacing:1px;
      }
      #__bp_panel .bh-ttl { color:#8b949e; font-size:10px; flex:1; }
      #__bp_panel .bt {
        background:none; border:1px solid #30363d; color:#8b949e;
        border-radius:4px; padding:2px 10px; font-size:10px;
        cursor:pointer; font-family:inherit;
      }
      #__bp_panel .bt.on { background:#21262d; color:#c9d1d9; border-color:#58a6ff; }
      #__bp_panel .bx {
        background:#21262d; border:1px solid #30363d; color:#c9d1d9;
        border-radius:4px; padding:2px 8px; cursor:pointer; font-family:inherit;
      }
      #__bp_panel .bb { overflow-y:auto; flex:1; }
      #__bp_panel .bp { display:none; padding:4px 0; }
      #__bp_panel .bp.on { display:block; }
      #__bp_panel .bl {
        padding:2px 10px; border-bottom:1px solid #161b22;
        display:flex; gap:8px; line-height:1.6;
      }
      #__bp_panel .bl .t { color:#484f58; flex-shrink:0; }
      #__bp_panel .bl .m { color:#c9d1d9; word-break:break-all; flex:1; }
      #__bp_panel .bl.e .m { color:#f85149; }
      #__bp_panel .bl.w .m { color:#e3b341; }
      #__bp_panel .bl.i .m { color:#58a6ff; }
      #__bp_panel .ba {
        padding:4px 10px; border-bottom:1px solid #161b22;
        display:flex; align-items:center; gap:8px; flex-wrap:wrap;
      }
      #__bp_panel .ba .k { color:#79c0ff; flex:1; word-break:break-all; }
      #__bp_panel .ba .o { color:#3fb950; font-size:10px; }
      #__bp_panel .ba .f { color:#f85149; font-size:10px; }
      #__bp_panel .ba .er { color:#e3b341; font-size:10px; flex-basis:100%; padding-left:8px; }
    `;
    document.head.appendChild(s);

    panel = document.createElement('div');
    panel.id = '__bp_panel';
    panel.innerHTML = `
      <div class="bh">
        <span class="bh-svc">${SERVICE}</span>
        <span class="bh-ttl">BRAINPOOL DEBUG v1.0</span>
        <button class="bt on" data-t="logs">LOG</button>
        <button class="bt"    data-t="api">API</button>
        <button class="bx"   id="__bp_x">✕</button>
      </div>
      <div class="bb">
        <div class="bp on" id="__bpl"></div>
        <div class="bp"    id="__bpa"></div>
      </div>`;
    document.body.appendChild(panel);

    document.getElementById('__bp_x').addEventListener('click', togglePanel);
    panel.querySelectorAll('.bt').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.bt').forEach(b => b.classList.remove('on'));
        panel.querySelectorAll('.bp').forEach(p => p.classList.remove('on'));
        btn.classList.add('on');
        document.getElementById('__bp' + btn.dataset.t[0])?.classList.add('on');
      });
    });
    renderLogs(); renderApiStats();
  }

  function togglePanel() {
    if (!panel) createPanel();
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
  }

  function ready(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  if (DEBUG) ready(() => { createPanel(); setTimeout(togglePanel, 100); });

  // ── 렌더 ──────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  const CLS = { js_error:'e', promise_error:'e', api_error:'e', error:'e', warn:'w', info:'i' };

  function renderLogs() {
    const el = document.getElementById('__bpl');
    if (!el) return;
    el.innerHTML = logs.map(l =>
      `<div class="bl ${CLS[l.type]||''}"><span class="t">${l.t}</span><span class="m">${esc(l.msg)}</span></div>`
    ).join('') || '<div style="padding:10px;color:#484f58;">로그 없음</div>';
  }

  function renderApiStats() {
    const el = document.getElementById('__bpa');
    if (!el) return;
    el.innerHTML = Object.entries(apiStats)
      .sort((a, b) => b[1].fail - a[1].fail)
      .map(([k, s]) =>
        `<div class="ba"><span class="k">${esc(k)}</span><span class="o">✓${s.ok}</span><span class="f">✗${s.fail}</span>${s.lastErr ? `<span class="er">${esc(s.lastErr)}</span>` : ''}</div>`
      ).join('') || '<div style="padding:10px;color:#484f58;">API 호출 없음</div>';
  }

  push('info', `[BRAINPOOL DEBUG v1.0] ${SERVICE} · ${getEnv()} · ${location.pathname}`, false);

})();