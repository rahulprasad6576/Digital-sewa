class VoiceCommandManager {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.notSupported = true; return; }
    this.notSupported = false;
    this.recognition = new SR();
    this.isListening = false;
    this.shouldBeListening = false;
    this.language = localStorage.getItem('voiceLang') || 'en-US';
    this.awaitingInput = false;
    this.inputCallback = null;
    this.setupRecognition();
    this.initCommands();
    this.page = this.detectPage();
  }

  setupRecognition() {
    const self = this;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;
    this.recognition.onstart = function() { self.isListening = true; self.updateUI('listening'); };
    this.recognition.onresult = function(e) {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' '; else interim += t;
      }
      self.updateUI('interim', interim);
      if (final) {
        const text = final.trim();
        if (self.awaitingInput && self.inputCallback) {
          self.inputCallback(text);
          self.awaitingInput = false;
          self.inputCallback = null;
        } else { self.processCommand(text); }
      }
    };
    this.recognition.onerror = function(e) {
      if (e.error !== 'no-speech') self.showNotification('Voice Error: ' + e.error, 'error');
      if (e.error !== 'not-allowed') {
        setTimeout(function() { if (self.shouldBeListening) try { self.recognition.start(); } catch(x) {} }, 500);
      }
    };
    this.recognition.onend = function() {
      self.isListening = false; self.updateUI('stopped');
      if (self.shouldBeListening) {
        setTimeout(function() { try { self.recognition.start(); } catch(x) {} }, 300);
      }
    };
  }

  detectPage() {
    const p = window.location.pathname.split('/').pop() || 'index.html';
    if (p === 'index.html' || p === '') return 'home';
    if (p === 'login.html') return 'login';
    if (p === 'signup.html') return 'signup';
    if (p === 'dashboard.html') return 'dashboard';
    if (p === 'payment.html') return 'payment';
    if (p === 'contact.html') return 'contact';
    if (p === 'plans.html') return 'plans';
    if (p === 'about.html') return 'about';
    if (p === 'privacy.html') return 'privacy';
    if (p === 'admin-login.html') return 'adminLogin';
    if (p === 'admin.html') return 'admin';
    return 'home';
  }

  initCommands() {
    const en = {};
    const add = (k, fn) => { en[k] = fn; };

    add('login', () => this.nav('login.html'));
    add('go to login', () => this.nav('login.html'));
    add('sign in', () => this.nav('login.html'));
    add('signup', () => this.nav('signup.html'));
    add('register', () => this.nav('signup.html'));
    add('new account', () => this.nav('signup.html'));
    add('create account', () => this.nav('signup.html'));
    add('dashboard', () => this.nav('dashboard.html'));
    add('go home', () => this.nav('index.html'));
    add('home page', () => this.nav('index.html'));
    add('go to home', () => this.nav('index.html'));
    add('payment', () => this.nav('payment.html'));
    add('pay bill', () => this.nav('payment.html'));
    add('make payment', () => this.nav('payment.html'));
    add('recharge', () => this.nav('payment.html'));
    add('mobile recharge', () => this.nav('payment.html'));
    add('plans', () => this.nav('plans.html'));
    add('show plans', () => this.nav('plans.html'));
    add('view plans', () => this.nav('plans.html'));
    add('contact', () => this.nav('contact.html'));
    add('support', () => this.nav('contact.html'));
    add('help', () => this.showHelp());
    add('customer service', () => this.nav('contact.html'));
    add('about', () => this.nav('about.html'));
    add('about us', () => this.nav('about.html'));
    add('privacy', () => this.nav('privacy.html'));
    add('privacy policy', () => this.nav('privacy.html'));
    add('admin', () => this.nav('admin-login.html'));
    add('admin login', () => this.nav('admin-login.html'));
    add('admin panel', () => this.nav('admin.html'));
    add('logout', () => this.logout());
    add('sign out', () => this.logout());
    add('exit', () => this.logout());
    add('refresh', () => location.reload());
    add('reload', () => location.reload());
    add('go back', () => history.back());
    add('back', () => history.back());
    add('submit', () => this.clickBtn(['Submit','Login','Sign Up','Pay','Send','Recharge']));
    add('click submit', () => this.clickBtn(['Submit','Login','Sign Up','Pay','Send','Recharge']));
    add('clear', () => this.clearForms());
    add('clear form', () => this.clearForms());
    add('clear all', () => this.clearForms());
    add('listen', () => this.start());
    add('start listening', () => this.start());
    add('stop listening', () => this.stop());
    add('stop', () => this.stop());
    add('read commands', () => this.showHelp());
    add('show commands', () => this.showHelp());
    add('what can i say', () => this.showHelp());
    add('dark mode', () => this.toggleDark());
    add('light mode', () => this.toggleDark());
    add('toggle dark mode', () => this.toggleDark());
    add('theme', () => this.toggleDark());
    add('open chatbot', () => this.toggleChat(true));
    add('close chatbot', () => this.toggleChat(false));
    add('chatbot', () => this.toggleChat());
    add('assistant', () => this.toggleChat());
    add('scroll up', () => this.scroll('up'));
    add('scroll down', () => this.scroll('down'));
    add('scroll top', () => this.scroll('top'));
    add('scroll bottom', () => this.scroll('bottom'));
    add('go to top', () => this.scroll('top'));
    add('go to bottom', () => this.scroll('bottom'));
    add('read page', () => this.readPage());
    add('read this', () => this.readPage());
    add('speak', () => this.readPage());
    add('notifications', () => this.showNotif());
    add('show notifications', () => this.showNotif());
    add('hide notifications', () => this.hideNotif());
    add('language', () => this.toggleLang());
    add('change language', () => this.toggleLang());
    add('hindi', () => this.setLang('hi-IN'));
    add('english', () => this.setLang('en-US'));
    add('fill email', () => this.fillVoice('email', 'email'));
    add('fill password', () => this.fillVoice('password', 'password'));
    add('fill name', () => this.fillVoice('name', 'text'));
    add('fill phone', () => this.fillVoice('phone', 'tel'));
    add('fill mobile', () => this.fillVoice('mobile', 'tel'));
    add('fill amount', () => this.fillVoice('amount', 'number'));
    add('fill message', () => this.fillVoice('message', 'textarea'));
    add('fill subject', () => this.fillVoice('subject', 'text'));
    add('fill consumer id', () => this.fillVoice('billConsumerId', 'text'));
    add('fill biller', () => this.fillVoice('billBiller', 'text'));
    add('fill subscriber id', () => this.fillVoice('dthSubscriberId', 'text'));
    add('fill mobile number', () => this.fillVoice('mobileNumber', 'tel'));
    add('enter email', () => this.fillVoice('email', 'email'));
    add('enter password', () => this.fillVoice('password', 'password'));
    add('enter name', () => this.fillVoice('name', 'text'));
    add('enter phone', () => this.fillVoice('phone', 'tel'));
    add('enter amount', () => this.fillVoice('amount', 'number'));
    add('enter message', () => this.fillVoice('message', 'textarea'));
    add('open pan', () => this.openSvc('pan'));
    add('pan card', () => this.openSvc('pan'));
    add('open aadhaar', () => this.openSvc('aadhaar'));
    add('aadhaar', () => this.openSvc('aadhaar'));
    add('open electricity', () => this.openSvc('electricity'));
    add('electricity', () => this.openSvc('electricity'));
    add('open water', () => this.openSvc('water'));
    add('water bill', () => this.openSvc('water'));
    add('open mobile', () => this.openSvc('mobile'));
    add('mobile', () => this.openSvc('mobile'));
    add('open dth', () => this.openSvc('dth'));
    add('dth', () => this.openSvc('dth'));
    add('open gas', () => this.openSvc('gas'));
    add('gas booking', () => this.openSvc('gas'));
    add('open train', () => this.openSvc('train'));
    add('train', () => this.openSvc('train'));
    add('fetch bill', () => this.clickText('Fetch Bill'));
    add('pay bill now', () => this.clickText('Pay'));
    add('submit request', () => this.clickText('Submit Request'));
    add('close modal', () => this.closeModal());
    add('close', () => this.closeModal());
    add('contact support', () => this.nav('contact.html'));
    add('upgrade plan', () => this.nav('plans.html'));
    add('service payment', () => this.switchTab('payment'));
    add('mobile recharge tab', () => this.switchTab('mobile'));
    add('dth recharge tab', () => this.switchTab('dth'));
    add('select airtel', () => this.selectOp('Airtel'));
    add('select jio', () => this.selectOp('Jio'));
    add('select vi', () => this.selectOp('Vi'));
    add('select bsnl', () => this.selectOp('BSNL'));
    add('select tata play', () => this.selectDthOp('Tata Play'));
    add('select dish tv', () => this.selectDthOp('Dish TV'));
    add('select airtel dth', () => this.selectDthOp('Airtel DTH'));
    add('select d2h', () => this.selectDthOp('D2H'));
    add('pay now', () => this.clickText('Pay Now'));
    add('recharge now', () => this.clickText('Recharge Now'));
    add('send message', () => this.clickText('Send Message'));
    add('send', () => this.clickText('Send Message'));
    add('login now', () => this.clickText('Login'));
    add('sign up now', () => this.clickText('Sign Up'));
    add('refresh stats', () => this.refreshAdmin());
    add('show users', () => this.scrollTo('usersTable'));
    add('show contacts', () => this.scrollTo('contactsTable'));

    const hi = Object.assign({}, en);
    hi['login'] = () => this.nav('login.html');
    hi['laaigin'] = () => this.nav('login.html');
    hi['signup'] = () => this.nav('signup.html');
    hi['saain ap'] = () => this.nav('signup.html');
    hi['dashboard'] = () => this.nav('dashboard.html');
    hi['daishabord'] = () => this.nav('dashboard.html');
    hi['payment'] = () => this.nav('payment.html');
    hi['peiment'] = () => this.nav('payment.html');
    hi['bhugtan'] = () => this.nav('payment.html');
    hi['recharge'] = () => this.nav('payment.html');
    hi['richard'] = () => this.nav('payment.html');
    hi['plans'] = () => this.nav('plans.html');
    hi['yojna'] = () => this.nav('plans.html');
    hi['contact'] = () => this.nav('contact.html');
    hi['sampark'] = () => this.nav('contact.html');
    hi['logout'] = () => this.logout();
    hi['laag aut'] = () => this.logout();
    hi['submit'] = () => this.clickBtn(['Submit','Login','Sign Up','Pay','Send','Recharge']);
    hi['suna shuru karo'] = () => this.start();
    hi['suna band karo'] = () => this.stop();
    hi['daark mod'] = () => this.toggleDark();
    hi['chaibod'] = () => this.toggleChat();
    hi['suchna'] = () => this.showNotif();
    hi['hindi'] = () => this.setLang('hi-IN');
    hi['english'] = () => this.setLang('en-US');
    hi['email bhare'] = () => this.fillVoice('email', 'email');
    hi['password bhare'] = () => this.fillVoice('password', 'password');
    hi['naam bhare'] = () => this.fillVoice('name', 'text');
    hi['rashi bhare'] = () => this.fillVoice('amount', 'number');
    hi['pan khole'] = () => this.openSvc('pan');
    hi['aadhar khole'] = () => this.openSvc('aadhaar');
    hi['bijli khole'] = () => this.openSvc('electricity');
    hi['paani khole'] = () => this.openSvc('water');
    hi['mobile khole'] = () => this.openSvc('mobile');
    hi['gas khole'] = () => this.openSvc('gas');
    hi['train khole'] = () => this.openSvc('train');
    hi['modal band karo'] = () => this.closeModal();
    hi['abhi bhugtan karo'] = () => this.clickText('Pay Now');
    hi['abhi richard karo'] = () => this.clickText('Recharge Now');
    hi['sandesh bheje'] = () => this.clickText('Send Message');

    this.commands = { 'en-US': en, 'hi-IN': hi };
  }

  processCommand(t) {
    const lower = t.toLowerCase().trim();
    const cmds = this.commands[this.language] || this.commands['en-US'];
    for (const cmd in cmds) {
      if (lower === cmd || lower.includes(cmd)) {
        this.showNotification('Done: ' + cmd, 'success');
        try { cmds[cmd](); } catch(e) { console.error(e); }
        return;
      }
    }
    this.showNotification('Not recognized: ' + t, 'info');
  }

  start() { if (this.notSupported || this.isListening) return; this.shouldBeListening = true; this.recognition.lang = this.language; try { this.recognition.start(); this.showNotification('Listening... speak now', 'info'); } catch(e) {} }
  stop() { this.shouldBeListening = false; if (this.isListening) try { this.recognition.stop(); this.showNotification('Stopped', 'info'); } catch(e) {} }
  nav(page) { window.location.href = page; }
  logout() { localStorage.clear(); this.showNotification('Logged out', 'success'); setTimeout(function() { window.location.href = 'index.html'; }, 1000); }
  clearForms() { document.querySelectorAll('input,textarea').forEach(function(el) { el.value = ''; }); this.showNotification('Cleared', 'success'); }
  clickBtn(labels) { for (let i = 0; i < labels.length; i++) { const l = labels[i]; const arr = Array.from(document.querySelectorAll('button,input[type=submit]')); const b = arr.find(function(x) { return (x.textContent || x.value || '').toLowerCase().includes(l.toLowerCase()); }); if (b) { b.click(); this.showNotification('Clicked: ' + l, 'success'); return; } } this.showNotification('No button found', 'error'); }
  clickText(text) { const arr = Array.from(document.querySelectorAll('button')); const b = arr.find(function(x) { return (x.textContent || '').toLowerCase().includes(text.toLowerCase()); }); if (b) { b.click(); this.showNotification('Clicked: ' + text, 'success'); } else this.showNotification('Button not found: ' + text, 'error'); }

  fillVoice(id, type) {
    const el = document.getElementById(id) || document.querySelector('input[type="' + type + '"]') || document.querySelector('input[name="' + id + '"]') || document.querySelector('textarea[name="' + id + '"]');
    if (!el) { this.showNotification('Field not found: ' + id, 'error'); return; }
    this.awaitingInput = true;
    const self = this;
    this.inputCallback = function(val) { el.value = val; self.showNotification('Filled ' + id + ': ' + val, 'success'); };
    this.showNotification('Speak the value for ' + id + '...', 'info');
  }

  openSvc(type) { if (typeof openService === 'function') openService(type); else if (typeof window.openService === 'function') window.openService(type); else this.nav('dashboard.html'); }
  closeModal() { const m = document.getElementById('serviceModal'); if (m) m.style.display = 'none'; if (typeof window.closeModal === 'function') window.closeModal(); }
  switchTab(tab) { if (typeof window.switchTab === 'function') window.switchTab(tab); else { document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); }); const t = document.getElementById('tab-' + tab); if (t) t.classList.add('active'); document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); }); const arr = Array.from(document.querySelectorAll('.tab-btn')); const btn = arr.find(function(b) { const oc = b.getAttribute('onclick') || ''; return oc.includes(tab); }); if (btn) btn.classList.add('active'); } }
  selectOp(op) { const btns = document.querySelectorAll('#tab-mobile .operator-btn'); btns.forEach(function(b) { b.classList.remove('active'); }); const arr = Array.from(btns); const btn = arr.find(function(b) { return b.textContent.trim() === op; }); if (btn) { btn.click(); this.showNotification('Selected: ' + op, 'success'); } }
  selectDthOp(op) { const btns = document.querySelectorAll('#tab-dth .operator-btn'); btns.forEach(function(b) { b.classList.remove('active'); }); const arr = Array.from(btns); const btn = arr.find(function(b) { return b.textContent.trim() === op; }); if (btn) { btn.click(); this.showNotification('Selected: ' + op, 'success'); } }

  toggleDark() { if (typeof window.toggleDarkMode === 'function') window.toggleDarkMode(); else { document.documentElement.classList.toggle('dark-mode'); localStorage.setItem('darkMode', document.documentElement.classList.contains('dark-mode')); } }
  toggleChat(open) { const box = document.getElementById('chatbotBox'); if (!box) return; const isActive = box.classList.contains('active'); if (open === true && !isActive) box.classList.add('active'); else if (open === false && isActive) box.classList.remove('active'); else if (open === undefined) box.classList.toggle('active'); }
  scroll(dir) { const amt = dir === 'up' ? -300 : dir === 'down' ? 300 : dir === 'top' ? -99999 : 99999; window.scrollBy(0, amt); }
  readPage() { const text = document.body.innerText.substring(0, 500); const u = new SpeechSynthesisUtterance(text); u.lang = this.language; window.speechSynthesis.speak(u); }
  showNotif() { if (typeof window.showNotifications === 'function') window.showNotifications(); }
  hideNotif() { const p = document.getElementById('notifPanel'); if (p) p.style.display = 'none'; if (typeof window.hideNotifications === 'function') window.hideNotifications(); }
  toggleLang() { this.setLang(this.language === 'en-US' ? 'hi-IN' : 'en-US'); }
  setLang(lang) { this.language = lang; localStorage.setItem('voiceLang', lang); if (this.recognition) this.recognition.lang = lang; this.showNotification('Lang: ' + (lang === 'hi-IN' ? 'Hindi' : 'English'), 'success'); }
  refreshAdmin() { if (typeof window.loadStats === 'function') window.loadStats(); this.showNotification('Stats refreshed', 'success'); }
  scrollTo(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({behavior: 'smooth'}); }

  showNotification(msg, type) {
    const n = document.createElement('div');
    n.style.cssText = 'position:fixed;bottom:80px;right:20px;padding:12px 20px;background:' + (type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3') + ';color:white;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.3);font-size:14px;z-index:9999;animation:slideIn 0.3s;';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(function() { n.remove(); }, 3000);
  }

  updateUI(status, msg) {
    const el = document.getElementById('voice-status') || this.createStatusEl();
    const map = { listening: 'Listening...', interim: 'Hearing: ' + msg, stopped: 'Stopped', error: msg };
    el.textContent = map[status] || msg;
    el.style.color = status === 'listening' ? '#4CAF50' : status === 'interim' ? '#2196F3' : status === 'error' ? '#f44336' : '#757575';
  }

  createStatusEl() {
    const el = document.createElement('div');
    el.id = 'voice-status';
    el.style.cssText = 'position:fixed;bottom:20px;right:180px;padding:10px 20px;background:white;border-radius:5px;box-shadow:0 2px 5px rgba(0,0,0,0.2);font-size:14px;font-weight:bold;z-index:10000;';
    document.body.appendChild(el);
    return el;
  }

  showHelp() {
    const cmds = this.commands[this.language] || this.commands['en-US'];
    const list = Object.keys(cmds).slice(0, 60).join('\n  - ');
    const w = window.open('', 'commands', 'width=520,height=650');
    w.document.write('<!DOCTYPE html><html><head><title>Voice Commands</title><style>body{font-family:Arial;padding:20px;background:#f5f5f5;}h1{color:#333;}.box{background:white;padding:20px;border-radius:8px;max-height:550px;overflow-y:auto;font-size:13px;line-height:1.6;}</style></head><body><h1>Voice Commands (' + (this.language === 'hi-IN' ? 'Hindi' : 'English') + ')</h1><div class="box"><strong>Commands:</strong><br>  - ' + list + '</div></body></html>');
  }
}

