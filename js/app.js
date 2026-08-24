
let currentPortionToFeed = 1;

function updateConfirmPortionUI() {
  const valEl = document.getElementById('modal-confirm-portion-val');
  if (valEl) valEl.innerText = `${currentPortionToFeed} Porsi`;
}

window.changeConfirmPortion = function (delta) {
  currentPortionToFeed = Math.max(1, Math.min(5, currentPortionToFeed + delta));
  updateConfirmPortionUI();
};

window.showFeedModal = function (portion = 1) {
  currentPortionToFeed = parseInt(portion) || 1;
  updateConfirmPortionUI();
  const confirmModal = document.getElementById('modal-feeder-confirm');
  if (confirmModal) confirmModal.classList.add('active');
};
window.triggerShowFeedModal = window.showFeedModal;

// Ensure AquaponicsFirebase prototype safety
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    if (window.aquaponicsDB && !window.aquaponicsDB.addSchedule) {
      window.aquaponicsDB.addSchedule = function (time, portion) {
        console.log("[Firebase RTDB] Schedule saved:", time, portion);
        return Promise.resolve(true);
      };
    }
  });
}

/**
 * SMART AKUAPONIK IOT - DASHBOARD CONTROLLER & CHART.JS ENGINE
 */

document.addEventListener('DOMContentLoaded', () => {
  initAuthSystem();
  initNavigation();
  initThemeToggle();
  initNotificationDropdown();
  initCharts();
  initControlRelays();
  initFeedingScheduler();
  initPumpScheduler();
  initConfigModals();
  initRealtimeDataBinding();
});

// State Store
const state = {
  currentUser: null,
  activeTab: 'tab-beranda',
  activePeriod: 'harian',
  rawTelemetry: {
    suhu_air: 0.0,
    tds: 0,
    suhu_udara: 0.0,
    kelembaban: 0,
    level_air: 0.0,
    voltase_aki: 0.0
  },
  calibration: {
    tds_factor: 1.0,
    temp_w_offset: 0.0,
    temp_a_offset: 0.0,
    hum_offset: 0.0,
    level_offset: 0.0,
    volt_factor: 1.0,
    volt_offset: 0.0,
    pond_depth: 35.0,
    sensor_min_dist: 5.0
  },
  telemetry: {
    suhu_air: 0.0,
    tds: 0,
    suhu_udara: 0.0,
    kelembaban: 0,
    level_air: 0.0,
    voltase_aki: 0.0,
    status_daya: 'Aki 12V',
    status_gateway: 'Aktif'
  },
  relays: [0, 0, 0, 0, 0, 0],
  schedules: [
    { time: '08:00', portion: 1 },
    { time: '16:00', portion: 2 }
  ],
  pumpSchedules: [],
  notifications: [],
  charts: {}
};

/* ================= 1. NAVIGATION & UI TABS ================= */
function initNavigation() {
  const navBtns = document.querySelectorAll('.bottom-nav .nav-item, .sidebar-nav .nav-item');
  const panels = document.querySelectorAll('.tab-panel');
  const headerTitle = document.getElementById('header-title-text');
  const manageFeedLink = document.getElementById('manage-feed-link');

  const titleMap = {
    'tab-beranda': 'Smart Aquaponics',
    'tab-monitoring': 'Monitoring',
    'tab-control': 'Control',
    'tab-config': 'Config'
  };

  function switchTab(targetTabId) {
    navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === targetTabId);
    });

    panels.forEach(panel => {
      panel.classList.toggle('active', panel.id === targetTabId);
    });

    if (titleMap[targetTabId]) {
      headerTitle.innerText = titleMap[targetTabId];
    }
    state.activeTab = targetTabId;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (targetTabId === 'tab-monitoring') {
      setTimeout(() => {
        Object.values(state.charts).forEach(chart => chart.resize());
      }, 100);
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  if (manageFeedLink) {
    manageFeedLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('tab-control');
    });
  }
}

/* ================= 2. THEME TOGGLE ================= */
function initThemeToggle() {
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');

  if (themeBtn && themeIcon) {
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      themeIcon.className = isDark ? 'fa-regular fa-sun' : 'fa-regular fa-moon';
      if (typeof updateChartTheme === 'function') updateChartTheme(isDark);
    });
  }
}

/* ================= 3. INSTAGRAM STYLE NOTIFICATION DRAWER ================= */
let currentNotifFilter = 'all';

function getValidTimestamp(n) {
  if (!n) return Date.now();

  let val = n.timestamp !== undefined ? n.timestamp : n.time;

  if (typeof val === 'number' && !isNaN(val) && val > 1000000000) {
    return val;
  }

  if (typeof val === 'string') {
    let parsed = Number(val);
    if (!isNaN(parsed) && parsed > 1000000000) {
      return parsed;
    }
  }

  if (n.id && typeof n.id === 'string' && n.id.includes('notif_')) {
    const parts = n.id.split('_');
    if (parts.length >= 2) {
      let parsedIdTs = Number(parts[1]);
      if (!isNaN(parsedIdTs) && parsedIdTs > 1000000000) {
        return parsedIdTs;
      }
    }
  }

  return Date.now();
}

function getNotifDateGroup(n) {
  const ts = getValidTimestamp(n);
  const d = new Date(ts);
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const itemTime = d.getTime();

  if (itemTime >= todayStart) {
    return 'Hari Ini';
  } else if (itemTime >= yesterdayStart) {
    return 'Kemarin';
  } else {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function formatNotifTime(n) {
  const ts = getValidTimestamp(n);
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Helper Sanitasi Notifikasi: Hilangkan semua kurung () dan [], ganti dengan jeda baca tanda koma
function formatNotifSpeechText(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text;

  // 1. Hilangkan kurung siku: [KONTROL SAKLAR RELAY] -> KONTROL SAKLAR RELAY
  s = s.replace(/\[([^\]]*)\]/g, '$1');

  // 2. Ganti tanda perbandingan dalam kurung seperti (< 30%) atau (<= 11.7V) menjadi kata jeda
  s = s.replace(/\s*\(\s*<\s*([0-9.]+[^)]*)\)/gi, ', kurang dari $1');
  s = s.replace(/\s*\(\s*<=\s*([0-9.]+[^)]*)\)/gi, ', di bawah $1');
  s = s.replace(/\s*\(\s*>\s*([0-9.]+[^)]*)\)/gi, ', lebih dari $1');
  s = s.replace(/\s*\(\s*>=\s*([0-9.]+[^)]*)\)/gi, ', di atas $1');

  // 3. Ganti kurung bulat (isi) menjadi jeda koma: (isi) -> , isi
  s = s.replace(/\s*\(([^)]*)\)/g, ', $1');

  // 4. Hapus sisa kurung jika ada yang tertinggal
  s = s.replace(/[\(\)\[\]]/g, '');

  // 5. Rapikan tanda baca koma ganda atau spasi sebelum/sesudah koma & titik dua
  s = s.replace(/\s*,\s*,+/g, ',');
  s = s.replace(/:\s*,/g, ':');
  s = s.replace(/\s*,\s*/g, ', ');
  s = s.replace(/,\s*!/g, '!');
  s = s.replace(/,\s*\./g, '.');
  s = s.replace(/^,\s*/, '');
  s = s.replace(/\s+,$/, '');

  return s.trim();
}
window.formatNotifSpeechText = formatNotifSpeechText;

function initNotificationDropdown() {
  const bellBtn = document.getElementById('bell-btn');
  const drawer = document.getElementById('ig-notif-drawer');
  const overlay = document.getElementById('ig-notif-overlay');
  const closeBtn = document.getElementById('ig-notif-close-btn');
  const clearBtn = document.getElementById('clear-notif-btn');
  const markReadBtn = document.getElementById('mark-read-btn');
  const tabPills = document.querySelectorAll('.ig-tab-pill');

  function openDrawer() {
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    renderNotifications();
  }

  function closeDrawer() {
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  if (bellBtn) {
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDrawer();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  tabPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tabPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentNotifFilter = pill.dataset.filter || 'all';
      renderNotifications();
    });
  });

  if (markReadBtn) {
    markReadBtn.addEventListener('click', () => {
      if (state.notifications) {
        state.notifications.forEach(n => n.read = true);
      }
      renderNotifications();
      if (window.aquaponicsDB && window.aquaponicsDB.markNotificationsRead) {
        window.aquaponicsDB.markNotificationsRead();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.notifications = [];
      renderNotifications();
      if (window.aquaponicsDB && window.aquaponicsDB.clearNotifications) {
        window.aquaponicsDB.clearNotifications();
      }
    });
  }

  renderNotifications();
}

function renderNotifications() {
  const container = document.getElementById('notif-list-container');
  const countBadge = document.getElementById('bell-count');
  const unreadSubtext = document.getElementById('ig-notif-unread-count');

  if (!container) return;

  const notifs = state.notifications || [];
  const unreadCount = notifs.filter(n => !n.read).length;

  if (countBadge) {
    if (unreadCount > 0) {
      countBadge.innerText = unreadCount > 99 ? '99+' : unreadCount;
      countBadge.style.display = 'flex';
    } else {
      countBadge.style.display = 'none';
    }
  }

  if (unreadSubtext) {
    unreadSubtext.innerText = unreadCount > 0
      ? `${unreadCount} Notifikasi Belum Dibaca`
      : `Tidak ada notifikasi baru`;
  }

  let filtered = [...notifs];
  if (currentNotifFilter === 'telegram') {
    filtered = filtered.filter(n => n.source === 'telegram' || (n.title && n.title.toLowerCase().includes('telegram')));
  } else if (currentNotifFilter === 'warning') {
    filtered = filtered.filter(n => n.type === 'warning' || n.type === 'danger');
  }

  // Notifikasi terbaru selalu paling atas (Timestamp Descending akurat)
  filtered.sort((a, b) => getValidTimestamp(b) - getValidTimestamp(a));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="ig-empty-notif">
        <div class="ig-empty-bell-icon"><i class="fa-regular fa-bell"></i></div>
        <div class="ig-empty-text">Tidak ada notifikasi</div>
      </div>
    `;
    return;
  }

  const iconMap = {
    warning: 'fa-triangle-exclamation',
    danger: 'fa-triangle-exclamation',
    success: 'fa-circle-check',
    info: 'fa-circle-info'
  };

  let htmlResult = '';
  let lastGroup = null;

  filtered.forEach(n => {
    const groupName = getNotifDateGroup(n);
    if (groupName !== lastGroup) {
      htmlResult += `<div class="ig-section-header">${groupName}</div>`;
      lastGroup = groupName;
    }

    const isTelegram = n.source === 'telegram' || (n.title && n.title.toLowerCase().includes('telegram'));
    const isUnread = !n.read;
    const timeStr = formatNotifTime(n);

    let avatarClass = isTelegram ? 'source-telegram' : `type-${n.type || 'warning'}`;
    let avatarIcon = isTelegram
      ? '<i class="fa-brands fa-telegram"></i>'
      : `<i class="fa-solid ${iconMap[n.type] || 'fa-triangle-exclamation'}"></i>`;

    let titleText = formatNotifSpeechText(n.title || 'Notifikasi');
    if (!titleText.startsWith('⚠️') && !titleText.startsWith('ℹ️') && !titleText.startsWith('✅') && !titleText.startsWith('⚡') && !titleText.startsWith('🚨') && !titleText.startsWith('⏰') && !titleText.startsWith('☀️') && !titleText.startsWith('🔋')) {
      if (n.type === 'warning' || n.type === 'danger' || !n.type) {
        titleText = `⚠️ ${titleText}`;
      }
    }

    let descText = formatNotifSpeechText(n.desc || '');
    if (descText && !descText.includes('<strong>')) {
      descText = descText.replace(/^([A-Za-z0-9\s,]+:)/, '<strong>$1</strong>');
    }

    htmlResult += `
      <div class="ig-notif-item ${isUnread ? 'unread' : ''}" data-id="${n.id || ''}">
        <div class="ig-avatar-badge ${avatarClass}">
          ${avatarIcon}
        </div>
        <div class="ig-notif-content">
          <div class="ig-notif-title-line">${titleText}</div>
          <div class="ig-notif-desc">${descText}</div>
          <div class="ig-notif-time">${timeStr}</div>
        </div>
        <div class="ig-notif-right-actions">
          ${isUnread ? '<div class="ig-unread-dot"></div>' : ''}
          <button class="ig-notif-close-item" data-id="${n.id || ''}" title="Hapus Notifikasi">&times;</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = htmlResult;

  container.querySelectorAll('.ig-notif-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.ig-notif-close-item')) return;
      const id = item.dataset.id;
      const target = state.notifications.find(n => n.id == id);
      if (target && !target.read) {
        target.read = true;
        renderNotifications();
      }
    });
  });

  container.querySelectorAll('.ig-notif-close-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (id) {
        state.notifications = state.notifications.filter(n => n.id != id);
        renderNotifications();
      }
    });
  });
}

function addNotification(type, title, desc, source = 'system') {
  if (!state.notifications) state.notifications = [];
  const cleanTitle = formatNotifSpeechText(title || 'Notifikasi');
  const cleanDesc = formatNotifSpeechText(desc || '');
  const notifObj = {
    id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: type || 'info',
    title: cleanTitle,
    desc: cleanDesc,
    source: source || 'system',
    timestamp: Date.now(),
    read: false
  };
  state.notifications.unshift(notifObj);
  if (window.aquaponicsDB && window.aquaponicsDB.pushNotification) {
    window.aquaponicsDB.pushNotification(notifObj);
  }
  if (typeof renderNotifications === 'function') renderNotifications();
}
window.addNotification = addNotification;

/* ================= 4. REAL-TIME DATA BINDING & CALIBRATION ================= */
function loadCalibration() {
  try {
    const saved = localStorage.getItem('aquaponics_calibration');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Bersihkan nilai lama jika masih default 100cm atau 40cm atau 12cm
      if (parsed.pond_depth === 100.0 || parsed.pond_depth === 40.0 || parsed.pond_depth === 12.0 || !parsed.pond_depth) {
        parsed.pond_depth = 35.0;
      }
      if (!parsed.sensor_min_dist || parsed.sensor_min_dist < 10.0) {
        parsed.sensor_min_dist = 20.0; // Standar AJ-SR04M waterproof blind zone
      }
      state.calibration = Object.assign(state.calibration || {}, parsed);
    }
  } catch (e) {}

  if (window.aquaponicsDB && window.aquaponicsDB.db) {
    window.aquaponicsDB.db.ref('config/calibration').once('value').then(snap => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        if (val.pond_depth === 100.0 || val.pond_depth === 40.0 || val.pond_depth === 12.0 || !val.pond_depth) {
          val.pond_depth = 35.0;
        }
        if (!val.sensor_min_dist || val.sensor_min_dist < 10.0) {
          val.sensor_min_dist = 20.0;
        }
        state.calibration = Object.assign(state.calibration || {}, val);
        try {
          localStorage.setItem('aquaponics_calibration', JSON.stringify(state.calibration));
        } catch (e) {}
        applyCalibrationToTelemetry();
        if (typeof updateUI === 'function') updateUI();
        if (typeof window.updateLiveCalibrationBadges === 'function') window.updateLiveCalibrationBadges();
      }
    }).catch(() => {});
  }
}

function applyCalibrationToTelemetry() {
  const cal = state.calibration || {};
  const raw = state.rawTelemetry || {};

  if (raw.suhu_air !== undefined) {
    state.telemetry.suhu_air = parseFloat((raw.suhu_air + (cal.temp_w_offset || 0)).toFixed(1));
  }
  if (raw.tds !== undefined) {
    const factor = (cal.tds_factor !== undefined) ? cal.tds_factor : 1.0;
    state.telemetry.tds = Math.max(0, Math.round(raw.tds * factor));
  }
  if (raw.suhu_udara !== undefined) {
    state.telemetry.suhu_udara = parseFloat((raw.suhu_udara + (cal.temp_a_offset || 0)).toFixed(1));
  }
  if (raw.kelembaban !== undefined) {
    state.telemetry.kelembaban = Math.max(0, Math.min(100, Math.round(raw.kelembaban + (cal.hum_offset || 0))));
  }

  // KALKULASI LEVEL AIR: SEMAKIN DEKAT DENGAN SENSOR -> SEMAKIN MENDEKATI 100%
  if (raw.level_air !== undefined || raw.jarak_air !== undefined) {
    const depth = (cal.pond_depth && cal.pond_depth > 0) ? parseFloat(cal.pond_depth) : 35.0;
    const minDist = (cal.sensor_min_dist !== undefined && cal.sensor_min_dist >= 0) ? parseFloat(cal.sensor_min_dist) : 20.0;

    let calculatedLevel = 0.0;
    // Jika data jarak fisik riil (cm) tersedia dari sensor
    if (raw.jarak_air !== undefined && raw.jarak_air !== null && !isNaN(raw.jarak_air)) {
      const dist = parseFloat(raw.jarak_air);
      const usableSpan = depth - minDist; // Contoh: 35 - 20 = 15 cm

      if (dist <= minDist) {
        calculatedLevel = 100.0; // Jarak <= 20 cm -> 100% Full Penuh
      } else if (dist >= depth) {
        calculatedLevel = 0.0;   // Jarak >= 35 cm -> 0% Kosong
      } else if (usableSpan > 0.1) {
        // Jarak semakin kecil -> Persentase semakin naik ke 100%
        calculatedLevel = ((depth - dist) / usableSpan) * 100.0;
      }
    } else {
      // Menggunakan persentase level air dari transmitter
      calculatedLevel = parseFloat(raw.level_air || 0.0);
    }

    if (calculatedLevel < 0) calculatedLevel = 0.0;
    if (calculatedLevel > 100) calculatedLevel = 100.0;
    state.telemetry.level_air = Math.max(0, Math.min(100, parseFloat(calculatedLevel.toFixed(1))));
  }
  if (raw.voltase_aki !== undefined) {
    const vFactor = (cal.volt_factor !== undefined) ? cal.volt_factor : 1.0;
    state.telemetry.voltase_aki = Math.max(0, parseFloat((raw.voltase_aki * vFactor + (cal.volt_offset || 0)).toFixed(2)));
    checkAutoSolarPowerSwitch();
  }
}

function checkAutoSolarPowerSwitch() {
  const cal = state.calibration || {};
  const vBat = state.telemetry.voltase_aki;
  const threshold = (cal.vbat_solar_threshold !== undefined && cal.vbat_solar_threshold > 0) ? cal.vbat_solar_threshold : 11.7;

  // Jika voltase aki drop di bawah ambang batas (<= 11.7V) dan Relay 1 (Panel Surya) belum menyala
  if (vBat > 1.0 && vBat <= threshold && state.relays[0] === 0 && cal.auto_solar_enabled !== false) {
    console.log(`[Auto Solar ATS] Low Battery detected (${vBat.toFixed(2)}V <= ${threshold}V). Activating Relay 1 (Panel Surya)!`);
    state.relays[0] = 1;
    if (window.aquaponicsDB && typeof window.aquaponicsDB.updateRelayState === 'function') {
      window.aquaponicsDB.updateRelayState(1, 1);
    }
    if (typeof syncRelayUI === 'function') syncRelayUI();
    if (typeof addNotification === 'function') {
      addNotification('warning', 'Auto-Switch Panel Surya', `Tegangan Aki Rendah (${vBat.toFixed(2)}V \u2264 ${threshold}V). Relay Panel Surya otomatis dinyalakan!`);
    }
  }
}

