const partnerLogin = Object.freeze({ liffId: '2012514874-Xmecd90u', backendUrl: 'https://script.google.com/macros/s/AKfycbzxgAOY6tTzP0F0jJ19GBmAXlPRCKIl1KUp2gNZ1IescQBTRiG3AHffqWHTLJi-2Aml/exec' }); 
const loginButton = document.querySelector('#line-login');
const loginMessage = document.querySelector('#line-message');

async function loadLineSdk() {
  await new Promise((resolve, reject) => {
    const sdk = document.createElement('script');
    sdk.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    sdk.onload = resolve;
    sdk.onerror = reject;
    document.head.append(sdk);
  });
}

function showLineProfile() {
  const name = document.querySelector('#line-name');
  const avatar = document.querySelector('#line-avatar');
  const update = (displayName, picture) => {
    if (displayName) name.textContent = displayName;
    if (typeof picture !== 'string' || !picture.startsWith('https://')) return;
    avatar.onerror = () => { avatar.hidden = true; };
    avatar.onload = () => { avatar.hidden = false; };
    avatar.src = picture;
  };
  const profile = liff.getDecodedIDToken();
  name.textContent = 'LINE 帳號';
  document.querySelector('#line-profile').hidden = false;
  document.querySelector('#line-title').hidden = true;
  update(profile?.name, profile?.picture);
  if (!profile?.name || !profile?.picture) {
    liff.getProfile().then(data => update(data.displayName, data.pictureUrl)).catch(() => {});
  }
}

async function initializeLogin() {
  if (window.self !== window.top) {
    loginMessage.textContent = '請用 LINE、Chrome 或 Safari 直接開啟夥伴中心網址。';
    return;
  }
  let stage = 'line';
  try {
    await loadLineSdk();
    await liff.init({ liffId: partnerLogin.liffId });
    if (!liff.isLoggedIn()) {
      loginMessage.textContent = '請使用 LINE 帳號登入。';
      loginButton.hidden = false;
      loginButton.addEventListener('click', () => {
        try {
          liff.login();
        } catch {
          loginMessage.textContent = '請從 LINE 開啟夥伴中心後再試一次。';
        }
      });
      return;
    }

    const idToken = liff.getIDToken();
    if (!idToken) {
      loginMessage.textContent = '未取得 LINE 身分授權。請從 LINE 重新開啟夥伴中心，並允許登入授權。';
      return;
    }
    if (!partnerLogin.backendUrl) {
      loginMessage.textContent = '已完成 LINE 登入。志工資格驗證與資料同步尚未開通。';
      return;
    }
    stage = 'member';
    showLineProfile();
    loginMessage.textContent = '正在載入班表與收支…';
    const request = async (action, data = {}) => {
      const response = await fetch(partnerLogin.backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action, idToken, ...data }),
        cache: 'no-store',
        signal: AbortSignal.timeout(25000)
      });
      if (!response.ok) throw new Error('Login service unavailable');
      return response.json();
    };
    const showCenter = result => {
      if (!result.ok || !result.data) throw new Error('Dashboard unavailable');
      renderDashboard(result.data, request, openCenter);
      loginMessage.textContent = '已進入夥伴中心。';
    };
    const openCenter = async () => showCenter(await request('dashboard', {deferFinance: true}));
    const dashboard = await request('dashboard', {deferFinance: true});
    if (!dashboard.ok) {
      loginMessage.textContent = '班表載入失敗：' + (dashboard.message || '後端未提供錯誤原因');
      if (dashboard.message === 'LINE 登入驗證失敗') {
        loginMessage.textContent = 'LINE 身分驗證未通過，請重新登入後再試。';
        loginButton.textContent = '重新登入 LINE';
        loginButton.hidden = false;
        loginButton.onclick = () => {
          liff.logout();
          liff.login({redirectUri: new URL('partners.html', window.location.href).href});
        };
      }
      return;
    }
    if (dashboard.ok && dashboard.data) {
      showCenter(dashboard);
      return;
    }
    const result = dashboard.status === 'needs_binding' ? dashboard : await request('auth');
    if (result.ok && result.status === 'ok') {
      throw new Error('Dashboard unavailable');
    } else if (result.ok && result.status === 'needs_binding') {
      if (result.bindingMode !== 'password') {
        loginMessage.textContent = 'EQ 密碼登入等待後端更新。';
        return;
      }
      const form = document.querySelector('#line-bind');
      const button = form.querySelector('button');
      form.hidden = false;
      loginMessage.textContent = '首次登入請輸入 EQ 密碼。';
      form.addEventListener('submit', async event => {
        event.preventDefault();
        button.disabled = true;
        try {
          const bound = await request('bind', {password: document.querySelector('#eq-password').value});
          if (!bound.ok) {
            loginMessage.textContent = bound.message || '無法完成綁定，請聯絡 EQ 組長。';
            return;
          }
          form.reset();
          form.hidden = true;
          await openCenter();
        } catch {
          loginMessage.textContent = '目前無法完成驗證，請稍後再試。';
        } finally {
          button.disabled = false;
        }
      });
    } else if (result.ok && result.status === 'inactive') {
      loginMessage.textContent = '目前無法確認志工資格，請聯絡 EQ 組長。';
    } else {
      throw new Error('Unexpected login response');
    }
  } catch (error) {
    loginMessage.textContent = stage === 'line'
      ? 'LINE 登入無法初始化。請在 Chrome、Safari 或 LINE 中重新開啟。'
      : '班表載入失敗（' + (error.name || 'Error') + '）：' + error.message;
  }
}


initializeLogin();