let voiceManager;
document.addEventListener('DOMContentLoaded', function() {
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return;
  voiceManager = new VoiceCommandManager();

  const html = '<div id="voice-controls" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:10001;">' +
    '<button id="v-toggle" style="padding:12px 20px;background:#4CAF50;color:white;border:none;border-radius:50px;cursor:pointer;font-size:16px;font-weight:bold;box-shadow:0 2px 10px rgba(0,0,0,0.2);">Start</button>' +
    '<button id="v-lang" style="padding:12px 18px;background:#2196F3;color:white;border:none;border-radius:50px;cursor:pointer;font-size:14px;font-weight:bold;box-shadow:0 2px 10px rgba(0,0,0,0.2);">EN</button>' +
    '<button id="v-help" style="padding:12px 18px;background:#FF9800;color:white;border:none;border-radius:50px;cursor:pointer;font-size:14px;font-weight:bold;box-shadow:0 2px 10px rgba(0,0,0,0.2);">?</button>' +
    '</div>';
  document.body.insertAdjacentHTML('beforeend', html);

  document.getElementById('v-toggle').addEventListener('click', function() {
    if (voiceManager.isListening) { voiceManager.stop(); this.textContent = 'Start'; this.style.background = '#4CAF50'; }
    else { voiceManager.start(); this.textContent = 'Stop'; this.style.background = '#f44336'; }
  });
  document.getElementById('v-lang').addEventListener('click', function() {
    voiceManager.toggleLang();
    this.textContent = voiceManager.language === 'hi-IN' ? 'HI' : 'EN';
  });
  document.getElementById('v-help').addEventListener('click', function() { voiceManager.showHelp(); });

  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') { document.getElementById('v-toggle').click(); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') { document.getElementById('v-lang').click(); e.preventDefault(); }
  });
});