function initRealtimeDataBinding() {
  loadCalibration();

  if (window.aquaponicsDB) {
    window.aquaponicsDB.subscribeTelemetry(data => {
      if (data) {
        let updated = false;

        // 1. Simpan nilai mentah (Raw Sensor Reading)
        if (data.suhu_air !== undefined) { state.rawTelemetry.suhu_air = parseFloat(data.suhu_air); updated = true; }
        else if (data.temp_w !== undefined) { state.rawTelemetry.suhu_air = parseFloat(data.temp_w); updated = true; }

        if (data.tds !== undefined) { state.rawTelemetry.tds = parseFloat(data.tds); updated = true; }

        if (data.suhu_udara !== undefined) { state.rawTelemetry.suhu_udara = parseFloat(data.suhu_udara); updated = true; }
        else if (data.temp_a !== undefined) { state.rawTelemetry.suhu_udara = parseFloat(data.temp_a); updated = true; }

        if (data.kelembaban !== undefined) { state.rawTelemetry.kelembaban = parseFloat(data.kelembaban); updated = true; }
        else if (data.hum !== undefined) { state.rawTelemetry.kelembaban = parseFloat(data.hum); updated = true; }

        if (data.level_air !== undefined) { state.rawTelemetry.level_air = parseFloat(data.level_air); updated = true; }
        else if (data.water_level !== undefined) { state.rawTelemetry.level_air = parseFloat(data.water_level); updated = true; }

        if (data.jarak_air !== undefined) { state.rawTelemetry.jarak_air = parseFloat(data.jarak_air); updated = true; }
        else if (data.dist_cm !== undefined) { state.rawTelemetry.jarak_air = parseFloat(data.dist_cm); updated = true; }
        else if (data.distance_cm !== undefined) { state.rawTelemetry.jarak_air = parseFloat(data.distance_cm); updated = true; }

        if (data.voltase_aki !== undefined) { state.rawTelemetry.voltase_aki = parseFloat(data.voltase_aki); updated = true; }
        else if (data.v_bat !== undefined) { state.rawTelemetry.voltase_aki = parseFloat(data.v_bat); updated = true; }

        if (data.status_daya !== undefined) { state.telemetry.status_daya = data.status_daya; updated = true; }
        else if (data.lamp !== undefined) { state.telemetry.status_daya = (data.lamp == 1 ? "Panel Surya" : "Aki 12V"); updated = true; }

        // 2. Terapkan Kalibrasi Presisi (Faktor & Offset)
        applyCalibrationToTelemetry();

        // 3. Update Live Badge pada Modal Kalibrasi jika sedang terbuka
        if (typeof window.updateLiveCalibrationBadges === 'function') {
          window.updateLiveCalibrationBadges();
        }

        // Feeder CH6 (Index 5): Pastikan sinkron hanya saat proses pakan selesai
        if (!window.feedCountdownInterval && state.relays[5] !== 0) {
          state.relays[5] = 0;
          if (typeof syncRelayUI === 'function') syncRelayUI();
        }

        if (updated) {
          updateUI();
          pushRealtimeChartData(state.telemetry);
        }
      }
    });

    // Opsional: Berlangganan status saklar relay resmi dari Firebase jika ada perubahan eksternal
    if (typeof window.aquaponicsDB.subscribeRelayStates === 'function') {
      window.aquaponicsDB.subscribeRelayStates(relaysObj => {
        if (relaysObj && typeof relaysObj === 'object') {
          const rKeys = ["ats_solar", "pembesaran", "peremajaan", "aerator", "cadangan", "feeder"];
          let rChanged = false;
          rKeys.forEach((key, idx) => {
            if (idx === 5) return; // Feeder dikontrol oleh timer 10 detik
            if (relaysObj[key] !== undefined) {
              const val = parseInt(relaysObj[key]) || 0;
              if (state.relays[idx] !== val) {
                state.relays[idx] = val;
                rChanged = true;
              }
            }
          });
          if (rChanged && typeof syncRelayUI === 'function') syncRelayUI();
        }
      });
    }

    if (window.aquaponicsDB.subscribeNotifications) {
      window.aquaponicsDB.subscribeNotifications(list => {
        if (Array.isArray(list)) {
          state.notifications = list;
          renderNotifications();
        }
      });
    }

    if (window.aquaponicsDB.subscribePumpSchedules) {
      window.aquaponicsDB.subscribePumpSchedules(list => {
        if (Array.isArray(list)) {
          state.pumpSchedules = list;
          if (typeof renderPumpSchedules === 'function') renderPumpSchedules();
        }
      });
    }
  }

  // 1-detik sinkronisasi realtime untuk pembacaan per detik tanpa terputus
  setInterval(() => {
    updateUI();
    if (state.telemetry) {
      pushRealtimeChartData(state.telemetry);
    }
  }, 1000);
}

let lastStableTelemetry = {
  suhu_air: 26.8,
  tds: 580,
  level_air: 75.0,
  suhu_udara: 27.5
};

function pushRealtimeChartData(data) {
  const charts = state.charts;
  if (!charts) return;

  const currentT = state.telemetry || {};
  let rawSuhuAir = (data && data.suhu_air !== undefined) ? parseFloat(data.suhu_air) : ((data && data.temp_w !== undefined) ? parseFloat(data.temp_w) : currentT.suhu_air);
  let rawTds = (data && data.tds !== undefined) ? Math.round(data.tds) : currentT.tds;
  let rawLevel = (data && data.level_air !== undefined) ? parseFloat(data.level_air) : ((data && data.water_level !== undefined) ? parseFloat(data.water_level) : currentT.level_air);
  let rawSuhuUd = (data && data.suhu_udara !== undefined) ? parseFloat(data.suhu_udara) : ((data && data.temp_a !== undefined) ? parseFloat(data.temp_a) : currentT.suhu_udara);

  // Filter kestabilan sensor: tahan nilai riil terakhir jika ada glitch sesaat
  if (rawSuhuAir !== undefined && !isNaN(rawSuhuAir) && rawSuhuAir >= 15.0 && rawSuhuAir <= 45.0) {
    lastStableTelemetry.suhu_air = rawSuhuAir;
  }
  if (rawTds !== undefined && !isNaN(rawTds) && rawTds > 0) {
    lastStableTelemetry.tds = rawTds;
  }
  if (rawLevel !== undefined && !isNaN(rawLevel) && rawLevel > 0.0) {
    lastStableTelemetry.level_air = rawLevel;
  }
  if (rawSuhuUd !== undefined && !isNaN(rawSuhuUd) && rawSuhuUd >= 10.0 && rawSuhuUd <= 50.0) {
    lastStableTelemetry.suhu_udara = rawSuhuUd;
  }

  const suhuAirVal = (rawSuhuAir !== undefined && !isNaN(rawSuhuAir) && rawSuhuAir >= 15.0 && rawSuhuAir <= 45.0) ? rawSuhuAir : lastStableTelemetry.suhu_air;
  const tdsVal = (rawTds !== undefined && !isNaN(rawTds) && rawTds > 0) ? rawTds : lastStableTelemetry.tds;
  const levelAirVal = (rawLevel !== undefined && !isNaN(rawLevel) && rawLevel > 0.0) ? rawLevel : lastStableTelemetry.level_air;
  const suhuUdaraVal = (rawSuhuUd !== undefined && !isNaN(rawSuhuUd) && rawSuhuUd >= 10.0 && rawSuhuUd <= 50.0) ? rawSuhuUd : lastStableTelemetry.suhu_udara;

  // 1. Update Chart Header Badges seketika
  if (suhuAirVal !== undefined && !isNaN(suhuAirVal)) {
    const bSuhuAir = document.getElementById('badge-chart-suhu-air');
    if (bSuhuAir) bSuhuAir.innerHTML = `${suhuAirVal.toFixed(1)} &deg;C`;
  }
  if (tdsVal !== undefined && !isNaN(tdsVal)) {
    const bTds = document.getElementById('badge-chart-tds');
    if (bTds) bTds.innerText = `${tdsVal} PPM`;
  }
  if (levelAirVal !== undefined && !isNaN(levelAirVal)) {
    const bLevelAir = document.getElementById('badge-chart-level-air');
    if (bLevelAir) bLevelAir.innerText = `${levelAirVal.toFixed(1)}%`;
  }
  if (suhuUdaraVal !== undefined && !isNaN(suhuUdaraVal)) {
    const bSuhuUdara = document.getElementById('badge-chart-suhu-udara');
    if (bSuhuUdara) bSuhuUdara.innerHTML = `${suhuUdaraVal.toFixed(1)} &deg;C`;
  }

  // 2. Real-Time Dynamic Stream for Charts
  const period = String(state.activePeriod || 'harian').toLowerCase().trim();
  const now = new Date();
  const curHour = String(now.getHours()).padStart(2, '0');
  const curMin = String(now.getMinutes()).padStart(2, '0');
  const curTimeStr = `${curHour}:${curMin}`;

  const updateChartDataset = (chart, val) => {
    if (!chart) return;
    const targetVal = (val !== undefined && !isNaN(val)) ? val : 0;
    const labels = chart.data.labels;
    const dataset = chart.data.datasets[0];
    if (!labels || !dataset || !dataset.data) return;

    if (period === 'harian' || period === 'daily') {
      // Pastikan data selalu sinkron persis dengan panjang labels (10 titik)
      while (dataset.data.length < labels.length) {
        dataset.data.push(targetVal);
      }
      while (dataset.data.length > labels.length) {
        dataset.data.pop();
      }

      const lastLabel = labels[labels.length - 1];
      if (lastLabel !== curTimeStr) {
        labels.shift();
        labels.push(curTimeStr);
        dataset.data.shift();
        dataset.data.push(targetVal);
        chart.update({
          duration: 450,
          easing: 'easeOutQuad'
        });
      } else {
        dataset.data[dataset.data.length - 1] = targetVal;
        chart.update('none');
      }
    } else if (period === 'mingguan' || period === 'weekly') {
      // Perbarui titik hari berjalan (hari ini) secara realtime
      dataset.data[dataset.data.length - 1] = targetVal;
      chart.update('none');
    } else {
      // Bulanan: perbarui titik bulan berjalan terakhir (Agustus 2026) secara realtime
      dataset.data[dataset.data.length - 1] = targetVal;
      chart.update('none');
    }
  };

  updateChartDataset(charts.suhuAir, suhuAirVal);
  updateChartDataset(charts.tds, tdsVal);
  updateChartDataset(charts.levelAir, levelAirVal);
  updateChartDataset(charts.suhuUdara, suhuUdaraVal);

  if (suhuUdaraVal !== undefined && charts.miniSuhuUdara) {
    const miniD = charts.miniSuhuUdara.data.datasets[0].data;
    miniD[miniD.length - 1] = suhuUdaraVal;
    charts.miniSuhuUdara.update({
      duration: 350,
      easing: 'easeOutQuad'
    });
  }
}

const TELEGRAM_CONFIG = {
  botToken: "8758597072:AAEe0ymSD2RfdiCAoF4EoCfLpf2oeOdW3NM",
  chatId: "7207067918",
  lastAlerts: {}
};

async function sendTelegramAlert(key, text, isInstant = false) {
  const now = Date.now();
  // 3 Menit Cooldown (180,000 ms) untuk alert kritis, instant untuk saklar relay
  if (!isInstant && TELEGRAM_CONFIG.lastAlerts[key] && (now - TELEGRAM_CONFIG.lastAlerts[key] < 180000)) return;
  TELEGRAM_CONFIG.lastAlerts[key] = now;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CONFIG.chatId, text: text, parse_mode: "HTML" })
    });
    console.log(`[Telegram Alert Sent]: ${key}`);
  } catch (e) {
    console.warn("[Telegram Web Error]", e);
  }

  // Masukkan semua notifikasi Telegram & Alert ke ikon lonceng web
  try {
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const title = lines[0] || 'Notifikasi System';
    const desc = lines.length > 1 ? lines.slice(1).join(' ') : title;
    const isAlert = key.includes('web_level_air') || key.includes('web_tds') || key.includes('web_suhu') || key.includes('alert');
    const type = isAlert ? 'warning' : (key.includes('feed') ? 'success' : 'info');
    addNotification(type, title, desc, 'system');
  } catch (err) {
    console.warn('[Web Notif Error]', err);
  }
}

// Periodic 7-Day Telegram Report Engine (Laporan Periodik Hanya Setiap 7 Hari)
setInterval(() => {
  if (state.telemetry && state.telemetry.suhu_air !== undefined) {
    const t = state.telemetry;
    const statusAir = (t.suhu_air >= 24 && t.suhu_air <= 32) ? "Normal" : "KRITIS!";
    const statusTds = (t.tds < 400) ? "Rendah" : (t.tds > 900 ? "Pekat!" : "Optimal");
    const statusWater = (t.level_air >= 30) ? "Aman" : "Dangkal!";

    const reportMsg = `\u{1F4CA} <b>[LAPORAN MINGGUAN AKUAPONIK]</b>\n\u{23F1}\u{FE0F} <i>Interval: Setiap 7 Hari</i>\n\n` +
      `\u{1F321}\u{FE0F} <b>Suhu Air:</b> ${t.suhu_air.toFixed(1)} \u{00B0}C (${statusAir})\n` +
      `\u{1F9EA} <b>TDS Nutrisi:</b> ${Math.round(t.tds)} PPM (${statusTds})\n` +
      `\u{2600}\u{FE0F} <b>Suhu Udara:</b> ${t.suhu_udara.toFixed(1)} \u{00B0}C (${Math.round(t.kelembaban)}% RH)\n` +
      `\u{1F30A} <b>Ketinggian Air:</b> ${t.level_air.toFixed(1)} % (${statusWater})\n\n` +
      `\u{1F7E2} <i>Sistem IoT berjalan normal.</i>`;

    sendTelegramAlert('periodic_7day_report_' + Math.floor(Date.now() / 604800000), reportMsg, true);
  }
}, 604800000); // 7 Hari = 604,800,000 ms

