const API = 'https://YOUR-RENDER-APP.onrender.com';

const i18n = {
  ar: {
    title: 'حمّل أي فيديو من أي رابط',
    subtitle: 'الصق الرابط، اختر الجودة، ونزّل. مجاني ومفتوح.',
    placeholder: 'https://example.com/video',
    fetch: 'جلب', download: 'تحميل',
    footer: 'مبني بـ FastAPI + yt-dlp',
    loading: 'جاري جلب المعلومات...',
    error: 'حصل خطأ. تأكد من الرابط وحاول تاني.',
    downloading: 'جاري التنزيل...',
    done: 'خلص! جاري التحميل على جهازك.',
    invalid: 'الرابط مش صحيح.'
  },
  en: {
    title: 'Download any video from any link',
    subtitle: 'Paste the link, pick quality, download. Free and open.',
    placeholder: 'https://example.com/video',
    fetch: 'Fetch', download: 'Download',
    footer: 'Built with FastAPI + yt-dlp',
    loading: 'Fetching info...',
    error: 'Something went wrong. Check the link and try again.',
    downloading: 'Downloading...',
    done: 'Done! Downloading to your device.',
    invalid: 'Invalid URL.'
  }
};

let lang = localStorage.getItem('lang') || 'ar';
let currentUrl = '';
let ws = null;
const $ = (id) => document.getElementById(id);

function applyLang() {
  const t = i18n[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t[el.dataset.i18n]);
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => el.placeholder = t[el.dataset.i18nPlaceholder]);
  $('langToggle').textContent = lang === 'ar' ? 'EN' : 'ع';
}

$('langToggle').addEventListener('click', () => {
  lang = lang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('lang', lang);
  applyLang();
});

function showStatus(msg, type = 'loading') {
  const s = $('status');
  s.textContent = msg;
  s.className = `status ${type}`;
}
function hideStatus() { $('status').className = 'status hidden'; }

$('fetchBtn').addEventListener('click', async () => {
  const url = $('urlInput').value.trim();
  const t = i18n[lang];
  if (!url || !/^https?:\/\//.test(url)) { showStatus(t.invalid, 'error'); return; }
  currentUrl = url;
  $('fetchBtn').disabled = true;
  $('result').classList.add('hidden');
  showStatus(t.loading, 'loading');
  try {
    const res = await fetch(`${API}/api/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    $('thumb').src = data.thumbnail || '';
    $('videoTitle').textContent = data.title || '—';
    $('videoDuration').textContent = formatDuration(data.duration);
    const sel = $('formatSelect');
    sel.innerHTML = '';
    data.formats.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.format_id;
      opt.textContent = `${f.label} — ${f.ext}`;
      sel.appendChild(opt);
    });
    hideStatus();
    $('result').classList.remove('hidden');
  } catch { showStatus(t.error, 'error'); }
  finally { $('fetchBtn').disabled = false; }
});

$('downloadBtn').addEventListener('click', () => {
  if (!currentUrl) return;
  const t = i18n[lang];
  const formatId = $('formatSelect').value;
  $('downloadBtn').disabled = true;
  $('progressWrap').classList.remove('hidden');
  showStatus(t.downloading, 'loading');
  const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
  ws = new WebSocket(`${wsUrl}/api/download`);
  ws.onopen = () => ws.send(JSON.stringify({ url: currentUrl, format_id: formatId }));
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.status === 'progress') {
      const pct = Math.round(msg.percent || 0);
      $('progressFill').style.width = `${pct}%`;
      $('progressText').textContent = `${pct}%`;
    }
    if (msg.status === 'done') {
      $('progressFill').style.width = '100%';
      $('progressText').textContent = '100%';
      showStatus(t.done, 'loading');
      window.location.href = `${API}/api/file/${msg.file_id}`;
      ws.close();
      $('downloadBtn').disabled = false;
    }
    if (msg.status === 'error') {
      showStatus(t.error, 'error'); ws.close();
      $('downloadBtn').disabled = false;
    }
  };
  ws.onerror = () => { showStatus(t.error, 'error'); $('downloadBtn').disabled = false; };
});

function formatDuration(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [h, m, s].filter((v, i) => i > 0 || v > 0)
    .map(v => String(v).padStart(2, '0')).join(':');
}
applyLang();