function updateUI() {
  const critIcon = '<i class="fa-solid fa-circle-exclamation text-critical-red"></i> ';

  // 1. Suhu Air Kolam (Optimal 24 - 32°C)
  const suhuAir = state.telemetry.suhu_air;
  const elSuhuAir = document.getElementById('val-suhu-air');
  const badgeSuhuAir = document.getElementById('badge-suhu-air');
  const isSuhuAirCritical = suhuAir < 24.0 || suhuAir > 32.0;

  if (isSuhuAirCritical) {
    elSuhuAir.classList.add('text-critical-red');
    elSuhuAir.classList.remove('text-emerald');
    if (badgeSuhuAir) {
      badgeSuhuAir.className = 'badge-status status-red';
      badgeSuhuAir.innerHTML = `${critIcon}${suhuAir < 24.0 ? 'Suhu Dingin!' : 'Suhu Panas!'}`;
    }
  } else {
    elSuhuAir.classList.remove('text-critical-red');
    elSuhuAir.classList.add('text-emerald');
    if (badgeSuhuAir) {
      badgeSuhuAir.className = 'badge-status status-green';
      badgeSuhuAir.innerHTML = '<span class="status-dot green"></span> Stabil';
    }
  }
  elSuhuAir.innerHTML = `${suhuAir.toFixed(1)}&deg;C`;

  // 2. TDS Nutrisi Air (Optimal 400 - 900 PPM)
  const tdsVal = Math.round(state.telemetry.tds);
  const elTds = document.getElementById('val-tds');
  const tdsStatusEl = document.getElementById('status-tds');
  const tdsRingFill = document.getElementById('tds-ring-fill');
  const isTdsCritical = tdsVal < 400 || tdsVal > 900;

  if (isTdsCritical) {
    if (elTds) {
      elTds.classList.add('text-critical-red');
      elTds.classList.remove('text-sky-val');
    }
    if (tdsStatusEl) {
      if (tdsVal < 400) {
        tdsStatusEl.className = 'air-temp-status-pill status-amber-pill';
        tdsStatusEl.innerHTML = 'Rendah';
      } else {
        tdsStatusEl.className = 'air-temp-status-pill red-pill';
        tdsStatusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Pekat';
      }
    }
  } else {
    if (elTds) {
      elTds.classList.remove('text-critical-red');
      elTds.classList.add('text-sky-val');
    }
    if (tdsStatusEl) {
      tdsStatusEl.className = 'air-temp-status-pill status-blue-pill';
      tdsStatusEl.innerHTML = '<span class="status-dot green"></span> Optimal';
    }
  }
  if (elTds) elTds.innerHTML = `${tdsVal}`;

  // SVG TDS Ring: Circumference = 157.1 (Matches Kelembaban Udara)
  if (tdsRingFill) {
    const tdsPct = Math.min(100, Math.max(0, (tdsVal / 1000) * 100));
    const offset = 157.1 - (157.1 * tdsPct) / 100;
    tdsRingFill.style.strokeDashoffset = offset;

    if (tdsVal > 900) {
      tdsRingFill.style.stroke = '#EF4444';
    } else if (tdsVal < 400) {
      tdsRingFill.style.stroke = '#F59E0B';
    } else {
      tdsRingFill.style.stroke = '#0284C7';
    }
  }

  // 3. Suhu Udara Ambient (Optimal 20 - 33°C)
  const suhuUdara = state.telemetry.suhu_udara;
  const elSuhuUdara = document.getElementById('val-suhu-udara');
  const badgeSuhuUdara = document.getElementById('badge-suhu-udara');
  const isSuhuUdaraCritical = suhuUdara < 20.0 || suhuUdara > 33.0;

  if (isSuhuUdaraCritical) {
    if (elSuhuUdara) {
      elSuhuUdara.style.color = '#EF4444';
    }
    if (badgeSuhuUdara) {
      badgeSuhuUdara.className = 'air-temp-status-pill red-pill';
      badgeSuhuUdara.style.background = '#FEE2E2';
      badgeSuhuUdara.style.color = '#DC2626';
      badgeSuhuUdara.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${suhuUdara < 20.0 ? 'Udara Dingin!' : 'Udara Panas!'}`;
    }
  } else {
    if (elSuhuUdara) {
      elSuhuUdara.style.color = '#EA580C';
    }
    if (badgeSuhuUdara) {
      badgeSuhuUdara.className = 'air-temp-status-pill';
      badgeSuhuUdara.style.background = '#FFEDD5';
      badgeSuhuUdara.style.color = '#C2410C';
      badgeSuhuUdara.innerHTML = '<span class="air-status-dot"></span> Normal';
    }
  }
  if (elSuhuUdara) elSuhuUdara.innerHTML = `${suhuUdara.toFixed(1)}&deg;C`;

  // Scale Equalizer Bars dynamically according to current air temperature
  const equalizerBars = document.querySelectorAll('#air-temp-equalizer .air-bar');
  if (equalizerBars.length > 0) {
    const tempRatio = Math.max(0.5, Math.min(1.4, suhuUdara / 27));
    const baseHeights = [35, 58, 90, 72, 48, 82, 96];
    equalizerBars.forEach((bar, idx) => {
      const scaledH = Math.round(baseHeights[idx] * tempRatio);
      bar.style.height = `${Math.min(100, Math.max(15, scaledH))}%`;
    });
  }

  // 4. Kelembaban Udara (Optimal 50 - 90%)
  const kelembaban = Math.round(state.telemetry.kelembaban);
  const elKelembaban = document.getElementById('val-kelembaban');
  const statusKelembaban = document.getElementById('status-kelembaban');
  const humidityRingFill = document.getElementById('humidity-ring-fill');
  const isKelembabanCritical = kelembaban < 50 || kelembaban > 90;

  if (isKelembabanCritical) {
    if (elKelembaban) {
      elKelembaban.classList.add('text-critical-red');
      elKelembaban.classList.remove('text-purple');
    }
    if (statusKelembaban) {
      statusKelembaban.className = 'warning-alert-text text-critical-red font-weight-700';
      statusKelembaban.innerHTML = `${critIcon}${kelembaban < 50 ? 'Udara Kering' : 'Udara Lembab'}`;
    }
  } else {
    if (elKelembaban) {
      elKelembaban.classList.remove('text-critical-red');
      elKelembaban.classList.add('text-purple');
    }
    if (statusKelembaban) {
      statusKelembaban.className = 'badge-status status-purple';
      statusKelembaban.innerHTML = '<span class="status-dot purple"></span> Optimal';
    }
  }
  if (elKelembaban) elKelembaban.innerHTML = `${kelembaban}%`;

  // SVG Humidity Ring: Circumference = 157.1 (Tanpa Getar)
  if (humidityRingFill) {
    const humPct = Math.min(100, Math.max(0, kelembaban));
    const offset = 157.1 - (157.1 * humPct) / 100;
    humidityRingFill.style.strokeDashoffset = offset;
    if (isKelembabanCritical) {
      humidityRingFill.style.stroke = '#EF4444';
    } else {
      humidityRingFill.style.stroke = '#8B5CF6';
    }
  }

  const levelAir = state.telemetry.level_air;
  const elLevelAir = document.getElementById('val-level-air');
  const badgeLevelAir = document.getElementById('badge-level-air');
  const ringFill = document.getElementById('water-ring-fill');
  const isLevelAirCritical = levelAir < 30.0;

  if (isLevelAirCritical) {
    elLevelAir.classList.add('text-critical-red');
    elLevelAir.classList.remove('text-teal');
    if (badgeLevelAir) {
      badgeLevelAir.className = 'badge-status status-red margin-v-4';
      badgeLevelAir.innerHTML = `${critIcon}Air Kritis!`;
    }
  } else {
    elLevelAir.classList.remove('text-critical-red');
    elLevelAir.classList.add('text-teal');
    if (badgeLevelAir) {
      badgeLevelAir.className = 'badge-status status-green margin-v-4';
      badgeLevelAir.innerHTML = '<span class="status-dot green"></span> Pompa Aman';
    }
  }
  elLevelAir.innerHTML = `${levelAir.toFixed(1)}%`;

  // SVG Ring Calculation (Circumference = 2 * PI * 40 ≈ 251.2)
  if (ringFill) {
    const offset = 251.2 - (251.2 * levelAir) / 100;
    ringFill.style.strokeDashoffset = offset;
  }

  // Trigger Automatic Telegram Alerts for Web Dashboard when thresholds breached
  if (isLevelAirCritical) {
    sendTelegramAlert('web_level_air', `🚨 <b>PERINGATAN DARURAT AKUAPONIK!</b>\nKetinggian air kolam terdeteksi <b>${levelAir.toFixed(1)}%</b>, kurang dari 30%.\n\n<i>Harap segera isi ulang air kolam!</i>`);
  }
  if (isTdsCritical) {
    if (tdsVal < 400) {
      sendTelegramAlert('web_tds_low', `⚠️ <b>PERINGATAN NUTRISI RENDAH!</b>\nKadar TDS air terdeteksi <b>${tdsVal} PPM</b>, kurang dari 400 PPM.\n\n<i>Disarankan menambahkan nutrisi AB Mix!</i>`);
    } else {
      sendTelegramAlert('web_tds_high', `⚠️ <b>PERINGATAN NUTRISI PEKAT!</b>\nKadar TDS air terdeteksi <b>${tdsVal} PPM</b>, lebih dari 900 PPM.\n\n<i>Risiko ujung daun terbakar, harap kurangi kepekatan nutrisi!</i>`);
    }
  }
  if (isSuhuAirCritical && suhuAir > 0.0) {
    sendTelegramAlert('web_suhu_air', `⚠️ <b>PERINGATAN SUHU AIR KOLAM!</b>\nSuhu air kolam terdeteksi <b>${suhuAir.toFixed(1)}°C</b>.\n\n<i>Harap periksa sirkulasi air kolam!</i>`);
  }

  // 5. Voltase Aki & Status Daya (Auto Cut-Off 11.7V & Switching Panel Surya)
  const vAki = (state.telemetry.voltase_aki !== undefined) ? state.telemetry.voltase_aki : 0.0;
  const elVoltase = document.getElementById('val-voltase-aki');
  const pillDaya = document.getElementById('pill-status-daya');
  const isVoltageLow = (vAki <= 11.7 && vAki >= 6.0);

  if (elVoltase) {
    elVoltase.innerHTML = `${vAki.toFixed(2)} V`;
    if (isVoltageLow) {
      elVoltase.className = 'power-val text-critical-red font-weight-800';
    } else {
      elVoltase.className = 'power-val text-blue font-weight-800';
    }
  }

  if (pillDaya) {
    if (state.relays[0] === 1 || isVoltageLow) {
      pillDaya.className = 'power-pill status-power-solar';
      pillDaya.innerHTML = '☀️ Panel Surya, Aktif';
    } else {
      pillDaya.className = 'power-pill status-power-normal';
      pillDaya.innerHTML = '🔋 Aki 12V, Normal';
    }
  }

  if (isVoltageLow) {
    sendTelegramAlert('web_voltage_low', `⚠️ <b>PERINGATAN VOLTASE AKI KRITIS!</b>\nVoltase aki terdeteksi <b>${vAki.toFixed(1)} V</b>, di bawah 11.7V.\n\n<i>Sistem otomatis memutus mesin dan beralih ke <b>Panel Surya, ATS Switch ON</b>!</i>`);
  }

  // Update Chart Badges & Monitoring Tab Mini KPI Items
  const bSuhuAir = document.getElementById('badge-chart-suhu-air');
  if (bSuhuAir) bSuhuAir.innerHTML = `${state.telemetry.suhu_air.toFixed(1)} &deg;C`;

  const bTds = document.getElementById('badge-chart-tds');
  if (bTds) bTds.innerText = `${tdsVal} PPM`;

  const bLevelAir = document.getElementById('badge-chart-level-air');
  if (bLevelAir) bLevelAir.innerText = `${levelAir.toFixed(1)}%`;

  const bSuhuUdara = document.getElementById('badge-chart-suhu-udara');
  if (bSuhuUdara) bSuhuUdara.innerHTML = `${state.telemetry.suhu_udara.toFixed(1)} &deg;C`;

  // Mini KPI Cards in Monitoring Tab
  const monKpiSuhuAir = document.getElementById('mon-kpi-suhu-air');
  const monBadgeSuhuAir = document.getElementById('mon-badge-suhu-air');
  if (monKpiSuhuAir) monKpiSuhuAir.innerHTML = `${state.telemetry.suhu_air.toFixed(1)} &deg;C`;
  if (monBadgeSuhuAir) {
    monBadgeSuhuAir.className = (suhuAir >= 24 && suhuAir <= 32) ? 'kpi-badge badge-green' : 'kpi-badge badge-red';
    monBadgeSuhuAir.innerText = (suhuAir >= 24 && suhuAir <= 32) ? 'Optimal' : 'Perhatian';
  }

  const monKpiTds = document.getElementById('mon-kpi-tds');
  const monBadgeTds = document.getElementById('mon-badge-tds');
  if (monKpiTds) monKpiTds.innerText = `${tdsVal} PPM`;
  if (monBadgeTds) {
    monBadgeTds.className = (tdsVal >= 400 && tdsVal <= 900) ? 'kpi-badge badge-green' : (tdsVal < 400 ? 'kpi-badge badge-amber' : 'kpi-badge badge-red');
    monBadgeTds.innerText = (tdsVal >= 400 && tdsVal <= 900) ? 'Optimal' : (tdsVal < 400 ? 'Rendah' : 'Pekat');
  }

  const monKpiLevelAir = document.getElementById('mon-kpi-level-air');
  const monBadgeLevelAir = document.getElementById('mon-badge-level-air');
  if (monKpiLevelAir) monKpiLevelAir.innerText = `${levelAir.toFixed(1)}%`;
  if (monBadgeLevelAir) {
    monBadgeLevelAir.className = (levelAir >= 60) ? 'kpi-badge badge-cyan' : 'kpi-badge badge-red';
    monBadgeLevelAir.innerText = (levelAir >= 60) ? 'Aman' : 'Kritis';
  }

  const monKpiSuhuUdara = document.getElementById('mon-kpi-suhu-udara');
  const monBadgeSuhuUdara = document.getElementById('mon-badge-suhu-udara');
  if (monKpiSuhuUdara) monKpiSuhuUdara.innerHTML = `${state.telemetry.suhu_udara.toFixed(1)} &deg;C`;
  if (monBadgeSuhuUdara) {
    monBadgeSuhuUdara.className = (state.telemetry.suhu_udara >= 20 && state.telemetry.suhu_udara <= 33) ? 'kpi-badge badge-orange' : 'kpi-badge badge-red';
    monBadgeSuhuUdara.innerText = (state.telemetry.suhu_udara >= 20 && state.telemetry.suhu_udara <= 33) ? 'Normal' : 'Ekstrem';
  }

  // Update Dynamic Ecosystem Status (Fish water level & Plant TDS health)
  updateEcosystemStatus();

  // Update feeding countdown
  updateFeedingCountdown();
}

function updateEcosystemStatus() {
  const levelAir = state.telemetry.level_air;
  const suhuAir = state.telemetry.suhu_air;
  const tdsVal = Math.round(state.telemetry.tds);

  // ================= 1. KONDISI IKAN (BERDASARKAN SUHU AIR KOLAM) =================
  const ecoFishGroup = document.getElementById('eco-fish-group');
  const ecoBubblesGroup = document.getElementById('eco-bubbles-group');
  const ecoFishPill = document.getElementById('eco-fish-status-pill');
  const fishColorTop = document.getElementById('fish-color-top');
  const fishColorMid = document.getElementById('fish-color-mid');
  const fishColorBelly = document.getElementById('fish-color-belly');
  const fishFinBase = document.getElementById('fish-fin-base');

  const isTempCritical = suhuAir > 0.0 && (suhuAir < 24.0 || suhuAir > 32.0);

  if (isTempCritical) {
    if (suhuAir > 32.0) {
      // Suhu Panas (Kemerahan Stres)
      if (fishColorTop) fishColorTop.setAttribute('stop-color', '#DC2626');
      if (fishColorMid) fishColorMid.setAttribute('stop-color', '#EF4444');
      if (fishColorBelly) fishColorBelly.setAttribute('stop-color', '#FCA5A5');
      if (fishFinBase) fishFinBase.setAttribute('stop-color', '#DC2626');
    } else {
      // Suhu Dingin (Biru Pasif)
      if (fishColorTop) fishColorTop.setAttribute('stop-color', '#1D4ED8');
      if (fishColorMid) fishColorMid.setAttribute('stop-color', '#3B82F6');
      if (fishColorBelly) fishColorBelly.setAttribute('stop-color', '#93C5FD');
      if (fishFinBase) fishFinBase.setAttribute('stop-color', '#2563EB');
    }
    if (ecoFishGroup) {
      ecoFishGroup.style.transform = `translate(10px, 12px) rotate(22deg)`;
    }
    if (ecoBubblesGroup) ecoBubblesGroup.style.display = 'none';
    if (ecoFishPill) {
      ecoFishPill.className = 'eco-status-pill red-pill';
      if (suhuAir > 32.0) {
        ecoFishPill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>Suhu Panas (${suhuAir.toFixed(1)}&deg;C): Ikan Stres!</span>`;
      } else {
        ecoFishPill.innerHTML = `<i class="fa-solid fa-snowflake"></i><span>Suhu Dingin (${suhuAir.toFixed(1)}&deg;C): Ikan Pasif</span>`;
      }
    }
  } else {
    // Normal Sehat (Ikan Lele Hitam / Abu-Abu Berkilau)
    if (fishColorTop) fishColorTop.setAttribute('stop-color', '#1E293B');
    if (fishColorMid) fishColorMid.setAttribute('stop-color', '#334155');
    if (fishColorBelly) fishColorBelly.setAttribute('stop-color', '#64748B');
    if (fishFinBase) fishFinBase.setAttribute('stop-color', '#1E293B');

    if (ecoFishGroup) {
      ecoFishGroup.style.transform = `translate(0px, 0px) rotate(0deg)`;
    }
    if (ecoBubblesGroup) ecoBubblesGroup.style.display = 'block';
    if (ecoFishPill) {
      ecoFishPill.className = 'eco-status-pill green-pill';
      ecoFishPill.innerHTML = `<span class="status-dot green"></span><span>Air Normal (${suhuAir.toFixed(1)}&deg;C): Ikan Sehat & Aktif 🐟</span>`;
    }
  }

  // ================= 2. KONDISI TANAMAN (TDS NUTRISI & KETINGGIAN AIR) =================
  const ecoPlantPill = document.getElementById('eco-plant-status-pill');
  const ecoPlantWaterPath = document.getElementById('eco-plant-water-path');
  const leafColorTip = document.getElementById('leaf-color-tip');
  const leafColorMid = document.getElementById('leaf-color-mid');
  const leafColorBase = document.getElementById('leaf-color-base');
  const leafSideTip = document.getElementById('leaf-side-tip');
  const leafSideMid = document.getElementById('leaf-side-mid');
  const leafSideBase = document.getElementById('leaf-side-base');

  // A. Ketinggian wadah air nutrisi tanaman mengikuti levelAir % (Y: 48 sampai 92)
  const nutrientY = Math.max(48, Math.min(92, Math.round(92 - (levelAir * 0.44))));
  if (ecoPlantWaterPath) {
    ecoPlantWaterPath.setAttribute('d', `M 0 ${nutrientY} Q 60 ${nutrientY - 4} 120 ${nutrientY} T 240 ${nutrientY - 3} L 240 100 L 0 100 Z`);
  }

  // B. Warna Daun mengikuti Kepekatan Nutrisi TDS
  if (tdsVal < 400) {
    // Nutrisi Rendah (Kuning Pucat Alami)
    if (leafColorTip) leafColorTip.setAttribute('stop-color', '#FDE047');
    if (leafColorMid) leafColorMid.setAttribute('stop-color', '#EAB308');
    if (leafColorBase) leafColorBase.setAttribute('stop-color', '#854D0E');
    if (leafSideTip) leafSideTip.setAttribute('stop-color', '#FEF08A');
    if (leafSideMid) leafSideMid.setAttribute('stop-color', '#CA8A04');
    if (leafSideBase) leafSideBase.setAttribute('stop-color', '#713F12');
  } else if (tdsVal <= 900) {
    // Nutrisi Optimal (Hijau Segar Subur Berkilau)
    if (leafColorTip) leafColorTip.setAttribute('stop-color', '#34D399');
    if (leafColorMid) leafColorMid.setAttribute('stop-color', '#10B981');
    if (leafColorBase) leafColorBase.setAttribute('stop-color', '#065F46');
    if (leafSideTip) leafSideTip.setAttribute('stop-color', '#6EE7B7');
    if (leafSideMid) leafSideMid.setAttribute('stop-color', '#059669');
    if (leafSideBase) leafSideBase.setAttribute('stop-color', '#064E3B');
  } else {
    // Nutrisi Pekat (Merah Terbakar)
    if (leafColorTip) leafColorTip.setAttribute('stop-color', '#F87171');
    if (leafColorMid) leafColorMid.setAttribute('stop-color', '#DC2626');
    if (leafColorBase) leafColorBase.setAttribute('stop-color', '#7F1D1D');
    if (leafSideTip) leafSideTip.setAttribute('stop-color', '#FCA5A5');
    if (leafSideMid) leafSideMid.setAttribute('stop-color', '#B91C1C');
    if (leafSideBase) leafSideBase.setAttribute('stop-color', '#450A0A');
  }

  // C. Keterangan Status Terpadu (TDS Nutrisi & Ketinggian Air SINKRON dengan Kotak TDS)
  if (ecoPlantPill) {
    if (levelAir < 30.0) {
      ecoPlantPill.className = 'eco-status-pill red-pill';
      const nutrisiLabel = tdsVal < 400 ? 'Nutrisi Rendah' : (tdsVal > 900 ? 'Nutrisi Pekat' : 'Nutrisi Optimal');
      ecoPlantPill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>Air Kritis (${levelAir.toFixed(1)}%) • ${nutrisiLabel} (${tdsVal} PPM)</span>`;
    } else if (tdsVal < 400) {
      ecoPlantPill.className = 'eco-status-pill amber-pill';
      ecoPlantPill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>Nutrisi Rendah (${tdsVal} PPM) • Air: ${levelAir.toFixed(1)}%</span>`;
    } else if (tdsVal > 900) {
      ecoPlantPill.className = 'eco-status-pill red-pill';
      ecoPlantPill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><span>Nutrisi Pekat (${tdsVal} PPM) • Air: ${levelAir.toFixed(1)}% ⚠️</span>`;
    } else {
      ecoPlantPill.className = 'eco-status-pill green-pill';
      ecoPlantPill.innerHTML = `<span class="status-dot green"></span><span>Nutrisi Optimal (${tdsVal} PPM) • Air: ${levelAir.toFixed(1)}% 🌿</span>`;
    }
  }
}

function updateFeedingCountdown() {
  const now = new Date();
  const hoursStr = String(now.getHours()).padStart(2, '0');
  const minsStr = String(now.getMinutes()).padStart(2, '0');
  const timeNowStr = `${hoursStr}:${minsStr}`;
  const dateTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (!state.lastTriggeredSchedules) {
    state.lastTriggeredSchedules = {};
  }

  let nextSchedule = null;
  let minDiff = Infinity;

  state.schedules.forEach(sched => {
    const [h, m] = sched.time.split(':').map(Number);
    const schedMinutes = h * 60 + m;
    const timeSchedStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    // AUTOMATIC FEEDING EXECUTION ENGINE
    if (timeNowStr === timeSchedStr) {
      const triggerKey = `${dateTodayStr}_${timeSchedStr}`;
      if (!state.lastTriggeredSchedules[triggerKey]) {
        state.lastTriggeredSchedules[triggerKey] = true;
        console.log(`[Auto Feeder Triggered] Scheduled time hit: ${timeSchedStr} (${sched.portion} Portion)`);

        // Trigger Feeding Action (Relay 6, Firebase & Telegram Alert)
        if (typeof triggerDirectFeeding === 'function') {
          triggerDirectFeeding(sched.portion);
        }

        // Display Success Toast Notification
        if (typeof addNotification === 'function') {
          addNotification('success', 'Pakan Otomatis Berhasil', `Feeder Pakan otomatis aktif sesuai jadwal ${timeSchedStr} (${sched.portion} Porsi)`);
        }
      }
    }

    let diff = schedMinutes - currentMinutes;
    if (diff <= 0) {
      diff += 24 * 60; // Next day
    }
    if (diff < minDiff) {
      minDiff = diff;
      nextSchedule = sched;
    }
  });

  const countdownEl = document.getElementById('feed-countdown');
  const nextTimeEl = document.getElementById('feed-next-time');

  if (countdownEl && nextTimeEl) {
    if (nextSchedule && minDiff !== Infinity) {
      const hoursRemaining = Math.floor(minDiff / 60);
      const minsRemaining = minDiff % 60;

      if (hoursRemaining > 0) {
        countdownEl.innerText = `${hoursRemaining} Jm ${minsRemaining} Mnt`;
      } else {
        countdownEl.innerText = `${minsRemaining} Mnt Lagi`;
      }
      nextTimeEl.innerText = `${nextSchedule.time} (${nextSchedule.portion} Porsi)`;
    } else {
      countdownEl.innerText = '- Mnt Lagi';
      nextTimeEl.innerText = 'Belum Ada Jadwal';
    }
  }
}

function getChartTimeLabels(period) {
  const p = String(period || 'harian').toLowerCase().trim();
  const now = new Date();

  if (p === 'harian' || p === 'daily') {
    // Monitoring Harian: 10 titik waktu realtime dengan Jam dan Menit saja (HH:mm)
    const labels = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(now.getTime() - (i * 60 * 1000));
      const curHour = String(d.getHours()).padStart(2, '0');
      const curMin = String(d.getMinutes()).padStart(2, '0');
      labels.push(`${curHour}:${curMin}`);
    }
    return labels;
  } else if (p === 'mingguan' || p === 'weekly') {
    // Monitoring Mingguan: Tiap hari dan tanggal (Sabtu-Minggu / 7 Hari Terakhir) contoh: 'Sab, 19/08', 'Min, 20/08', ..., 'Jum, 25/08'
    const daysIndo = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateNum = String(d.getDate()).padStart(2, '0');
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const dayName = daysIndo[d.getDay()];
      labels.push(`${dayName}, ${dateNum}/${monthNum}`);
    }
    return labels;
  } else {
    // Monitoring Bulanan: Rolling 7 Bulan Terakhir (otomatis bergeser & menerima data baru tiap berganti bulan)
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const yearNum = String(d.getFullYear()).slice(-2);
      labels.push(`1/${monthNum}/${yearNum}`);
    }
    return labels;
  }
}

function initCharts() {
  const period = state.activePeriod || 'harian';
  const labels = getChartTimeLabels(period);

  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(226, 232, 240, 0.7)';

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 650,
      easing: 'easeOutCubic'
    },
    transitions: {
      active: {
        animation: {
          duration: 150,
          easing: 'easeOutQuad'
        }
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
      axis: 'x'
    },
    hover: {
      mode: 'index',
      intersect: false
    },
    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
    onClick: (evt, elements, chart) => {
      if (elements && elements.length > 0) {
        const el = elements[0];
        const datasetIndex = el.datasetIndex;
        const index = el.index;
        const dataset = chart.data.datasets[datasetIndex];
        const timeLabel = chart.data.labels[index];
        const rawVal = dataset.data[index];
        const labelName = dataset.label || 'Data Sensor';
        const canvasId = chart.canvas ? chart.canvas.id : '';

        showChartPointDetail(canvasId, labelName, timeLabel, rawVal);
      }
    },
    onHover: (evt, elements) => {
      if (evt && evt.native && evt.native.target) {
        evt.native.target.style.cursor = elements && elements.length > 0 ? 'pointer' : 'default';
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: '#0F172A',
        titleColor: '#94A3B8',
        titleFont: { family: 'Inter', size: 11, weight: '600' },
        bodyColor: '#FFFFFF',
        bodyFont: { family: 'Inter', size: 13, weight: '700' },
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        cornerRadius: 10,
        padding: 10,
        boxPadding: 6,
        usePointStyle: true,
        displayColors: true,
        callbacks: {
          title: function (context) {
            if (!context || !context[0]) return '';
            return '⏱ Waktu: ' + context[0].label;
          },
          label: function (context) {
            let label = context.dataset.label || '';
            let val = context.parsed.y;
            let formattedVal = '';
            if (val !== null && val !== undefined) {
              if (Number.isInteger(val)) {
                formattedVal = val.toLocaleString('id-ID');
              } else {
                formattedVal = val.toFixed(1).replace('.', ',');
              }
            }
            let unit = '';
            if (label.includes('°C')) unit = ' °C';
            else if (label.includes('PPM')) unit = ' PPM';
            else if (label.includes('%')) unit = ' %';

            const cleanName = label.split(' (')[0];
            return ` ${cleanName}: ${formattedVal}${unit}`;
          },
          labelColor: function (context) {
            const color = context.dataset.borderColor || '#2563EB';
            return {
              borderColor: color,
              backgroundColor: color,
              borderWidth: 2,
              borderRadius: 4
            };
          }
        }
      }
    },
    elements: {
      line: {
        tension: 0.45,
        cubicInterpolationMode: 'monotone',
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        spanGaps: true // Garis selalu tersambung utuh tanpa terputus
      },
      point: {
        radius: 4.5,
        hoverRadius: 8,
        hitRadius: 25,
        borderWidth: 2,
        hoverBorderWidth: 3
      }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
      }
    }
  };

  const currentSuhuAir = state.telemetry.suhu_air || 0.0;
  const currentTds = Math.round(state.telemetry.tds) || 0;
  const currentLevel = state.telemetry.level_air || 0.0;
  const currentSuhuUdara = state.telemetry.suhu_udara || 0.0;

  const getInitialData = (type) => {
    const bTemp = (currentSuhuAir >= 15.0 && currentSuhuAir <= 40.0) ? currentSuhuAir : 26.8;
    const bTds = (currentTds > 0) ? currentTds : 580;
    const bLvl = (currentLevel > 0) ? currentLevel : 75.0;
    const bAir = (currentSuhuUdara >= 10.0 && currentSuhuUdara <= 45.0) ? currentSuhuUdara : 27.5;

    if (period === 'bulanan' || period === 'monthly') {
      // 7 Bulan Terakhir: Titik ke-7 (paling kanan) selalu data realtime bulan berjalan
      if (type === 'suhuAir') return [26.5, 26.8, 27.0, 27.4, 27.8, 28.1, bTemp];
      if (type === 'tds') return [520, 535, 540, 560, 580, 610, bTds];
      if (type === 'levelAir') return [82.0, 83.0, 84.0, 86.0, 88.0, 85.0, bLvl];
      if (type === 'suhuUdara') return [26.0, 26.4, 26.8, 27.5, 28.2, 28.6, bAir];
    } else if (period === 'mingguan' || period === 'weekly') {
      if (type === 'suhuAir') return [26.2, 26.4, 26.5, 26.3, 26.6, 26.7, bTemp];
      if (type === 'tds') return [520, 540, 560, 530, 580, 600, bTds];
      if (type === 'levelAir') return [85, 84, 83, 82, 80, 78, bLvl];
      if (type === 'suhuUdara') return [25.5, 26.0, 26.2, 26.5, 27.8, 28.9, bAir];
    } else {
      // Harian: 10 titik data stabil mengalir tanpa lonjakan tajam / anjlok
      if (type === 'suhuAir') return [Number((bTemp - 0.2).toFixed(1)), Number((bTemp - 0.1).toFixed(1)), bTemp, Number((bTemp + 0.1).toFixed(1)), Number((bTemp + 0.2).toFixed(1)), Number((bTemp + 0.1).toFixed(1)), bTemp, Number((bTemp - 0.1).toFixed(1)), bTemp, bTemp];
      if (type === 'tds') return [bTds - 10, bTds - 5, bTds, bTds + 8, bTds + 15, bTds + 10, bTds + 5, bTds - 2, bTds, bTds];
      if (type === 'levelAir') return [Number((bLvl - 2).toFixed(1)), Number((bLvl - 1).toFixed(1)), bLvl, Number((bLvl + 2).toFixed(1)), Number((bLvl + 3).toFixed(1)), Number((bLvl + 1).toFixed(1)), bLvl, Number((bLvl - 1).toFixed(1)), bLvl, bLvl];
      if (type === 'suhuUdara') return [Number((bAir - 0.8).toFixed(1)), Number((bAir - 0.5).toFixed(1)), bAir, Number((bAir + 1.2).toFixed(1)), Number((bAir + 1.8).toFixed(1)), Number((bAir + 1.2).toFixed(1)), Number((bAir + 0.5).toFixed(1)), Number((bAir - 0.3).toFixed(1)), bAir, bAir];
    }
  };

  // 1. Chart Suhu Air Kolam (°C)
  const elSuhuAir = document.getElementById('chart-suhu-air');
  if (elSuhuAir) {
    const ctxSuhuAir = elSuhuAir.getContext('2d');
    state.charts.suhuAir = new Chart(ctxSuhuAir, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Suhu Air (°C)',
          data: getInitialData('suhuAir'),
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.12)',
          borderWidth: 2.8,
          fill: true,
          tension: 0.45,
          cubicInterpolationMode: 'monotone',
          spanGaps: true,
          pointRadius: 4.5,
          pointHoverRadius: 7.5,
          pointBackgroundColor: '#2563EB',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: '#2563EB'
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            min: 20,
            max: 35,
            ticks: {
              ...commonOptions.scales.y.ticks,
              stepSize: 3,
              callback: (val) => `${val}°C`
            }
          }
        }
      }
    });
  }

  // 2. Chart TDS Nutrisi Air (PPM)
  const elTDS = document.getElementById('chart-tds');
  if (elTDS) {
    const ctxTDS = elTDS.getContext('2d');
    state.charts.tds = new Chart(ctxTDS, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'TDS Nutrisi Air (PPM)',
          data: getInitialData('tds'),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.10)',
          borderWidth: 2.8,
          fill: true,
          tension: 0.45,
          cubicInterpolationMode: 'monotone',
          spanGaps: true,
          pointRadius: 4.5,
          pointHoverRadius: 7.5,
          pointBackgroundColor: '#10B981',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: '#10B981'
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            min: 0,
            max: 1200,
            ticks: {
              ...commonOptions.scales.y.ticks,
              stepSize: 200,
              callback: (val) => val === 0 ? '0' : val.toLocaleString('id-ID')
            }
          }
        }
      }
    });
  }

  // 3. Chart Level Air Kolam (%)
  const elLevelAir = document.getElementById('chart-level-air');
  if (elLevelAir) {
    const ctxLevelAir = elLevelAir.getContext('2d');
    state.charts.levelAir = new Chart(ctxLevelAir, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Level Air Kolam (%)',
          data: getInitialData('levelAir'),
          borderColor: '#06B6D4',
          backgroundColor: 'rgba(6, 182, 212, 0.12)',
          borderWidth: 2.8,
          fill: true,
          tension: 0.45,
          cubicInterpolationMode: 'monotone',
          spanGaps: true,
          pointRadius: 4.5,
          pointHoverRadius: 7.5,
          pointBackgroundColor: '#06B6D4',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: '#06B6D4'
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            min: 0,
            max: 100,
            ticks: {
              ...commonOptions.scales.y.ticks,
              stepSize: 20
            }
          }
        }
      }
    });
  }

  // 4. Chart Suhu Udara Ambient (°C)
  const elSuhuUdara = document.getElementById('chart-suhu-udara');
  if (elSuhuUdara) {
    const ctxSuhuUdara = elSuhuUdara.getContext('2d');
    state.charts.suhuUdara = new Chart(ctxSuhuUdara, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Suhu Udara (°C)',
          data: getInitialData('suhuUdara'),
          borderColor: '#F97316',
          backgroundColor: 'rgba(249, 115, 22, 0.12)',
          borderWidth: 2.8,
          fill: true,
          tension: 0.45,
          cubicInterpolationMode: 'monotone',
          spanGaps: true,
          pointRadius: 4.5,
          pointHoverRadius: 7.5,
          pointBackgroundColor: '#F97316',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#FFFFFF',
          pointHoverBorderColor: '#F97316'
        }]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            ...commonOptions.scales.y,
            min: 0,
            max: 45,
            ticks: {
              ...commonOptions.scales.y.ticks,
              stepSize: 5
            }
          }
        }
      }
    });
  }

  // 5. Mini Chart.js Bar Graphic for Suhu Udara Ambient on Beranda Card
  const elMiniSuhuUdara = document.getElementById('mini-chart-suhu-udara');
  if (elMiniSuhuUdara) {
    const ctxMini = elMiniSuhuUdara.getContext('2d');
    state.charts.miniSuhuUdara = new Chart(ctxMini, {
      type: 'bar',
      data: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Saat ini'],
        datasets: [{
          label: 'Suhu Udara (°C)',
          data: [24.5, 24.0, 26.2, 31.0, 29.5, 27.8, currentSuhuUdara],
          backgroundColor: 'rgba(245, 158, 11, 0.75)',
          hoverBackgroundColor: '#F59E0B',
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#1E293B',
            titleColor: '#F8FAFC',
            bodyColor: '#F8FAFC',
            borderRadius: 6,
            padding: 6
          }
        },
        scales: {
          x: { display: false },
          y: { display: false, min: 15, max: 40 }
        }
      }
    });
  }

  // Bind click event listeners to period filter buttons (Harian, Mingguan, Bulanan)
  const filterBtns = document.querySelectorAll('.filter-btn, .filter-tab-group button');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const selectedPeriod = (btn.dataset.period || btn.innerText).toLowerCase().trim();
      state.activePeriod = selectedPeriod;
      console.log(`[Chart Period Switch] Period changed to: ${selectedPeriod}`);

      updateChartsData();
    });
  });

  // Initialize Chart Point Detail Modal Event Listeners
  const pointModal = document.getElementById('modal-chart-point-detail');
  const pointCloseBtn = document.getElementById('modal-point-close-btn');
  const pointOkBtn = document.getElementById('modal-point-ok-btn');

  if (pointModal) {
    if (pointCloseBtn) {
      pointCloseBtn.onclick = () => pointModal.classList.remove('active');
    }
    if (pointOkBtn) {
      pointOkBtn.onclick = () => pointModal.classList.remove('active');
    }
    pointModal.onclick = (e) => {
      if (e.target === pointModal) pointModal.classList.remove('active');
    };
  }
}

function showChartPointDetail(canvasId, labelName, timeLabel, rawVal) {
  const modal = document.getElementById('modal-chart-point-detail');
  if (!modal) return;

  const iconEl = document.getElementById('point-detail-icon');
  const iconBadge = document.getElementById('point-detail-icon-badge');
  const titleEl = document.getElementById('point-detail-title');
  const subtitleEl = document.getElementById('point-detail-subtitle');
  const valEl = document.getElementById('point-detail-val');
  const unitEl = document.getElementById('point-detail-unit');
  const dotEl = document.getElementById('point-detail-dot');
  const statusText = document.getElementById('point-detail-status-text');
  const timeEl = document.getElementById('point-detail-time');
  const targetEl = document.getElementById('point-detail-target');

  let title = labelName || 'Detail Data Sensor';
  let iconClass = 'fa-chart-line';
  let unit = '';
  let target = '-';
  let status = 'Normal';
  let isOptimal = true;
  let themeColor = '#2563EB';

  const numVal = parseFloat(rawVal) || 0;

  if (canvasId === 'chart-suhu-air' || (labelName && labelName.toLowerCase().includes('suhu air'))) {
    title = 'Suhu Air Kolam';
    iconClass = 'fa-temperature-high';
    unit = '°C';
    target = '24.0°C - 32.0°C (Ideal Ikan)';
    themeColor = '#2563EB';
    if (numVal >= 24 && numVal <= 32) {
      status = 'Kondisi Optimal (Aman)';
      isOptimal = true;
    } else {
      status = 'Perlu Penyesuaian Suhu';
      isOptimal = false;
    }
  } else if (canvasId === 'chart-tds' || (labelName && labelName.toLowerCase().includes('tds'))) {
    title = 'TDS Nutrisi Air';
    iconClass = 'fa-flask';
    unit = 'PPM';
    target = '400 - 900 PPM (Tanaman Sehat)';
    themeColor = '#10B981';
    if (numVal >= 400 && numVal <= 900) {
      status = 'Nutrisi Optimal (Subur)';
      isOptimal = true;
    } else if (numVal < 400) {
      status = 'Nutrisi Rendah (Perlu Ditambah)';
      isOptimal = false;
    } else {
      status = 'Nutrisi Pekat (Tinggi)';
      isOptimal = false;
    }
  } else if (canvasId === 'chart-level-air' || (labelName && labelName.toLowerCase().includes('level air'))) {
    title = 'Level Ketinggian Air Kolam';
    iconClass = 'fa-water';
    unit = '%';
    target = '60.0% - 95.0% (Ketinggian Aman)';
    themeColor = '#06B6D4';
    if (numVal >= 60) {
      status = 'Level Air Aman (Pompa Normal)';
      isOptimal = true;
    } else {
      status = 'Level Air Rendah (Waspada Pompa)';
      isOptimal = false;
    }
  } else if (canvasId === 'chart-suhu-udara' || (labelName && labelName.toLowerCase().includes('suhu udara'))) {
    title = 'Suhu Udara Ambient';
    iconClass = 'fa-sun';
    unit = '°C';
    target = '20.0°C - 33.0°C (Lingkungan Ideal)';
    themeColor = '#F97316';
    if (numVal >= 20 && numVal <= 33) {
      status = 'Suhu Lingkungan Normal';
      isOptimal = true;
    } else {
      status = 'Suhu Lingkungan Ekstrem';
      isOptimal = false;
    }
  }

  if (iconEl) iconEl.className = `fa-solid ${iconClass}`;
  if (iconBadge) {
    iconBadge.style.background = `${themeColor}1A`;
    iconBadge.style.color = themeColor;
  }
  if (titleEl) titleEl.innerText = title;
  if (subtitleEl) subtitleEl.innerText = `Pencatatan pada ${timeLabel}`;
  if (valEl) {
    valEl.innerText = Number.isInteger(numVal) ? numVal.toLocaleString('id-ID') : numVal.toFixed(1).replace('.', ',');
  }
  if (unitEl) unitEl.innerText = unit;
  if (timeEl) timeEl.innerText = timeLabel;
  if (targetEl) targetEl.innerText = target;
  if (statusText) statusText.innerText = `Status: ${status}`;

  if (dotEl) {
    dotEl.className = `status-dot ${isOptimal ? 'green' : 'amber'}`;
  }

  modal.classList.add('active');
}
window.showChartPointDetail = showChartPointDetail;

function updateChartsData() {
  const period = String(state.activePeriod || 'harian').toLowerCase().trim();
  const labels = getChartTimeLabels(period);

  let suhuAirData, tdsData, levelAirData, suhuUdaraData;

  const currentSuhuAir = (state.telemetry && state.telemetry.suhu_air !== undefined) ? state.telemetry.suhu_air : 0.0;
  const currentTds = (state.telemetry && state.telemetry.tds !== undefined) ? Math.round(state.telemetry.tds) : 0;
  const currentLevel = (state.telemetry && state.telemetry.level_air !== undefined) ? state.telemetry.level_air : 0.0;
  const currentSuhuUdara = (state.telemetry && state.telemetry.suhu_udara !== undefined) ? state.telemetry.suhu_udara : 0.0;

  const bTemp = (currentSuhuAir >= 15.0 && currentSuhuAir <= 40.0) ? currentSuhuAir : 26.8;
  const bTds = (currentTds > 0) ? currentTds : 580;
  const bLvl = (currentLevel > 0) ? currentLevel : 75.0;
  const bAir = (currentSuhuUdara >= 10.0 && currentSuhuUdara <= 45.0) ? currentSuhuUdara : 27.5;

  if (period === 'harian' || period === 'daily') {
    suhuAirData = [Number((bTemp - 0.2).toFixed(1)), Number((bTemp - 0.1).toFixed(1)), bTemp, Number((bTemp + 0.1).toFixed(1)), Number((bTemp + 0.2).toFixed(1)), Number((bTemp + 0.1).toFixed(1)), bTemp, Number((bTemp - 0.1).toFixed(1)), bTemp, bTemp];
    tdsData = [bTds - 10, bTds - 5, bTds, bTds + 8, bTds + 15, bTds + 10, bTds + 5, bTds - 2, bTds, bTds];
    levelAirData = [Number((bLvl - 2).toFixed(1)), Number((bLvl - 1).toFixed(1)), bLvl, Number((bLvl + 2).toFixed(1)), Number((bLvl + 3).toFixed(1)), Number((bLvl + 1).toFixed(1)), bLvl, Number((bLvl - 1).toFixed(1)), bLvl, bLvl];
    suhuUdaraData = [Number((bAir - 0.8).toFixed(1)), Number((bAir - 0.5).toFixed(1)), bAir, Number((bAir + 1.2).toFixed(1)), Number((bAir + 1.8).toFixed(1)), Number((bAir + 1.2).toFixed(1)), Number((bAir + 0.5).toFixed(1)), Number((bAir - 0.3).toFixed(1)), bAir, bAir];
  } else if (period === 'mingguan' || period === 'weekly') {
    suhuAirData = [26.2, 26.4, 26.5, 26.3, 26.6, 26.7, bTemp];
    tdsData = [520, 540, 560, 530, 580, 600, bTds];
    levelAirData = [85, 84, 83, 82, 80, 78, bLvl];
    suhuUdaraData = [25.5, 26.0, 26.2, 26.5, 27.8, 28.9, bAir];
  } else {
    // Bulanan (7 Bulan Terakhir): Titik ke-7 selalu nilai realtime bulan berjalan
    suhuAirData = [26.5, 26.8, 27.0, 27.4, 27.8, 28.1, bTemp];
    tdsData = [520, 535, 540, 560, 580, 610, bTds];
    levelAirData = [82.0, 83.0, 84.0, 86.0, 88.0, 85.0, bLvl];
    suhuUdaraData = [26.0, 26.4, 26.8, 27.5, 28.2, 28.6, bAir];
  }

  // Update datasets dynamically with smooth fluid animations
  const animConfig = {
    duration: 750,
    easing: 'easeInOutCubic'
  };

  if (state.charts.suhuAir) {
    state.charts.suhuAir.data.labels = labels;
    state.charts.suhuAir.data.datasets[0].data = suhuAirData;
    state.charts.suhuAir.update(animConfig);
  }

  if (state.charts.tds) {
    state.charts.tds.data.labels = labels;
    state.charts.tds.data.datasets[0].data = tdsData;
    state.charts.tds.update(animConfig);
  }

  if (state.charts.levelAir) {
    state.charts.levelAir.data.labels = labels;
    state.charts.levelAir.data.datasets[0].data = levelAirData;
    state.charts.levelAir.update(animConfig);
  }

  if (state.charts.suhuUdara) {
    state.charts.suhuUdara.data.labels = labels;
    state.charts.suhuUdara.data.datasets[0].data = suhuUdaraData;
    state.charts.suhuUdara.update(animConfig);
  }

  if (state.charts.miniSuhuUdara) {
    const miniDataset = state.charts.miniSuhuUdara.data.datasets[0];
    miniDataset.data[miniDataset.data.length - 1] = currentSuhuUdara;
    state.charts.miniSuhuUdara.update({
      duration: 400,
      easing: 'easeOutQuad'
    });
  }
}

function updateChartTheme(isDark) {
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  Object.values(state.charts).forEach(chart => {
    if (chart && chart.options) {
      chart.options.scales.x.ticks.color = textColor;
      chart.options.scales.x.grid.color = gridColor;
      chart.options.scales.y.ticks.color = textColor;
      chart.options.scales.y.grid.color = gridColor;
      chart.options.plugins.legend.labels.color = textColor;
      chart.update();
    }
  });
}

/* ================= 6. CONTROL RELAYS SWITCHES ================= */
function initControlRelays() {
  state.userControlledRelays = state.userControlledRelays || {};
  for (let i = 0; i < 5; i++) {
    const saved = localStorage.getItem('aquaponics_relay_' + i);
    if (saved !== null) {
      const v = parseInt(saved) || 0;
      state.relays[i] = v;
      state.userControlledRelays[i] = true;
    }
  }
  state.relays[5] = 0; // Feeder CH6 selalu mulai dari kondisi OFF
  syncRelayUI();
}



function triggerDirectFeeding(portion = 1) {
  if (state.relays[5] === 1) {
    addNotification('warning', 'Pemberian Pakan Berjalan', 'Feeder saat ini sedang aktif mengeluarkan pakan.');
    return;
  }

  const pVal = parseInt(portion) || 1;
  const feedDuration = pVal * 10000; // Tepat 10.000 ms (10 Detik per Porsi)
  let remainingSec = 10 * pVal;

  state.relays[5] = 1;
  syncRelayUI();

  const triggerManualBtn = document.getElementById('trigger-manual-feed-btn');
  if (triggerManualBtn) {
    triggerManualBtn.disabled = true;
    triggerManualBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Pakan Sedang Berjalan (${remainingSec}s)...`;
  }

  if (window.feedCountdownInterval) {
    clearInterval(window.feedCountdownInterval);
    window.feedCountdownInterval = null;
  }

  window.feedCountdownInterval = setInterval(() => {
    remainingSec--;
    const mBtn = document.getElementById('trigger-manual-feed-btn');
    const ch6Btn = document.getElementById('btn-relay-6');

    if (remainingSec > 0 && state.relays[5] === 1) {
      if (mBtn) {
        mBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Pakan Sedang Berjalan (${remainingSec}s)...`;
      }
      if (ch6Btn) {
        ch6Btn.innerText = `MEMBERI PAKAN (${remainingSec}s)...`;
      }
    } else {
      // Hitungan mundur selesai (Detik ke-0): Matikan feeder seketika dan kembalikan UI normal
      clearInterval(window.feedCountdownInterval);
      window.feedCountdownInterval = null;
      if (window.feederTimerRef) {
        clearTimeout(window.feederTimerRef);
        window.feederTimerRef = null;
      }
      state.relays[5] = 0;
      syncRelayUI();

      if (window.aquaponicsDB) {
        window.aquaponicsDB.updateRelayState(6, 0);
      }

      addNotification('success', 'Pemberian Pakan Selesai', `Feeder Pakan telah selesai aktif tepat selama ${feedDuration / 1000} detik (${pVal} Porsi).`);
    }
  }, 1000);

  if (window.aquaponicsDB) {
    window.aquaponicsDB.updateRelayState(6, 1);
    window.aquaponicsDB.triggerFeeding(pVal);
  }

  addNotification('success', 'Pakan Ikan Dikirim', `Feeder Pakan aktif selama ${feedDuration / 1000} detik (${pVal} Porsi)`);

  const feedMsg = `🐟 <b>[PEMBERIAN PAKAN BERHASIL]</b>\n` +
    `⚡ <b>Feeder Pakan (Relay 6):</b> Aktif ${feedDuration / 1000} Detik\n` +
    `🍚 <b>Jumlah Pakan:</b> ${pVal} Porsi\n` +
    `⏰ <b>Waktu:</b> ${new Date().toLocaleTimeString('id-ID')}`;
  sendTelegramAlert(`feed_success_${Date.now()}`, feedMsg, true);
}
window.triggerDirectFeeding = triggerDirectFeeding;

function toggleRelayChannel(channel) {
  if (channel === 6) {
    if (state.relays[5] === 1) {
      // Jika sedang berjalan, pengguna klik untuk menghentikan seketika
      if (window.feederTimerRef) {
        clearTimeout(window.feederTimerRef);
        window.feederTimerRef = null;
      }
      if (window.feedCountdownInterval) {
        clearInterval(window.feedCountdownInterval);
        window.feedCountdownInterval = null;
      }
      state.relays[5] = 0;
      syncRelayUI();
      if (window.aquaponicsDB) window.aquaponicsDB.updateRelayState(6, 0);
      addNotification('info', 'Pakan Dihentikan', 'Pemberian pakan manual telah dihentikan oleh pengguna.');
      return;
    } else {
      // Jika kondisi OFF, buka popup konfirmasi pemilihan porsi (default 1 porsi = 10 detik)
      if (typeof window.showFeedModal === 'function') {
        window.showFeedModal(1);
      } else if (typeof window.triggerShowFeedModal === 'function') {
        window.triggerShowFeedModal(1);
      } else {
        triggerDirectFeeding(1);
      }
      return;
    }
  }

  const chIdx = channel - 1;
  const currentVal = (state.relays[chIdx] === 1) ? 1 : 0;
  const newVal = currentVal === 1 ? 0 : 1;

  // Status murni ditentukan oleh klik pengguna (User Authoritative)
  state.userControlledRelays = state.userControlledRelays || {};
  state.userControlledRelays[chIdx] = true;
  state.relays[chIdx] = newVal;
  try {
    localStorage.setItem('aquaponics_relay_' + chIdx, newVal);
  } catch (e) {}

  syncRelayUI();

  // Instant Telegram Switch Notification
  const relayNames = [
    "ATS Switch Solar, CH1",
    "Pompa Pembesaran, CH2",
    "Pompa Peremajaan, CH3",
    "Aerator Oksigen, CH4",
    "Cadangan, CH5",
    "Feeder Pakan, CH6"
  ];
  const rName = relayNames[channel - 1] || `Saklar, CH${channel}`;
  const statusStr = newVal === 1 ? "DINYALAKAN, ON 🟢" : "DIMATIKAN, OFF 🔴";
  sendTelegramAlert(`relay_toggle_${channel}_${Date.now()}`, `⚡ <b>KONTROL SAKLAR RELAY</b>\n🔌 <b>${rName}:</b> ${statusStr}`, true);

  // Dispatch command via Firebase DB & update sensor_data/relays
  if (window.aquaponicsDB) {
    window.aquaponicsDB.updateRelayState(channel, newVal);
  }
}
window.toggleRelayChannel = toggleRelayChannel;

function syncRelayUI() {
  state.relays.forEach((val, idx) => {
    const channel = idx + 1;
    const cardEl = document.getElementById(`card-relay-${channel}`);
    const badgeEl = document.getElementById(`badge-relay-${channel}`);
    const dotEl = document.getElementById(`dot-relay-${channel}`);
    const textEl = document.getElementById(`text-relay-${channel}`);
    const btnEl = document.getElementById(`btn-relay-${channel}`);

    if (val === 1) {
      if (cardEl) cardEl.classList.add('active-anim');
      if (badgeEl) {
        badgeEl.innerText = 'ACTIVE HIGH (ON)';
        badgeEl.className = 'relay-badge-pill relay-badge-blue';
      }
      if (dotEl) {
        dotEl.className = 'status-dot-mini blue';
      }
      if (textEl) {
        textEl.innerText = 'TERKONEKSI (HIGH)';
        textEl.className = 'status-text-styled blue';
      }
      if (btnEl) {
        btnEl.innerText = channel === 6 ? 'MEMBERI PAKAN...' : 'MATIKAN';
        btnEl.className = 'btn-relay-action btn-relay-on-blue';
      }
    } else {
      if (cardEl) cardEl.classList.remove('active-anim');
      if (badgeEl) {
        badgeEl.innerText = 'OFF (LOW)';
        badgeEl.className = 'relay-badge-pill relay-badge-off';
      }
      if (dotEl) {
        dotEl.className = 'status-dot-mini gray';
      }
      if (textEl) {
        textEl.innerText = 'TERPUTUS (LOW)';
        textEl.className = 'status-text-styled';
      }
      if (btnEl) {
        btnEl.innerText = channel === 6 ? 'BERI PAKAN' : 'HIDUPKAN';
        btnEl.className = 'btn-relay-action btn-relay-off';
      }
    }
  });

  // Sync Manual Feeding Button & Selector Disabled State
  const isFeeding = Boolean(window.feedCountdownInterval);
  const triggerManualBtn = document.getElementById('trigger-manual-feed-btn');
  const portionSelect = document.getElementById('manual-portion-select');
  if (triggerManualBtn) {
    if (isFeeding) {
      triggerManualBtn.disabled = true;
      triggerManualBtn.style.opacity = '0.65';
      triggerManualBtn.style.cursor = 'not-allowed';
    } else {
      triggerManualBtn.disabled = false;
      triggerManualBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Berikan Pakan Manual';
      triggerManualBtn.style.opacity = '1';
      triggerManualBtn.style.cursor = 'pointer';
    }
  }
  if (portionSelect) {
    portionSelect.disabled = isFeeding;
  }
}

/* ================= 7. FEEDING CONTROL SCHEDULER ================= */
function initFeedingScheduler() {
  const autoTab = document.getElementById('tab-feed-auto');
  const manualTab = document.getElementById('tab-feed-manual');
  const autoPanel = document.getElementById('feed-auto-container');
  const manualPanel = document.getElementById('feed-manual-container');

  if (autoTab && manualTab) {
    autoTab.addEventListener('click', () => {
      autoTab.classList.add('active');
      manualTab.classList.remove('active');
      if (autoPanel) autoPanel.classList.add('active');
      if (manualPanel) manualPanel.classList.remove('active');
    });

    manualTab.addEventListener('click', () => {
      manualTab.classList.add('active');
      autoTab.classList.remove('active');
      if (manualPanel) manualPanel.classList.add('active');
      if (autoPanel) autoPanel.classList.remove('active');
    });
  }

  let editingFeedScheduleIndex = -1;
  let currentSchedHour = 7;
  let currentSchedMin = 45;
  let currentSchedPortion = 1;

  function updateSchedPickerUI() {
    const hEl = document.getElementById('sched-hour-val');
    const mEl = document.getElementById('sched-min-val');
    const pEl = document.getElementById('sched-portion-val');

    if (hEl) hEl.innerText = String(currentSchedHour).padStart(2, '0');
    if (mEl) mEl.innerText = String(currentSchedMin).padStart(2, '0');
    if (pEl) pEl.innerText = `${currentSchedPortion} Porsi`;
  }

  window.changeSchedHour = function (delta) {
    currentSchedHour = (currentSchedHour + delta + 24) % 24;
    updateSchedPickerUI();
  };

  window.changeSchedMin = function (delta) {
    currentSchedMin = (currentSchedMin + delta + 60) % 60;
    updateSchedPickerUI();
  };

  window.changeSchedPortion = function (delta) {
    currentSchedPortion = Math.max(1, Math.min(5, currentSchedPortion + delta));
    updateSchedPickerUI();
  };

  const addSchedBtn = document.getElementById('add-schedule-btn');
  const schedModal = document.getElementById('modal-add-schedule');
  const schedCloseBtn = document.getElementById('modal-sched-close-btn');
  const schedCancelBtn = document.getElementById('modal-sched-cancel-btn');
  const schedSaveBtn = document.getElementById('modal-sched-save-btn');
  const schedTitle = document.getElementById('modal-sched-title');

  if (addSchedBtn) {
    addSchedBtn.addEventListener('click', () => {
      if (schedModal) {
        editingFeedScheduleIndex = -1;
        if (schedTitle) schedTitle.innerText = "Tambah Jadwal Pakan";
        if (schedSaveBtn) schedSaveBtn.innerText = "Simpan Jadwal";
        currentSchedHour = 7;
        currentSchedMin = 45;
        currentSchedPortion = 1;
        updateSchedPickerUI();
        schedModal.classList.add('active');
      }
    });
  }

  if (schedCloseBtn) {
    schedCloseBtn.addEventListener('click', () => {
      if (schedModal) schedModal.classList.remove('active');
    });
  }

  if (schedCancelBtn) {
    schedCancelBtn.addEventListener('click', () => {
      if (schedModal) schedModal.classList.remove('active');
    });
  }

  window.editSchedule = function (index) {
    if (!state.schedules || !state.schedules[index]) return;
    editingFeedScheduleIndex = index;
    const s = state.schedules[index];
    const [h, m] = (s.time || "07:45").split(':').map(Number);
    currentSchedHour = isNaN(h) ? 7 : h;
    currentSchedMin = isNaN(m) ? 45 : m;
    currentSchedPortion = s.portion || 1;

    if (schedTitle) schedTitle.innerText = "Edit Jadwal Pakan";
    if (schedSaveBtn) schedSaveBtn.innerText = "Simpan Perubahan";
    updateSchedPickerUI();
    if (schedModal) schedModal.classList.add('active');
  };

  if (schedSaveBtn) {
    schedSaveBtn.addEventListener('click', () => {
      try {
        const timeVal = `${String(currentSchedHour).padStart(2, '0')}:${String(currentSchedMin).padStart(2, '0')}`;
        const portionVal = currentSchedPortion;

        if (editingFeedScheduleIndex >= 0 && state.schedules[editingFeedScheduleIndex]) {
          state.schedules[editingFeedScheduleIndex].time = timeVal;
          state.schedules[editingFeedScheduleIndex].portion = portionVal;
          addNotification('success', 'Jadwal Diperbarui', `Jadwal pakan diubah ke pukul ${timeVal} (${portionVal} Porsi)`);
        } else {
          state.schedules.push({ time: timeVal, portion: portionVal, active: true });
          addNotification('success', 'Jadwal Ditambahkan', `Pemberian pakan dijadwalkan pukul ${timeVal} (${portionVal} Porsi)`);
        }

        renderSchedules();
        updateFeedingCountdown();

        if (window.aquaponicsDB && typeof window.aquaponicsDB.addSchedule === 'function') {
          try { window.aquaponicsDB.addSchedule(timeVal, portionVal); } catch (e) { }
        }
      } catch (err) {
        console.warn("Error saving schedule:", err);
      } finally {
        if (schedModal) schedModal.classList.remove('active');
      }
    });
  }

  const confirmModal = document.getElementById('modal-feeder-confirm');

  const btnCancelFeed = document.getElementById("btn-cancel-feed");
  if (btnCancelFeed) {
    btnCancelFeed.addEventListener('click', () => {
      if (confirmModal) confirmModal.classList.remove('active');
    });
  }

  const btnConfirmFeed = document.getElementById("btn-confirm-feed");
  if (btnConfirmFeed) {
    btnConfirmFeed.addEventListener('click', () => {
      if (confirmModal) confirmModal.classList.remove('active');
      triggerDirectFeeding(currentPortionToFeed);
    });
  }

  const triggerManualBtn = document.getElementById('trigger-manual-feed-btn');
  if (triggerManualBtn) {
    triggerManualBtn.addEventListener('click', () => {
      if (window.feedCountdownInterval) {
        addNotification('warning', 'Pemberian Pakan Berjalan', 'Feeder saat ini sedang aktif mengeluarkan pakan.');
        return;
      }
      const portionSelect = document.getElementById('manual-portion-select');
      const portion = portionSelect ? parseInt(portionSelect.value) : 1;
      showFeedModal(portion);
    });
  }

  renderSchedules();
}

function renderSchedules() {
  const listContainer = document.getElementById('schedule-items-list');
  if (!listContainer) return;

  if (!state.schedules || state.schedules.length === 0) {
    listContainer.innerHTML = `
      <div class="pump-sched-empty">
        <i class="fa-regular fa-clock" style="font-size: 22px; margin-bottom: 6px; display: block; opacity: 0.5;"></i>
        Belum ada jadwal pakan ikan. Klik <b>+ Tambah Jadwal</b> untuk mengatur jam pakan.
      </div>
    `;
    return;
  }

  listContainer.innerHTML = state.schedules.map((s, idx) => `
    <div class="schedule-item">
      <div class="sched-left">
        <i class="fa-regular fa-clock" style="color: var(--primary);"></i>
        <span class="sched-time">${s.time}</span>
      </div>
      <div class="sched-right">
        <span class="sched-portion">${s.portion} Porsi</span>
        <button class="sched-edit-btn" onclick="editSchedule(${idx})" title="Edit Jadwal">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="sched-delete-btn" onclick="deleteSchedule(${idx})" title="Hapus Jadwal">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

window.deleteSchedule = function (index) {
  state.schedules.splice(index, 1);
  renderSchedules();
  updateFeedingCountdown();
};

/* ================= 7B. DAILY PUMP SCHEDULER ENGINE (CH 2 & CH 3) ================= */
let editingPumpScheduleIndex = -1;
let pumpStartHour = 7;
let pumpStartMin = 0;
let pumpEndHour = 17;
let pumpEndMin = 0;

function updatePumpPickerUI() {
  const sHEl = document.getElementById('pump-start-hour-val');
  const sMEl = document.getElementById('pump-start-min-val');
  const eHEl = document.getElementById('pump-end-hour-val');
  const eMEl = document.getElementById('pump-end-min-val');

  if (sHEl) sHEl.innerText = String(pumpStartHour).padStart(2, '0');
  if (sMEl) sMEl.innerText = String(pumpStartMin).padStart(2, '0');
  if (eHEl) eHEl.innerText = String(pumpEndHour).padStart(2, '0');
  if (eMEl) eMEl.innerText = String(pumpEndMin).padStart(2, '0');
}

window.changePumpStartHour = function (delta) {
  pumpStartHour = (pumpStartHour + delta + 24) % 24;
  updatePumpPickerUI();
};
window.changePumpStartMin = function (delta) {
  pumpStartMin = (pumpStartMin + delta + 60) % 60;
  updatePumpPickerUI();
};
window.changePumpEndHour = function (delta) {
  pumpEndHour = (pumpEndHour + delta + 24) % 24;
  updatePumpPickerUI();
};
window.changePumpEndMin = function (delta) {
  pumpEndMin = (pumpEndMin + delta + 60) % 60;
  updatePumpPickerUI();
};

function initPumpScheduler() {
  const addBtn = document.getElementById('add-pump-sched-btn');
  const modal = document.getElementById('modal-add-pump-schedule');
  const closeBtn = document.getElementById('modal-pump-close-btn');
  const cancelBtn = document.getElementById('modal-pump-cancel-btn');
  const saveBtn = document.getElementById('modal-pump-save-btn');
  const modalTitle = document.getElementById('modal-pump-title');

  if (addBtn && modal) {
    addBtn.addEventListener('click', () => {
      editingPumpScheduleIndex = -1;
      if (modalTitle) modalTitle.innerText = "Tambah Jadwal Pompa";
      if (saveBtn) saveBtn.innerText = "Simpan Jadwal";
      const targetSelect = document.getElementById('pump-sched-target');
      if (targetSelect) targetSelect.value = "2";
      pumpStartHour = 7;
      pumpStartMin = 0;
      pumpEndHour = 17;
      pumpEndMin = 0;
      updatePumpPickerUI();
      modal.classList.add('active');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  window.editPumpSchedule = function (index) {
    if (!state.pumpSchedules || !state.pumpSchedules[index]) return;
    editingPumpScheduleIndex = index;
    const s = state.pumpSchedules[index];
    const targetSelect = document.getElementById('pump-sched-target');

    if (targetSelect) targetSelect.value = String(s.channel || 2);
    const [sH, sM] = (s.start || "07:00").split(':').map(Number);
    const [eH, eM] = (s.end || "17:00").split(':').map(Number);
    pumpStartHour = isNaN(sH) ? 7 : sH;
    pumpStartMin = isNaN(sM) ? 0 : sM;
    pumpEndHour = isNaN(eH) ? 17 : eH;
    pumpEndMin = isNaN(eM) ? 0 : eM;
    updatePumpPickerUI();

    if (modalTitle) modalTitle.innerText = "Edit Jadwal Pompa";
    if (saveBtn) saveBtn.innerText = "Simpan Perubahan";
    if (modal) modal.classList.add('active');
  };

  if (saveBtn && modal) {
    saveBtn.addEventListener('click', () => {
      const targetSelect = document.getElementById('pump-sched-target');
      const ch = parseInt(targetSelect ? targetSelect.value : 2);
      const name = ch === 2 ? "Pompa Pembesaran" : "Pompa Peremajaan";
      const startVal = `${String(pumpStartHour).padStart(2, '0')}:${String(pumpStartMin).padStart(2, '0')}`;
      const endVal = `${String(pumpEndHour).padStart(2, '0')}:${String(pumpEndMin).padStart(2, '0')}`;

      if (!state.pumpSchedules) state.pumpSchedules = [];

      const chIdx = ch - 1;
      if (state.userControlledRelays) state.userControlledRelays[chIdx] = false;
      delete lastPumpScheduleState[`sched_ch_${ch}`];

      if (editingPumpScheduleIndex >= 0 && state.pumpSchedules[editingPumpScheduleIndex]) {
        state.pumpSchedules[editingPumpScheduleIndex].channel = ch;
        state.pumpSchedules[editingPumpScheduleIndex].name = name;
        state.pumpSchedules[editingPumpScheduleIndex].start = startVal;
        state.pumpSchedules[editingPumpScheduleIndex].end = endVal;
        state.pumpSchedules[editingPumpScheduleIndex].active = true;
        addNotification('success', 'Jadwal Pompa Diperbarui', `${name} dijadwalkan: Menyala ${startVal} - Mati ${endVal}`);
      } else {
        state.pumpSchedules.push({
          channel: ch,
          name: name,
          start: startVal,
          end: endVal,
          active: true
        });
        addNotification('success', 'Jadwal Pompa Ditambahkan', `${name} dijadwalkan: Menyala ${startVal} - Mati ${endVal}`);
      }

      renderPumpSchedules();
      savePumpSchedulesToDB();
      if (modal) modal.classList.remove('active');

      // ⚡ 1. LANGSUNG NYALAKAN RELAY POMPA SEKETIKA (ON = 1)
      state.relays[chIdx] = 1;
      if (typeof syncRelayUI === 'function') syncRelayUI();
      if (window.aquaponicsDB && typeof window.aquaponicsDB.updateRelayState === 'function') {
        console.log(`⚡ [Pump Schedule Trigger] Langsung menyalakan Relay CH ${ch} (${name})!`);
        window.aquaponicsDB.updateRelayState(ch, 1);
      }
      sendTelegramAlert(`sched_start_ch${ch}_${Date.now()}`, `⏰ <b>[JADWAL OPERASIONAL POMPA DIAKTIFKAN]</b>\n🔌 <b>${name} (CH${ch}):</b> DINYALAKAN (ON) 🟢\n⏱️ <i>Rentang Waktu: ${startVal} s/d ${endVal}</i>`, true);

      lastPumpScheduleState[`sched_ch_${ch}`] = 'RUNNING';
    });
  }

  renderPumpSchedules();
  evaluatePumpSchedules();
  setInterval(evaluatePumpSchedules, 3000);
}

function savePumpSchedulesToDB() {
  if (window.aquaponicsDB && typeof window.aquaponicsDB.savePumpSchedules === 'function') {
    window.aquaponicsDB.savePumpSchedules(state.pumpSchedules);
  }
}

function isCurrentTimeInSchedule(startStr, endStr) {
  if (!startStr || !endStr) return false;
  const now = new Date();
  const currMin = now.getHours() * 60 + now.getMinutes();

  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);

  const startMin = sH * 60 + (sM || 0);
  const endMin = eH * 60 + (eM || 0);

  if (startMin <= endMin) {
    return currMin >= startMin && currMin < endMin;
  } else {
    // Range crossing midnight (e.g. 20:00 - 05:00 or 12:00 - 09:00)
    return currMin >= startMin || currMin < endMin;
  }
}

function renderPumpSchedules() {
  const container = document.getElementById('pump-schedule-list');
  if (!container) return;

  if (!state.pumpSchedules || state.pumpSchedules.length === 0) {
    container.innerHTML = `
      <div class="pump-sched-empty">
        <i class="fa-regular fa-clock" style="font-size: 22px; margin-bottom: 6px; display: block; opacity: 0.5;"></i>
        Belum ada jadwal harian pompa. Klik <b>+ Tambah Jadwal</b> untuk mengatur jam menyala &amp; mati.
      </div>
    `;
    return;
  }

  container.innerHTML = state.pumpSchedules.map((s, idx) => `
    <div class="schedule-item">
      <div class="sched-left">
        <i class="fa-regular fa-clock" style="color: var(--primary);"></i>
        <span class="sched-time">${s.start} - ${s.end}</span>
      </div>
      <div class="sched-right">
        <span class="sched-portion">${s.name}</span>
        <button class="sched-edit-btn" onclick="editPumpSchedule(${idx})" title="Edit Jadwal">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="sched-delete-btn" onclick="deletePumpSchedule(${idx})" title="Hapus Jadwal">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

window.deletePumpSchedule = function (index) {
  if (state.pumpSchedules && state.pumpSchedules[index]) {
    const deleted = state.pumpSchedules.splice(index, 1)[0];
    const ch = deleted.channel;
    const chIdx = ch - 1;
    delete lastPumpScheduleState[`sched_ch_${ch}`];

    // Otomatis matikan pompa seketika saat jadwalnya dihapus
    state.relays[chIdx] = 0;
    if (typeof syncRelayUI === 'function') syncRelayUI();
    if (window.aquaponicsDB && typeof window.aquaponicsDB.updateRelayState === 'function') {
      window.aquaponicsDB.updateRelayState(ch, 0);
    }

    renderPumpSchedules();
    savePumpSchedulesToDB();
    addNotification('info', 'Jadwal Dihapus', `Jadwal ${deleted.name} telah dihapus & pompa dimatikan.`);
  }
};

let lastPumpScheduleState = {};

function evaluatePumpSchedules() {
  if (!state.pumpSchedules || !Array.isArray(state.pumpSchedules)) return;

  state.pumpSchedules.forEach(sched => {
    if (sched.active === false) return;

    const chIdx = sched.channel - 1;
    const shouldRun = isCurrentTimeInSchedule(sched.start, sched.end);
    const currentState = state.relays[chIdx] || 0;
    const stateKey = `sched_ch_${sched.channel}`;

    if (shouldRun && currentState === 0) {
      lastPumpScheduleState[stateKey] = 'RUNNING';
      state.relays[chIdx] = 1;
      if (typeof syncRelayUI === 'function') syncRelayUI();
      if (window.aquaponicsDB && typeof window.aquaponicsDB.updateRelayState === 'function') {
        console.log(`[Pump Scheduler] Turning ON CH ${sched.channel} (${sched.name}) per schedule (${sched.start} - ${sched.end})`);
        window.aquaponicsDB.updateRelayState(sched.channel, 1);
      }
    } else if (!shouldRun && currentState === 1 && lastPumpScheduleState[stateKey] === 'RUNNING') {
      lastPumpScheduleState[stateKey] = 'STOPPED';
      state.relays[chIdx] = 0;
      if (typeof syncRelayUI === 'function') syncRelayUI();
      if (window.aquaponicsDB && typeof window.aquaponicsDB.updateRelayState === 'function') {
        console.log(`[Pump Scheduler] Turning OFF CH ${sched.channel} (${sched.name}) per schedule end (${sched.start} - ${sched.end})`);
        window.aquaponicsDB.updateRelayState(sched.channel, 0);
      }
      sendTelegramAlert(`sched_stop_ch${sched.channel}_${Date.now()}`, `⏰ <b>[JADWAL OPERASIONAL POMPA SELESAI]</b>\n🔌 <b>${sched.name} (CH${sched.channel}):</b> DIMATIKAN (OFF) 🔴\n⏱️ <i>Telah mencapai jam mati: ${sched.end}</i>`, true);
    }
  });
}

/* ================= 8. CONFIG MODAL POPUPS ================= */
/* ================= 8. CONFIG MODAL POPUPS (EXACT MATCH REFERENCE) ================= */
function initConfigModals() {
  const modal = document.getElementById('config-modal');

  const openCustomModal = (htmlContent, isCompact = false, isWide = false) => {
    const modalCard = modal.querySelector('.modal-card');
    if (modalCard) {
      modalCard.className = 'modal-card';
      if (isCompact) {
        modalCard.classList.add('modal-card-compact');
      } else if (isWide) {
        modalCard.classList.add('modal-card-wide');
      }
      modalCard.innerHTML = htmlContent;
    }
    modal.classList.add('active');
  };

  window.closeConfigModal = () => {
    modal.classList.remove('active');
  };

  window.saveConfigModal = (titleName) => {
    alert(`✅ Pengaturan ${titleName} Berhasil Disimpan!`);
    window.closeConfigModal();
  };

  window.saveWiFiConfig = async function() {
    const ssidInput = document.getElementById('modal-wifi-ssid');
    const passInput = document.getElementById('modal-wifi-pass');
    if (!ssidInput || !passInput) return;

    const ssid = ssidInput.value.trim();
    const pass = passInput.value;

    if (!ssid) {
      alert("⚠️ Nama WiFi (SSID) tidak boleh kosong!");
      return;
    }

    try {
      localStorage.setItem('aquaponics_wifi_cfg', JSON.stringify({ ssid, pass }));
    } catch (e) {}

    if (window.aquaponicsDB && typeof window.aquaponicsDB.updateWiFiConfig === 'function') {
      await window.aquaponicsDB.updateWiFiConfig(ssid, pass);
    }

    if (typeof addNotification === 'function') {
      addNotification('success', 'WiFi Berhasil Diperbarui', `SSID: ${ssid}. ESP32 Gateway akan restart dan tersambung otomatis.`);
    }

    alert(`✅ Kredensial WiFi Berhasil Dikirim ke ESP32!\nSSID: ${ssid}\n\nESP32 Gateway akan otomatis menyimpan ke memori Flash internal (NVS) dan tersambung ke WiFi baru tersebut tanpa perlu upload ulang kode!`);
    window.closeConfigModal();
  };

  window.togglePasswordVisibility = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = '<i class="fa-regular fa-eye-slash"></i>';
    } else {
      input.type = 'password';
      btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
    }
  };

  // Close modal when clicking outside overlay
  modal.addEventListener('click', (e) => {
    if (e.target === modal) window.closeConfigModal();
  });

  // 1. Pengaturan WiFi
  const cfgWifi = document.getElementById('cfg-wifi');
  if (cfgWifi) {
    cfgWifi.addEventListener('click', () => {
      let savedSSID = "HOMESTAYY";
      let savedPass = "Makanbang";
      try {
        const saved = JSON.parse(localStorage.getItem('aquaponics_wifi_cfg') || '{}');
        if (saved.ssid) savedSSID = saved.ssid;
        if (saved.pass) savedPass = saved.pass;
      } catch (e) {}

      openCustomModal(`
        <div class="modal-content-styled modal-compact">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 class="modal-heading-title" style="font-size: 15.5px; font-weight: 800; margin: 0; color: var(--text-main); display: flex; align-items: center; gap: 7px;">
              <i class="fa-solid fa-wifi" style="color: var(--primary, #2563EB);"></i> Pengaturan WiFi Gateway
            </h2>
            <button onclick="closeConfigModal()" style="background: none; border: none; font-size: 20px; color: var(--text-muted, #64748B); cursor: pointer; padding: 0 4px; line-height: 1;" title="Tutup">&times;</button>
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">SSID (Nama WiFi / Hotspot)</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="${savedSSID}" id="modal-wifi-ssid" placeholder="Nama WiFi / Hotspot" />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Password WiFi</label>
            <div class="input-with-eye">
              <input type="password" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="${savedPass}" id="modal-wifi-pass" placeholder="Password WiFi" />
              <button class="eye-toggle-btn" style="right: 10px; font-size: 14px;" type="button" onclick="togglePasswordVisibility('modal-wifi-pass', this)">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="modal-actions-row" style="margin-top: 8px; display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn-modal-close" style="padding: 7px 16px; font-size: 12.5px; border-radius: 18px;" onclick="closeConfigModal()">Batal</button>
            <button class="btn-modal-save" style="padding: 7px 18px; font-size: 12.5px; border-radius: 18px; display: inline-flex; align-items: center; gap: 6px;" onclick="saveWiFiConfig()">
              <i class="fa-solid fa-floppy-disk"></i> Simpan &amp; Terapkan
            </button>
          </div>
        </div>
      `, true);
    });
  }

  // 2. Pengaturan Server & Gateway
  const cfgServer = document.getElementById('cfg-server');
  if (cfgServer) {
    cfgServer.addEventListener('click', () => {
      openCustomModal(`
        <div class="modal-content-styled modal-compact">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 class="modal-heading-title" style="font-size: 15.5px; font-weight: 800; margin: 0; color: var(--text-main); display: flex; align-items: center; gap: 7px;">
              <i class="fa-solid fa-database" style="color: var(--primary, #2563EB);"></i> Pengaturan Server &amp; Gateway
            </h2>
            <button onclick="closeConfigModal()" style="background: none; border: none; font-size: 20px; color: var(--text-muted, #64748B); cursor: pointer; padding: 0 4px; line-height: 1;" title="Tutup">&times;</button>
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">LoRa Channel</label>
            <input type="number" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="65" />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Frekuensi LoRa</label>
            <input type="text" class="modal-input-box readonly-bg" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="915.125 MHz" readonly />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Baud Rate Serial (E220)</label>
            <input type="text" class="modal-input-box readonly-bg" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="9600 Bps" readonly />
          </div>

          <div class="modal-actions-row" style="margin-top: 8px; display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn-modal-close" style="padding: 7px 16px; font-size: 12.5px; border-radius: 18px;" onclick="closeConfigModal()">Tutup</button>
            <button class="btn-modal-save" style="padding: 7px 18px; font-size: 12.5px; border-radius: 18px;" onclick="saveConfigModal('Server')">Simpan</button>
          </div>
        </div>
      `, true);
    });
  }

  // 3. Kalibrasi Multi-Sensor Lengkap (Live In-App Calibration)
  window.saveSensorCalibration = function(sensorKey, actualVal) {
    if (!state.calibration) {
      state.calibration = {
        tds_factor: 1.0,
        temp_w_offset: 0.0,
        temp_a_offset: 0.0,
        hum_offset: 0.0,
        level_offset: 0.0,
        volt_factor: 1.0,
        volt_offset: 0.0,
        pond_depth: 35.0,
        sensor_min_dist: 5.0
      };
    }

    const raw = state.rawTelemetry || {};

    if (sensorKey === 'tds') {
      const rawVal = raw.tds > 0 ? raw.tds : (state.telemetry.tds > 0 ? state.telemetry.tds : 1);
      const actual = parseFloat(actualVal);
      if (!isNaN(actual) && rawVal > 0) {
        state.calibration.tds_factor = parseFloat((actual / rawVal).toFixed(4));
        if (typeof addNotification === 'function') {
          addNotification('success', 'Kalibrasi TDS Berhasil', `Faktor TDS: ${state.calibration.tds_factor} (Sensor: ${rawVal} PPM -> Aktual: ${actual} PPM)`);
        }
        alert(`✅ Kalibrasi TDS Berhasil Disimpan!\nFaktor Kalibrasi: ${state.calibration.tds_factor}\nNilai Sensor: ${rawVal} PPM -> Nilai Aktual: ${actual} PPM`);
      } else {
        alert("⚠️ Masukkan nilai angka aktual TDS yang valid!");
        return;
      }
    } else if (sensorKey === 'temp_w') {
      const rawVal = raw.suhu_air !== undefined ? raw.suhu_air : state.telemetry.suhu_air;
      const actual = parseFloat(actualVal);
      if (!isNaN(actual)) {
        state.calibration.temp_w_offset = parseFloat((actual - rawVal).toFixed(2));
        if (typeof addNotification === 'function') {
          addNotification('success', 'Kalibrasi Suhu Air Berhasil', `Offset Suhu Air: ${state.calibration.temp_w_offset > 0 ? '+' : ''}${state.calibration.temp_w_offset}°C`);
        }
        alert(`✅ Kalibrasi Suhu Air Berhasil Disimpan!\nOffset: ${state.calibration.temp_w_offset > 0 ? '+' : ''}${state.calibration.temp_w_offset}°C (Sensor: ${rawVal.toFixed(1)}°C -> Aktual: ${actual.toFixed(1)}°C)`);
      } else {
        alert("⚠️ Masukkan nilai suhu air aktual yang valid!");
        return;
      }
    } else if (sensorKey === 'temp_a') {
      const rawVal = raw.suhu_udara !== undefined ? raw.suhu_udara : state.telemetry.suhu_udara;
      const actual = parseFloat(actualVal);
      if (!isNaN(actual)) {
        state.calibration.temp_a_offset = parseFloat((actual - rawVal).toFixed(2));
        if (typeof addNotification === 'function') {
          addNotification('success', 'Kalibrasi Suhu Udara Berhasil', `Offset Suhu Udara: ${state.calibration.temp_a_offset > 0 ? '+' : ''}${state.calibration.temp_a_offset}°C`);
        }
        alert(`✅ Kalibrasi Suhu Udara Berhasil Disimpan!\nOffset: ${state.calibration.temp_a_offset > 0 ? '+' : ''}${state.calibration.temp_a_offset}°C`);
      } else {
        alert("⚠️ Masukkan nilai suhu udara aktual yang valid!");
        return;
      }
    } else if (sensorKey === 'hum') {
      const rawVal = raw.kelembaban !== undefined ? raw.kelembaban : state.telemetry.kelembaban;
      const actual = parseFloat(actualVal);
      if (!isNaN(actual)) {
        state.calibration.hum_offset = parseFloat((actual - rawVal).toFixed(1));
        if (typeof addNotification === 'function') {
          addNotification('success', 'Kalibrasi Kelembaban Berhasil', `Offset Kelembaban: ${state.calibration.hum_offset > 0 ? '+' : ''}${state.calibration.hum_offset}%`);
        }
        alert(`✅ Kalibrasi Kelembaban Berhasil Disimpan!\nOffset: ${state.calibration.hum_offset > 0 ? '+' : ''}${state.calibration.hum_offset}%`);
      } else {
        alert("⚠️ Masukkan nilai kelembaban aktual yang valid!");
        return;
      }
    } else if (sensorKey === 'level') {
      const rawVal = raw.level_air !== undefined ? raw.level_air : state.telemetry.level_air;
      const actual = parseFloat(actualVal);
      if (!isNaN(actual)) {
        state.calibration.level_offset = parseFloat((actual - rawVal).toFixed(1));
        if (typeof addNotification === 'function') {
          addNotification('success', 'Kalibrasi Level Air Berhasil', `Offset Level Air: ${state.calibration.level_offset > 0 ? '+' : ''}${state.calibration.level_offset}%`);
        }
        alert(`✅ Kalibrasi Level Air Berhasil Disimpan!\nOffset: ${state.calibration.level_offset > 0 ? '+' : ''}${state.calibration.level_offset}%`);
      } else {
        alert("⚠️ Masukkan nilai level air aktual yang valid!");
        return;
      }
    } else if (sensorKey === 'water_level_config' || sensorKey === 'depth') {
      const depthInp = document.getElementById('calib-inp-depth');
      const minDistInp = document.getElementById('calib-inp-mindist');
      const depth = parseFloat(depthInp ? depthInp.value : actualVal);
      const minDist = parseFloat(minDistInp ? minDistInp.value : 20.0);

      if (!isNaN(depth) && !isNaN(minDist) && depth > minDist) {
        state.calibration.pond_depth = depth;
        state.calibration.sensor_min_dist = minDist;
        state.calibration.level_offset = 0.0;
        if (typeof addNotification === 'function') {
          addNotification('success', 'Kalibrasi Level Air Disimpan', `Dasar (0%): ${depth} cm | Penuh (100%): ${minDist} cm`);
        }
        alert(`✅ Kalibrasi Level Air Disimpan!\n• Air Kosong (0%): Jarak ${depth} cm ke dasar\n• Air Penuh (100%): Jarak ${minDist} cm ke sensor\n\nPerubahan langsung aktif seketika!`);
      } else {
        alert("⚠️ Nilai tidak valid! Jarak Dasar Wadah (0%) harus lebih besar dari Jarak Air Penuh (100%).");
        return;
      }
    } else if (sensorKey === 'solar_threshold' || sensorKey === 'volt') {
      const thresh = parseFloat(actualVal);
      if (!isNaN(thresh) && thresh > 0 && thresh < 24) {
        state.calibration.vbat_solar_threshold = thresh;
        state.calibration.auto_solar_enabled = true;
        if (typeof addNotification === 'function') {
          addNotification('success', 'Ambang Panel Surya Disimpan', `Panel surya akan otomatis aktif saat Aki <= ${thresh}V`);
        }
        alert(`✅ Ambang Batas Panel Surya Disimpan: ${thresh} Volt!\nSistem otomatis mengaktifkan Relay 1 (Panel Surya) saat tegangan aki drop ke angka <= ${thresh}V.`);
      } else {
        alert("⚠️ Masukkan nilai voltase ambang batas (Volt) yang valid (misal: 11.7)!");
        return;
      }
    }

    // Simpan ke localStorage & Firebase
    try {
      localStorage.setItem('aquaponics_calibration', JSON.stringify(state.calibration));
    } catch (e) {}

    if (window.aquaponicsDB && window.aquaponicsDB.db) {
      window.aquaponicsDB.db.ref('config/calibration').set(state.calibration).catch(() => {});
    }

    applyCalibrationToTelemetry();
    if (typeof updateUI === 'function') updateUI();
    if (typeof window.updateLiveCalibrationBadges === 'function') window.updateLiveCalibrationBadges();
  };

  window.resetCalibrationToFactory = function() {
    if (confirm("⚠️ Apakah Anda yakin ingin me-reset SEMUA setelan kalibrasi ke Default Pabrik (Faktor 1.000, Offset 0.0, Kolam 35 cm)?")) {
      state.calibration = {
        tds_factor: 1.0,
        temp_w_offset: 0.0,
        temp_a_offset: 0.0,
        hum_offset: 0.0,
        level_offset: 0.0,
        volt_factor: 1.0,
        volt_offset: 0.0,
        pond_depth: 35.0,
        sensor_min_dist: 5.0
      };
      try {
        localStorage.setItem('aquaponics_calibration', JSON.stringify(state.calibration));
      } catch (e) {}

      if (window.aquaponicsDB && window.aquaponicsDB.db) {
        window.aquaponicsDB.db.ref('config/calibration').set(state.calibration).catch(() => {});
      }

      applyCalibrationToTelemetry();
      if (typeof updateUI === 'function') updateUI();
      if (typeof addNotification === 'function') {
        addNotification('info', 'Reset Pabrik Berhasil', 'Semua sensor dikembalikan ke kalibrasi default pabrik.');
      }
      if (typeof window.updateLiveCalibrationBadges === 'function') {
        window.updateLiveCalibrationBadges();
      }
      alert("🔄 Semua parameter sensor telah berhasil di-reset ke setelan awal pabrik!");
    }
  };

  window.renderCalibrationModalHTML = function() {
    const cal = state.calibration || {
      tds_factor: 1.0,
      temp_w_offset: 0.0,
      temp_a_offset: 0.0,
      hum_offset: 0.0,
      level_offset: 0.0,
      volt_factor: 1.0,
      pond_depth: 35.0,
      sensor_min_dist: 5.0
    };
    const raw = state.rawTelemetry || {
      tds: state.telemetry.tds || 0,
      suhu_air: state.telemetry.suhu_air || 0,
      suhu_udara: state.telemetry.suhu_udara || 0,
      kelembaban: state.telemetry.kelembaban || 0,
      level_air: state.telemetry.level_air || 0,
      voltase_aki: state.telemetry.voltase_aki || 0
    };

    return `
      <div class="calib-compact-modal">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 15.5px; font-weight: 800; margin: 0; color: var(--text-main); display: flex; align-items: center; gap: 7px;">
            <i class="fa-solid fa-sliders" style="color: var(--primary, #2563EB);"></i> Kalibrasi Parameter Sensor
          </h2>
          <button onclick="closeConfigModal()" style="background: none; border: none; font-size: 20px; color: var(--text-muted, #64748B); cursor: pointer; padding: 0 4px; line-height: 1;" title="Tutup">&times;</button>
        </div>

        <div class="calib-procedure-note">
          <i class="fa-solid fa-clipboard-check" style="font-size: 13px; color: #16A34A; flex-shrink: 0;"></i>
          <div><strong>Prosedur Pengujian:</strong> Celupkan sensor &amp; alat ukur standar pada sampel yang sama &rarr; Masukkan nilai pembacaan alat standar &rarr; Klik ikon <i class="fa-solid fa-floppy-disk" style="color: #2563EB;"></i> untuk menyimpan.</div>
        </div>

        <div class="calib-dense-grid">
          
          <!-- 1. SENSOR TDS -->
          <div class="calib-card-row">
            <div class="calib-row-header">
              <div class="calib-title-group">
                <span class="calib-sensor-name"><i class="fa-solid fa-flask" style="color: #06B6D4;"></i> TDS Air</span>
                <span class="calib-live-text" id="calib-live-tds"><i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${raw.tds !== undefined ? raw.tds : state.telemetry.tds} PPM</span>
              </div>
              <div class="calib-status-badge" id="calib-stat-tds">
                Faktor: <strong>${(cal.tds_factor !== undefined ? cal.tds_factor : 1.0).toFixed(3)}</strong>
              </div>
            </div>
            <div class="calib-row-body">
              <input type="number" id="calib-inp-tds" class="calib-input-field" placeholder="Masukkan Nilai Aktual" />
              <button class="calib-save-btn" title="Simpan Kalibrasi TDS" onclick="saveSensorCalibration('tds', document.getElementById('calib-inp-tds').value)">
                <i class="fa-solid fa-floppy-disk"></i>
              </button>
            </div>
          </div>

          <!-- 2. SENSOR SUHU AIR -->
          <div class="calib-card-row">
            <div class="calib-row-header">
              <div class="calib-title-group">
                <span class="calib-sensor-name"><i class="fa-solid fa-temperature-three-quarters" style="color: #2563EB;"></i> Suhu Air</span>
                <span class="calib-live-text" id="calib-live-tempw"><i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(raw.suhu_air !== undefined ? raw.suhu_air : state.telemetry.suhu_air).toFixed(1)}°C</span>
              </div>
              <div class="calib-status-badge" id="calib-stat-tempw">
                Offset: <strong>${(cal.temp_w_offset >= 0 ? '+' : '')}${(cal.temp_w_offset || 0).toFixed(2)}°C</strong>
              </div>
            </div>
            <div class="calib-row-body">
              <input type="number" step="0.1" id="calib-inp-tempw" class="calib-input-field" placeholder="Masukkan Nilai Aktual (°C)" />
              <button class="calib-save-btn" title="Simpan Kalibrasi Suhu Air" onclick="saveSensorCalibration('temp_w', document.getElementById('calib-inp-tempw').value)">
                <i class="fa-solid fa-floppy-disk"></i>
              </button>
            </div>
          </div>

          <!-- 3. SENSOR SUHU UDARA -->
          <div class="calib-card-row">
            <div class="calib-row-header">
              <div class="calib-title-group">
                <span class="calib-sensor-name"><i class="fa-solid fa-sun" style="color: #F59E0B;"></i> Suhu Udara</span>
                <span class="calib-live-text" id="calib-live-tempa"><i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(raw.suhu_udara !== undefined ? raw.suhu_udara : state.telemetry.suhu_udara).toFixed(1)}°C</span>
              </div>
              <div class="calib-status-badge" id="calib-stat-tempa">
                Offset: <strong>${(cal.temp_a_offset >= 0 ? '+' : '')}${(cal.temp_a_offset || 0).toFixed(2)}°C</strong>
              </div>
            </div>
            <div class="calib-row-body">
              <input type="number" step="0.1" id="calib-inp-tempa" class="calib-input-field" placeholder="Masukkan Nilai Aktual (°C)" />
              <button class="calib-save-btn" title="Simpan Kalibrasi Suhu Udara" onclick="saveSensorCalibration('temp_a', document.getElementById('calib-inp-tempa').value)">
                <i class="fa-solid fa-floppy-disk"></i>
              </button>
            </div>
          </div>

          <!-- 4. SENSOR KELEMBABAN -->
          <div class="calib-card-row">
            <div class="calib-row-header">
              <div class="calib-title-group">
                <span class="calib-sensor-name"><i class="fa-solid fa-droplet" style="color: #10B981;"></i> Kelembaban</span>
                <span class="calib-live-text" id="calib-live-hum"><i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${Math.round(raw.kelembaban !== undefined ? raw.kelembaban : state.telemetry.kelembaban)}%</span>
              </div>
              <div class="calib-status-badge" id="calib-stat-hum">
                Offset: <strong>${(cal.hum_offset >= 0 ? '+' : '')}${(cal.hum_offset || 0).toFixed(1)}%</strong>
              </div>
            </div>
            <div class="calib-row-body">
              <input type="number" id="calib-inp-hum" class="calib-input-field" placeholder="Masukkan Nilai Aktual (%)" />
              <button class="calib-save-btn" title="Simpan Kalibrasi Kelembaban" onclick="saveSensorCalibration('hum', document.getElementById('calib-inp-hum').value)">
                <i class="fa-solid fa-floppy-disk"></i>
              </button>
            </div>
          </div>

          <!-- 5. SENSOR LEVEL AIR (KOLAM) -->
          <div class="calib-card-row">
            <div class="calib-row-header">
              <div class="calib-title-group">
                <span class="calib-sensor-name"><i class="fa-solid fa-water" style="color: #3B82F6;"></i> Level Air (Kolam)</span>
                <span class="calib-live-text" id="calib-live-level"><i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(state.telemetry.level_air || 0).toFixed(1)}%</span>
              </div>
              <div class="calib-status-badge" id="calib-stat-level">
                <strong>${cal.pond_depth || 42}cm</strong> (0%) &rarr; <strong>${cal.sensor_min_dist || 20}cm</strong> (100%)
              </div>
            </div>
            <div class="calib-row-body">
              <div class="calib-dual-inputs">
                <div class="calib-input-wrap">
                  <label>Dasar / 0% (cm)</label>
                  <input type="number" id="calib-inp-depth" class="calib-input-field" placeholder="0% (cm)" title="Jarak saat Kosong 0% (Dasar Wadah)" value="${cal.pond_depth || 42}" />
                </div>
                <div class="calib-input-wrap">
                  <label>Penuh / 100% (cm)</label>
                  <input type="number" id="calib-inp-mindist" class="calib-input-field" placeholder="100% (cm)" title="Jarak saat Penuh 100% (Dekat Sensor)" value="${cal.sensor_min_dist || 20}" />
                </div>
              </div>
              <button class="calib-save-btn" title="Simpan Kalibrasi Level Air (Kosong / Penuh)" onclick="saveSensorCalibration('water_level_config', document.getElementById('calib-inp-depth').value)">
                <i class="fa-solid fa-floppy-disk"></i>
              </button>
            </div>
            <div class="calib-warning-banner">
              <i class="fa-solid fa-circle-info" style="font-size: 12px; color: #2563EB; flex-shrink: 0;"></i>
              <span><strong>Perhatian:</strong> Jarak air saat penuh minimal <strong>20 cm</strong> dari sensor (Zona Buta AJ-SR04M).</span>
            </div>
          </div>

          <!-- 6. SENSOR VOLTASE & AUTO PANEL SURYA -->
          <div class="calib-card-row">
            <div class="calib-row-header">
              <div class="calib-title-group">
                <span class="calib-sensor-name"><i class="fa-solid fa-car-battery" style="color: #8B5CF6;"></i> Auto Panel (Aki)</span>
                <span class="calib-live-text" id="calib-live-volt"><i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(state.telemetry.voltase_aki || 0).toFixed(2)}V</span>
              </div>
              <div class="calib-status-badge" id="calib-stat-volt">
                Auto: <strong>&le;${cal.vbat_solar_threshold || 11.7}V</strong>
              </div>
            </div>
            <div class="calib-row-body">
              <input type="number" step="0.1" id="calib-inp-solar" class="calib-input-field" placeholder="Ambang Batas Voltase (Volt)" value="${cal.vbat_solar_threshold || 11.7}" />
              <button class="calib-save-btn" title="Simpan Ambang Auto Panel Surya" onclick="saveSensorCalibration('solar_threshold', document.getElementById('calib-inp-solar').value)">
                <i class="fa-solid fa-floppy-disk"></i>
              </button>
            </div>
          </div>

        </div>

        <div class="calib-modal-footer">
          <button class="btn-reset-compact" onclick="resetCalibrationToFactory()">
            <i class="fa-solid fa-rotate-left"></i> Reset Default Pabrik
          </button>
          <button class="btn-close-compact" onclick="closeConfigModal()">Tutup</button>
        </div>
      </div>
    `;
  };

  window.updateLiveCalibrationBadges = function() {
    const raw = state.rawTelemetry || {};
    const cal = state.calibration || {};

    const elTds = document.getElementById('calib-live-tds');
    if (elTds) elTds.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${raw.tds !== undefined ? raw.tds : state.telemetry.tds} PPM`;

    const elTempW = document.getElementById('calib-live-tempw');
    if (elTempW) elTempW.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(raw.suhu_air !== undefined ? raw.suhu_air : state.telemetry.suhu_air).toFixed(1)}°C`;

    const elTempA = document.getElementById('calib-live-tempa');
    if (elTempA) elTempA.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(raw.suhu_udara !== undefined ? raw.suhu_udara : state.telemetry.suhu_udara).toFixed(1)}°C`;

    const elHum = document.getElementById('calib-live-hum');
    if (elHum) elHum.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${Math.round(raw.kelembaban !== undefined ? raw.kelembaban : state.telemetry.kelembaban)}%`;

    const elLevel = document.getElementById('calib-live-level');
    if (elLevel) elLevel.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(state.telemetry.level_air || 0).toFixed(1)}%`;

    const elVolt = document.getElementById('calib-live-volt');
    if (elVolt) elVolt.innerHTML = `<i class="fa-solid fa-circle" style="font-size: 5px;"></i> ${(state.telemetry.voltase_aki || 0).toFixed(2)}V`;

    // Status badges
    const stTds = document.getElementById('calib-stat-tds');
    if (stTds) stTds.innerHTML = `Faktor: <strong>${(cal.tds_factor !== undefined ? cal.tds_factor : 1.0).toFixed(3)}</strong>`;

    const stTempW = document.getElementById('calib-stat-tempw');
    if (stTempW) stTempW.innerHTML = `Offset: <strong>${(cal.temp_w_offset >= 0 ? '+' : '')}${(cal.temp_w_offset || 0).toFixed(2)}°C</strong>`;

    const stTempA = document.getElementById('calib-stat-tempa');
    if (stTempA) stTempA.innerHTML = `Offset: <strong>${(cal.temp_a_offset >= 0 ? '+' : '')}${(cal.temp_a_offset || 0).toFixed(2)}°C</strong>`;

    const stHum = document.getElementById('calib-stat-hum');
    if (stHum) stHum.innerHTML = `Offset: <strong>${(cal.hum_offset >= 0 ? '+' : '')}${(cal.hum_offset || 0).toFixed(1)}%</strong>`;

    const stLevel = document.getElementById('calib-stat-level');
    if (stLevel) stLevel.innerHTML = `<strong>${cal.pond_depth || 42}cm</strong> (0%) &rarr; <strong>${cal.sensor_min_dist || 20}cm</strong> (100%)`;

    const stVolt = document.getElementById('calib-stat-volt');
    if (stVolt) stVolt.innerHTML = `Auto: <strong>&le;${cal.vbat_solar_threshold || 11.7}V</strong>`;
  };

  const cfgCalib = document.getElementById('cfg-calibration');
  if (cfgCalib) {
    cfgCalib.addEventListener('click', () => {
      openCustomModal(renderCalibrationModalHTML(), false, true);
    });
  }

  // 4. Integrasi Firebase
  const cfgFirebase = document.getElementById('cfg-firebase');
  if (cfgFirebase) {
    cfgFirebase.addEventListener('click', () => {
      openCustomModal(`
        <div class="modal-content-styled modal-compact">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 class="modal-heading-title" style="font-size: 15.5px; font-weight: 800; margin: 0; color: var(--text-main); display: flex; align-items: center; gap: 7px;">
              <i class="fa-solid fa-fire text-amber"></i> Integrasi Firebase Realtime
            </h2>
            <button onclick="closeConfigModal()" style="background: none; border: none; font-size: 20px; color: var(--text-muted, #64748B); cursor: pointer; padding: 0 4px; line-height: 1;" title="Tutup">&times;</button>
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Project ID</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="aquaponics-system-8d6f6" />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Web API Key</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="AlzaSyDAnrIQ6_gihFgcep-Pu3dz3IqxCWBoCDo" />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Database URL</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="https://aquaponics-system-8d6f6-default-rtdb.asia-s" />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Storage Bucket</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="aquaponics-system-8d6f6.firebasestorage.app" />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Messaging Sender ID</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="666440506386" />
          </div>

          <div class="modal-actions-row" style="margin-top: 8px; display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn-modal-close" style="padding: 7px 16px; font-size: 12.5px; border-radius: 18px;" onclick="closeConfigModal()">Tutup</button>
            <button class="btn-modal-save" style="padding: 7px 18px; font-size: 12.5px; border-radius: 18px;" onclick="saveConfigModal('Firebase')">Simpan</button>
          </div>
        </div>
      `, true);
    });
  }

  // 5. Pengaturan Notifikasi (Telegram Bot)
  const cfgNotif = document.getElementById('cfg-notif');
  if (cfgNotif) {
    cfgNotif.addEventListener('click', () => {
      openCustomModal(`
        <div class="modal-content-styled modal-compact">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h2 class="modal-heading-title" style="font-size: 15.5px; font-weight: 800; margin: 0; color: var(--text-main); display: flex; align-items: center; gap: 7px;">
              <i class="fa-solid fa-paper-plane" style="color: var(--primary, #2563EB);"></i> Pengaturan Notifikasi Telegram
            </h2>
            <button onclick="closeConfigModal()" style="background: none; border: none; font-size: 20px; color: var(--text-muted, #64748B); cursor: pointer; padding: 0 4px; line-height: 1;" title="Tutup">&times;</button>
          </div>

          <div class="checkbox-container-box" style="margin-bottom: 8px;">
            <span class="field-label" style="font-size: 12px; font-weight: 700;">Status Notifikasi Telegram</span>
            <input type="checkbox" class="modal-checkbox-custom" checked />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Bot Token Telegram</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="8758597072:AAEe0ymSD2RfdICAoF4EoCflpf2oe" />
          </div>

          <div class="form-field-group" style="gap: 4px;">
            <label class="field-label" style="font-size: 12px; font-weight: 700;">Chat ID Telegram</label>
            <input type="text" class="modal-input-box" style="padding: 8px 12px; font-size: 13px; border-radius: 10px;" value="7207067918" />
          </div>

          <div class="modal-actions-row" style="margin-top: 8px; display: flex; justify-content: flex-end; gap: 8px;">
            <button class="btn-modal-close" style="padding: 7px 16px; font-size: 12.5px; border-radius: 18px;" onclick="closeConfigModal()">Tutup</button>
            <button class="btn-modal-save" style="padding: 7px 18px; font-size: 12.5px; border-radius: 18px;" onclick="saveConfigModal('Notifikasi')">Simpan</button>
          </div>
        </div>
      `, true);
    });
  }

  // 6. Tentang Kami (Judul, Deskripsi Sistem, Fitur Unggulan, Visi Misi, Copyright)
  const cfgAbout = document.getElementById('cfg-about');
  if (cfgAbout) {
    cfgAbout.addEventListener('click', () => {
      openCustomModal(`
        <div class="modal-content-styled about-modal-wrapper" style="gap: 12px; max-height: 85vh; overflow-y: auto; padding-right: 2px;">
          <!-- 1. JUDUL & HEADER SISTEM -->
          <div class="academic-modal-header">
            <div>
              <div class="academic-badge-institute">
                <i class="fa-solid fa-seedling"></i> SMART AQUAPONICS
              </div>
              <h2 class="academic-title">Smart Aquaponics</h2>
              <div class="academic-subtitle">Platform Cerdas Pemantauan Kualitas Air &amp; Kendali Otomatis Kolam</div>
            </div>
            <button onclick="closeConfigModal()" style="background: none; border: none; font-size: 24px; color: var(--text-muted); cursor: pointer; padding: 0 4px; line-height: 1;" title="Tutup">&times;</button>
          </div>
          
          <!-- 2. DESKRIPSI SISTEM (KALIMAT YANG MUDAH DIPAHAMI) -->
          <div class="academic-hero-box">
            <div style="display: flex; gap: 12px; align-items: flex-start;">
              <div class="about-icon-blue" style="width: 42px; height: 42px; font-size: 18px; border-radius: 10px; flex-shrink: 0; background: var(--primary, #2563EB);">
                <i class="fa-solid fa-circle-info"></i>
              </div>
              <div>
                <div style="font-size: 12.5px; font-weight: 800; color: var(--text-main, #1E293B); margin-bottom: 4px;">Deskripsi Sistem</div>
                <p style="font-size: 11.5px; line-height: 1.55; color: var(--text-main, #475569); margin: 0 0 6px 0;">
                  <strong>Smart Aquaponics</strong> adalah sistem pintar yang menggabungkan budidaya ikan dan tanaman secara otomatis. Sistem ini menghubungkan berbagai sensor di kolam langsung ke internet agar Anda dapat merawat dan memantau kolam dengan sangat mudah dan praktis.
                </p>
                <p style="font-size: 11.5px; line-height: 1.55; color: var(--text-main, #475569); margin: 0;">
                  Melalui dashboard ini, Anda dapat melihat kondisi air (kadar nutrisi, suhu, dan ketinggian air kolam) secara langsung (real-time). Anda juga dapat menyalakan pompa air, aerator oksigen, hingga memberi makan ikan secara otomatis maupun manual melalui ponsel Anda dari mana saja tanpa harus memeriksa kolam terus-menerus.
                </p>
                <div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap;">
                  <span class="badge-blue-pill" style="font-size: 9.5px; padding: 3px 9px;"><i class="fa-solid fa-wifi"></i> IoT Real-Time</span>
                  <span class="badge-green-pill" style="font-size: 9.5px; padding: 3px 9px;"><i class="fa-solid fa-microchip"></i> Otomasi Cerdas</span>
                  <span class="badge-blue-pill" style="font-size: 9.5px; padding: 3px 9px; background: var(--bg-hover, #F1F5F9); color: var(--text-muted, #475569);"><i class="fa-solid fa-mobile-screen"></i> Kontrol Jarak Jauh</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. FITUR UNGGULAN -->
          <div class="academic-section-card" style="padding: 12px 14px;">
            <div class="academic-section-title">
              <i class="fa-solid fa-star" style="color: #F59E0B;"></i> Fitur Unggulan Sistem
            </div>
            <div class="academic-feature-grid">
              <div class="academic-feature-item">
                <div class="academic-feature-icon" style="background: #EFF6FF; color: #2563EB;">
                  <i class="fa-solid fa-flask-vial"></i>
                </div>
                <div class="academic-feature-text">
                  <strong>Pemantauan Kualitas Air Real-Time:</strong> Mengetahui kadar kepekatan nutrisi tanaman (PPM/TDS) dan suhu air kolam secara akurat agar tanaman tumbuh subur dan ikan tetap sehat.
                </div>
              </div>
              <div class="academic-feature-item">
                <div class="academic-feature-icon" style="background: #ECFDF5; color: #059669;">
                  <i class="fa-solid fa-water"></i>
                </div>
                <div class="academic-feature-text">
                  <strong>Sensor Ketinggian Air Pintar:</strong> Mengukur ketinggian air kolam secara otomatis guna mencegah luapan air saat hujan atau kekurangan air yang dapat merusak pompa.
                </div>
              </div>
              <div class="academic-feature-item">
                <div class="academic-feature-icon" style="background: #EFF6FF; color: #2563EB;">
                  <i class="fa-solid fa-toggle-on"></i>
                </div>
                <div class="academic-feature-text">
                  <strong>Kendali Pompa &amp; Aerator Jarak Jauh:</strong> Menghidupkan dan mematikan saklar pompa pembesaran, pompa peremajaan, dan aerator penghasil oksigen hanya dengan satu klik.
                </div>
              </div>
              <div class="academic-feature-item">
                <div class="academic-feature-icon" style="background: #ECFDF5; color: #059669;">
                  <i class="fa-solid fa-fish"></i>
                </div>
                <div class="academic-feature-text">
                  <strong>Pemberian Pakan Ikan Otomatis (Smart Feeder):</strong> Mengatur jadwal pemberian pakan ikan secara teratur dan otomatis, atau memberi makan ikan langsung secara instan.
                </div>
              </div>
              <div class="academic-feature-item">
                <div class="academic-feature-icon" style="background: #EFF6FF; color: #2563EB;">
                  <i class="fa-solid fa-solar-panel"></i>
                </div>
                <div class="academic-feature-text">
                  <strong>Cadangan Tenaga Surya (Dual Power ATS):</strong> Sistem otomatis beralih ke daya panel surya saat listrik padam agar kolam tetap aman beroperasi 24 jam nonstop.
                </div>
              </div>
              <div class="academic-feature-item">
                <div class="academic-feature-icon" style="background: #ECFDF5; color: #059669;">
                  <i class="fa-solid fa-bell"></i>
                </div>
                <div class="academic-feature-text">
                  <strong>Notifikasi Peringatan Darurat Telegram:</strong> Mengirimkan pesan peringatan otomatis ke ponsel Anda jika terdeteksi kondisi air atau suhu yang berada di luar batas aman.
                </div>
              </div>
            </div>
          </div>

          <!-- 4. VISI & MISI -->
          <div class="academic-section-card" style="padding: 12px 14px;">
            <div class="academic-section-title">
              <i class="fa-solid fa-bullseye" style="color: #2563EB;"></i> Visi &amp; Misi
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Visi Box -->
              <div class="academic-vision-box">
                <div style="font-size: 18px; color: #D97706; flex-shrink: 0; margin-top: 2px;"><i class="fa-solid fa-eye"></i></div>
                <div>
                  <div style="font-size: 11.5px; font-weight: 800; color: #92400E; text-transform: uppercase; letter-spacing: 0.5px;">Visi</div>
                  <div style="font-size: 11.5px; color: #78350F; line-height: 1.5; margin-top: 2px;">
                    Mewujudkan sistem pertanian akuaponik modern yang hemat tenaga, ramah lingkungan, dan mudah dikelola oleh siapa saja melalui pemanfaatan teknologi Internet of Things (IoT).
                  </div>
                </div>
              </div>

              <!-- Misi Box -->
              <div class="academic-services-box">
                <div style="font-size: 18px; color: #059669; flex-shrink: 0; margin-top: 2px;"><i class="fa-solid fa-rocket"></i></div>
                <div style="flex: 1;">
                  <div style="font-size: 11.5px; font-weight: 800; color: #065F46; text-transform: uppercase; letter-spacing: 0.5px;">Misi</div>
                  <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 4px;">
                    <div style="display: flex; align-items: flex-start; gap: 6px; font-size: 11.5px; color: #047857; line-height: 1.45;">
                      <span style="font-weight: 800; color: #059669;">1.</span>
                      <span><strong>Kemudahan Pengelolaan:</strong> Membantu pengguna merawat ekosistem kolam dan tanaman secara praktis tanpa perlu pengawasan manual terus-menerus.</span>
                    </div>
                    <div style="display: flex; align-items: flex-start; gap: 6px; font-size: 11.5px; color: #047857; line-height: 1.45;">
                      <span style="font-weight: 800; color: #059669;">2.</span>
                      <span><strong>Presisi &amp; Kualitas Hasil:</strong> Menjaga kestabilan nutrisi, suhu, dan pasokan oksigen air demi hasil panen ikan dan tanaman yang optimal.</span>
                    </div>
                    <div style="display: flex; align-items: flex-start; gap: 6px; font-size: 11.5px; color: #047857; line-height: 1.45;">
                      <span style="font-weight: 800; color: #059669;">3.</span>
                      <span><strong>Efisiensi &amp; Keandalan:</strong> Menghadirkan teknologi otomasi yang hemat daya, andal 24/7, serta dapat diakses dari mana saja secara real-time.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. COPYRIGHT -->
          <div class="academic-copyright">
            &copy; 2026 Smart Aquaponics. Hak Cipta Dilindungi.
          </div>

          <!-- TOMBOL TUTUP -->
          <div class="modal-actions-center" style="margin-top: 4px;">
            <button class="btn-modal-close width-100" onclick="closeConfigModal()" style="padding: 10px; font-weight: 700; border-radius: 12px; font-size: 13px;">Tutup</button>
          </div>
        </div>
      `, false, true);
    });
  }

  // Logout
  const sidebarLogout = document.getElementById('sidebar-logout-btn');
  const cfgLogout = document.getElementById('cfg-logout');

  const handleLogout = () => {
    openCustomModal(`
      <div class="modal-content-styled" style="text-align:center; max-width: 380px;">
        <div style="width: 52px; height: 52px; background: rgba(239, 68, 68, 0.12); color: #EF4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; font-size: 22px;">
          <i class="fa-solid fa-right-from-bracket"></i>
        </div>
        <h2 class="modal-heading-title" style="color: #EF4444; margin-bottom: 6px;">Keluar dari Sistem?</h2>
        <p style="font-size:13px; color:var(--text-muted); margin:0 0 16px 0; line-height: 1.5;">Sesi Anda saat ini akan diakhiri dan dashboard akan dikunci kembali ke layar login.</p>
        <div class="modal-actions-row" style="margin-top:16px; display: flex; gap: 10px;">
          <button class="btn-modal-close" style="flex: 1;" onclick="closeConfigModal()">Batal</button>
          <button class="btn-modal-save" style="background:#EF4444; color:#fff; flex: 1; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;" onclick="confirmAuthLogout()">Ya, Keluar</button>
        </div>
      </div>
    `);
  };

  if (sidebarLogout) sidebarLogout.addEventListener('click', handleLogout);
  if (cfgLogout) cfgLogout.addEventListener('click', handleLogout);
}

/* ==========================================================================
   AUTHENTICATION & USER SESSION ENGINE (LOGIN & REGISTRATION)
   ========================================================================== */

const AUTH_STORAGE_KEY = 'aquaponics_auth_users';
const AUTH_SESSION_KEY = 'aquaponics_active_session';

// Akun bawaan (Default Demo Admin)
const DEFAULT_AUTH_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    fullName: 'Administrator Sistem',
    role: 'Admin',
    createdAt: 1740000000000
  }
];

function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_AUTH_USERS));
      return [...DEFAULT_AUTH_USERS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [...DEFAULT_AUTH_USERS];
  } catch (e) {
    return [...DEFAULT_AUTH_USERS];
  }
}

function saveRegisteredUsers(users) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('[Auth Error] Gagal menyimpan database user:', e);
  }
}

function initAuthSystem() {
  getRegisteredUsers(); // Pastikan database user lokal terinisialisasi

  // Cek apakah ada sesi aktif di localStorage atau sessionStorage
  let activeUser = null;
  const localSession = localStorage.getItem(AUTH_SESSION_KEY);
  const sessionOnly = sessionStorage.getItem(AUTH_SESSION_KEY);

  if (localSession) {
    try { activeUser = JSON.parse(localSession); } catch (e) { }
  } else if (sessionOnly) {
    try { activeUser = JSON.parse(sessionOnly); } catch (e) { }
  }

  const authOverlay = document.getElementById('auth-screen-overlay');
  if (activeUser && activeUser.username) {
    state.currentUser = activeUser;
    if (authOverlay) authOverlay.classList.add('hidden-auth');
    updateLoggedUserUI(activeUser);
  } else {
    state.currentUser = null;
    if (authOverlay) authOverlay.classList.remove('hidden-auth');
  }
}
window.initAuthSystem = initAuthSystem;

function updateLoggedUserUI(user) {
  if (!user) return;
  const nameEl = document.getElementById('sidebar-logged-user-name');
  if (nameEl) {
    nameEl.innerText = user.fullName || user.username;
    nameEl.title = `${user.fullName || user.username} (@${user.username})`;
  }
}

function switchAuthView(viewMode) {
  const loginBox = document.getElementById('auth-login-box');
  const regBox = document.getElementById('auth-register-box');
  const loginAlert = document.getElementById('login-alert-msg');
  const regAlert = document.getElementById('reg-alert-msg');
  const subTitleEl = document.getElementById('auth-sub-title');

  if (loginAlert) loginAlert.style.display = 'none';
  if (regAlert) regAlert.style.display = 'none';

  if (viewMode === 'register') {
    if (loginBox) loginBox.style.display = 'none';
    if (regBox) regBox.style.display = 'block';
    if (subTitleEl) subTitleEl.innerText = 'Buat akun agar masuk dan mengontrol sistem';
    const firstInput = document.getElementById('reg-fullname');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  } else {
    if (regBox) regBox.style.display = 'none';
    if (loginBox) loginBox.style.display = 'block';
    if (subTitleEl) subTitleEl.innerText = 'Masuk untuk memantau dan kontrol sistem';
    const firstInput = document.getElementById('login-username');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);
  }
}
window.switchAuthView = switchAuthView;

function togglePasswordVisibility(inputId, btnEl) {
  const field = document.getElementById(inputId);
  if (!field) return;

  const isPassword = field.type === 'password';
  field.type = isPassword ? 'text' : 'password';

  if (btnEl) {
    btnEl.innerHTML = isPassword
      ? '<i class="fa-regular fa-eye-slash" style="color: #2563EB;"></i>'
      : '<i class="fa-regular fa-eye"></i>';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

function showAuthAlert(boxId, type, message) {
  const alertEl = document.getElementById(boxId);
  if (!alertEl) return;

  alertEl.className = `auth-alert-message ${type}`;
  alertEl.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${message}</span>`;
  alertEl.style.display = 'flex';
}

function handleAuthLogin(event) {
  if (event) event.preventDefault();

  const userInp = document.getElementById('login-username');
  const passInp = document.getElementById('login-password');
  const remInp = document.getElementById('login-remember');
  const submitBtn = document.getElementById('btn-login-submit');

  const username = (userInp ? userInp.value : '').trim().toLowerCase();
  const password = (passInp ? passInp.value : '').trim();
  const rememberMe = remInp ? remInp.checked : true;

  if (!username || !password) {
    showAuthAlert('login-alert-msg', 'error', 'Username dan kata sandi wajib diisi!');
    return;
  }

  // Tampilkan efek loading pada tombol
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi...';
  }

  setTimeout(() => {
    const users = getRegisteredUsers();
    const matchedUser = users.find(u =>
      (u.username.toLowerCase() === username || (u.email && u.email.toLowerCase() === username)) &&
      u.password === password
    );

    if (matchedUser) {
      showAuthAlert('login-alert-msg', 'success', `Berhasil masuk! Selamat datang, ${matchedUser.fullName || matchedUser.username}`);

      // Simpan Sesi
      const sessionData = {
        username: matchedUser.username,
        fullName: matchedUser.fullName,
        role: matchedUser.role || 'User',
        loginTime: Date.now()
      };

      if (rememberMe) {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      } else {
        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(sessionData));
        localStorage.removeItem(AUTH_SESSION_KEY);
      }

      state.currentUser = sessionData;
      updateLoggedUserUI(sessionData);

      setTimeout(() => {
        const authOverlay = document.getElementById('auth-screen-overlay');
        if (authOverlay) authOverlay.classList.add('hidden-auth');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Masuk Sekarang</span> <i class="fa-solid fa-arrow-right"></i>';
        }
        if (typeof addNotification === 'function') {
          addNotification('success', 'Sesi Masuk Berhasil', `Selamat datang kembali, ${matchedUser.fullName || matchedUser.username}!`);
        }
      }, 700);

    } else {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Masuk Sekarang</span> <i class="fa-solid fa-arrow-right"></i>';
      }
      showAuthAlert('login-alert-msg', 'error', 'Username atau kata sandi tidak cocok. Silakan coba lagi!');
    }
  }, 400);
}
window.handleAuthLogin = handleAuthLogin;

function handleAuthRegister(event) {
  if (event) event.preventDefault();

  const fnInp = document.getElementById('reg-fullname');
  const userInp = document.getElementById('reg-username');
  const passInp = document.getElementById('reg-password');
  const confInp = document.getElementById('reg-confirm-password');
  const submitBtn = document.getElementById('btn-reg-submit');

  const fullName = (fnInp ? fnInp.value : '').trim();
  const username = (userInp ? userInp.value : '').trim().toLowerCase().replace(/\s+/g, '');
  const password = (passInp ? passInp.value : '').trim();
  const confirmPassword = (confInp ? confInp.value : '').trim();

  if (!fullName || !username || !password || !confirmPassword) {
    showAuthAlert('reg-alert-msg', 'error', 'Semua kolom formulir pendaftaran wajib diisi!');
    return;
  }

  if (username.length < 3) {
    showAuthAlert('reg-alert-msg', 'error', 'Username minimal harus 3 karakter!');
    return;
  }

  if (password.length < 4) {
    showAuthAlert('reg-alert-msg', 'error', 'Kata sandi minimal harus 4 karakter!');
    return;
  }

  if (password !== confirmPassword) {
    showAuthAlert('reg-alert-msg', 'error', 'Konfirmasi kata sandi tidak cocok!');
    return;
  }

  const users = getRegisteredUsers();
  const isExist = users.some(u => u.username.toLowerCase() === username);

  if (isExist) {
    showAuthAlert('reg-alert-msg', 'error', `Username "@${username}" sudah terdaftar. Silakan gunakan username lain!`);
    return;
  }

  // Tampilkan efek loading
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan Akun...';
  }

  setTimeout(() => {
    const newUser = {
      username: username,
      password: password,
      fullName: fullName,
      role: 'User',
      createdAt: Date.now()
    };

    users.push(newUser);
    saveRegisteredUsers(users);

    // Sinkronisasi akun ke Firebase RTDB users jika tersambung
    if (window.aquaponicsDB && window.aquaponicsDB.db) {
      window.aquaponicsDB.db.ref('users/' + username).set({
        fullName: fullName,
        username: username,
        createdAt: Date.now()
      }).catch(() => {});
    }

    showAuthAlert('reg-alert-msg', 'success', 'Akun berhasil dibuat! Mengalihkan ke form login...');

    setTimeout(() => {
      // Reset form reg
      if (fnInp) fnInp.value = '';
      if (userInp) userInp.value = '';
      if (passInp) passInp.value = '';
      if (confInp) confInp.value = '';

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Daftar Sekarang</span> <i class="fa-solid fa-check"></i>';
      }

      // Switch ke view login dan isi username otomatis
      switchAuthView('login');
      const loginUserInp = document.getElementById('login-username');
      const loginPassInp = document.getElementById('login-password');
      if (loginUserInp) {
        loginUserInp.value = username;
      }
      if (loginPassInp) {
        loginPassInp.value = password;
        loginPassInp.focus();
      }

      showAuthAlert('login-alert-msg', 'success', `Akun @${username} siap digunakan. Silakan klik Masuk.`);
    }, 1200);
  }, 400);
}
window.handleAuthRegister = handleAuthRegister;

function confirmAuthLogout() {
  if (typeof closeConfigModal === 'function') closeConfigModal();

  localStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  state.currentUser = null;

  const authOverlay = document.getElementById('auth-screen-overlay');
  if (authOverlay) {
    authOverlay.classList.remove('hidden-auth');
    switchAuthView('login');
  }

  const loginAlert = document.getElementById('login-alert-msg');
  if (loginAlert) {
    loginAlert.style.display = 'none';
  }

  const loginUser = document.getElementById('login-username');
  const loginPass = document.getElementById('login-password');
  if (loginUser) loginUser.value = '';
  if (loginPass) loginPass.value = '';

  if (typeof addNotification === 'function') {
    addNotification('info', 'Sesi Berakhir', 'Anda telah berhasil keluar dari sistem.');
  }
}
window.confirmAuthLogout = confirmAuthLogout;

