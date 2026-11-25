const dashboardState = {tab: 0, month: '', day: '', past: false, grade: '', status: ''};
function renderDashboard(data, request, refresh) {
  const root = document.querySelector('#partner-data');
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Taipei'}).format(new Date());
  const state = dashboardState;
  state.month ||= today.slice(0,7);
  const element = (tag, value = '', cls = '') => {
    const node = document.createElement(tag);
    node.textContent = value;
    node.className = cls;
    return node;
  };
  const button = (label, action, active) => {
    const node = element('button', label, 'dash-button');
    node.type = 'button';
    if (active !== undefined) node.setAttribute('aria-pressed', String(active));
    node.onclick = action;
    return node;
  };
  const group = (...items) => {
    const node = element('div', '', 'dash-group');
    node.append(...items);
    return node;
  };
  const date = row => {
    const match = String(row.date).trim().match(/^(\d{4}|\d{3})[./年-](\d{1,2})[./月-](\d{1,2})/);
    if (!match) return '';
    const year = Number(match[1]) + (match[1].length === 3 ? 1911 : 0);
    return [year, match[2].padStart(2,'0'), match[3].padStart(2,'0')].join('-');
  };
  const sorted = rows => rows.filter(date).sort((a,b) => date(a).localeCompare(date(b)) || String(a.time).localeCompare(String(b.time), undefined, {numeric:true}));
  const classes = sorted(data.classes);
  const prep = sorted(data.prep);
  const grade = row => {
    const match = String(row.sheet || '').match(/^\(([一二三四五六])上\)/);
    return match ? '一二三四五六'.indexOf(match[1]) + 1 : Number(row.grade) || 0;
  };
  const gradeLabel = row => grade(row) ? '一二三四五六'[grade(row)-1] + '年級' : row.grade || '備課';
  const person = name => {
    const node = element('span', '', 'volunteer-person');
    const key = String(name).replace(/[（(].*?[）)]/g, '').replace(/\s+/g, '');
    const profile = data.profiles?.[key];
    if (profile?.picture && /^https:\/\//.test(profile.picture)) {
      const image = document.createElement('img');
      image.src = profile.picture;
      image.alt = '';
      image.width = 30;
      image.height = 30;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => image.remove();
      node.append(image);
    }
    node.append(element('span',name));
    return node;
  };
  const people = (label,names) => {
    const node = element('div', '', 'volunteer-people');
    node.append(element('span',label + '｜'));
    if (!names.length) node.append(element('span','—'));
    else names.forEach(name=>node.append(person(name)));
    return node;
  };
  const status = row => {
    if (row.main.length > 1) return ['enough',row.support.length ? '協助已足夠' : '雙主講'];
    if (!row.support.length) return ['need',grade(row) <= 2 ? '歡迎協助' : '需要協助'];
    if (grade(row) > 2 && row.support.length === 1) return ['nice','再 1 位更安心'];
    return ['enough','已有協助'];
  };
  const upcoming = classes.filter(row => date(row) >= today);
  const card = (row, canRegister = false) => {
    const node = element('article','','dash-card');
    const [,month,day] = date(row).split('-');
    const tile = element('div','','dash-date');
    tile.append(element('small', Number(month)+' 月'), element('strong', String(Number(day))),element('small', row.day || ''));
    const body = element('div','','dash-card-body');
    body.append(element('h3',[gradeLabel(row),row.unit || row.content].filter(Boolean).join('｜')),
      element('p', [row.time,row.role].filter(Boolean).join(' · ')));
    if (row.main) {
      const [key,label] = status(row);
      body.append(element('span',label,'dash-badge '+key),
        people('主講',row.main),
        people('協助',row.support));
    }
    if (row.people) body.append(element('p',row.people));
    if (row.note) body.append(element('p',row.note,'dash-note'));
    if (canRegister && row.support.length < 3 && date(row) >= today) {
      const message = element('p');
      message.setAttribute('role','status');
      const register = button('我可以協助', async () => {
        if (!window.confirm('確認登記協助 '+gradeLabel(row)+'｜'+row.date+' '+row.time+'？')) return;
        register.disabled = true;
        try {
          const result = await request('support',{sheet:row.sheet,row:row.row,unit:row.unit,date:row.date,time:row.time});
          if (!result.ok) { message.textContent = result.message || '登記未完成。'; return; }
          root.dataset.notice = '已登記協助。';
          await refresh();
        } catch {
          message.textContent = '暫時無法確認登記結果，請重新整理班表。';
        } finally {
          register.disabled = false;
        }
      });
      body.append(register,message);
    }
    node.append(tile,body);
    return node;
  };
  const monthBar = () => {
    const [year,month] = state.month.split('-').map(Number);
    const move = offset => {
      const next = new Date(Date.UTC(year,month-1+offset,1));
      state.month = next.toISOString().slice(0,7);
      state.day = '';
      draw();
    };
    return group(button('‹ 上個月',()=>move(-1)),element('h3',year+' 年 '+month+' 月'),button('下個月 ›',()=>move(1)));
  };
  const appendCards = (panel, rows, register = false) => {
    panel.append(...(rows.length ? rows.map(row=>card(row,register)) : [element('p','目前沒有符合的安排。','dash-empty')]));
  };
  const calendar = panel => {
    const rows = sorted(data.myCalendar);
    const [year,month] = state.month.split('-').map(Number);
    const first = new Date(Date.UTC(year,month-1,1)).getUTCDay();
    const length = new Date(Date.UTC(year,month,0)).getUTCDate();
    const firstEvent = rows.find(row => date(row).startsWith(state.month));
    const selected = state.day || (firstEvent ? date(firstEvent) : today.startsWith(state.month) ? today : '');
    const grid = element('div','','dash-calendar');
    for (const day of '日一二三四五六') grid.append(element('span',day,'dash-weekday'));
    for (let i=0;i<first;i++) grid.append(element('span'));
    for (let day=1;day<=length;day++) {
      const key = state.month+'-'+String(day).padStart(2,'0');
      const events = rows.filter(row=>date(row)===key);
      const cell = button(String(day),()=>{state.day=key;draw();},selected===key);
      if (key === today) cell.setAttribute('aria-current','date');
      cell.setAttribute('aria-label',key+'，'+events.length+' 堂');
      for (const role of ['主講','協助']) {
        if (events.some(row=>row.role===role)) cell.append(element('small',role,'dash-event '+(role==='主講'?'lead-role':'support-role')));
      }
      grid.append(cell);
    }
    panel.append(monthBar(),grid);
    if (selected) panel.append(element('h3',selected+' 入班安排'));
    appendCards(panel,rows.filter(row=>date(row)===selected));
    panel.append(element('p','班表上的姓名與 EQ 組資料的正式姓名相符時，主講與協助會顯示在這裡。','dash-note'));
  };
  const filters = (items,current,select) => group(...items.map(([key,label])=>button(label,()=>{select(key);draw();},current===key)));
  const draw = () => {
    const labels = ['入班班表','我的行事曆','備課行程'];
    const title = element('h2','📱 EQ 行動班表');
    const stats = group(...[
      [upcoming.filter(row=>status(row)[0]!=='enough').length,'即將入班・需要協助'],
      [upcoming.filter(row=>status(row)[0]==='enough').length,'即將入班・協助已足夠'],
      [prep.length,'備課場次']
    ].map(([count,label])=>{
      const node=element('div','','dash-stat');
      node.append(element('strong',String(count)),element('span',label));
      return node;
    }));
    const link = element('a','雲端班表 ↗','dash-button');
    link.href = 'https://docs.google.com/spreadsheets/d/1VIMJ1UwX1Zo3adPK1VWhD9nFQ7v6Id7jRNAF-75nWKk/edit';
    link.target='_blank';link.rel='noopener';
    const nav = filters(labels.map((label,i)=>[i,label]),state.tab,key=>{state.tab=key;});
    nav.setAttribute('role','group');
    nav.setAttribute('aria-label','夥伴中心功能');
    nav.append(link);
    const panel = element('section','','dash-panel');
    panel.setAttribute('aria-label',labels[state.tab]);
    if (root.dataset.notice) {
      const notice=element('p',root.dataset.notice);
      notice.setAttribute('role','status');
      panel.append(notice);
      delete root.dataset.notice;
    }
    if (state.tab===1) calendar(panel);
    if (state.tab===0) {
      panel.append(filters([[false,'即將入班'],[true,'過往紀錄']],state.past,key=>{state.past=key;
          const lastPast = key && classes.filter(row=>date(row)<today).at(-1);
          state.month = (lastPast ? date(lastPast) : today).slice(0,7);
          state.day='';}),
        element('p',state.past?'顯示已過日期的入班安排。':'顯示今天及未來的入班安排；已過日期可至「過往紀錄」查詢。','dash-note'),monthBar(),
        filters([['','全部年級'],...[...'一二三四五六'].map((n,i)=>[i+1,n+'年級'])],state.grade,key=>{state.grade=key;}),
        filters([['','全部'],['need','需要協助'],['nice','再一位更安心'],['enough','已有人協助']],state.status,key=>{state.status=key;}));
      appendCards(panel,classes.filter(row=>date(row).startsWith(state.month) && (date(row)<today)===state.past && (!state.grade || grade(row)===state.grade) && (!state.status || status(row)[0]===state.status)),!state.past);
      panel.append(element('p','＊低年級同時段多班可視現場需要輪流跑班；中高年級若非雙主講，盡量每班安排 1 位協助，有 2 位會更安心。','dash-note'));
    }
    if (state.tab===2) appendCards(panel,prep);
    root.replaceChildren(title,element('p','快速查看這學期的入班、備課與協助狀況。','dash-note'),stats,nav,panel);
  };
  root.classList.add('eq-dashboard');
  root.hidden=false;
  draw();
  renderFinance(data.finance, element, request);
}

function renderFinance(finance, element, request) {
  const root = document.querySelector('#partner-finance');
  const section = element('details', '', 'finance-panel');
  section.open = root.querySelector('details')?.open ?? false;
  section.append(element('summary', '組內收支與 115 學年預算'));
  root.replaceChildren(section);
  root.hidden = false;
  if (finance !== undefined) {
    appendFinance(section, finance, element);
    return;
  }

  const message = element('p', '');
  message.setAttribute('role', 'status');
  const retry = element('button', '重新載入', 'dash-button');
  retry.type = 'button';
  retry.hidden = true;
  let pending = false;
  const load = async () => {
    if (pending) return;
    pending = true;
    retry.hidden = true;
    message.textContent = '正在載入組內收支…';
    try {
      const result = await request('finance');
      if (!result.ok || !('data' in result)) throw new Error('Finance unavailable');
      section.removeEventListener('toggle', onOpen);
      message.remove();
      retry.remove();
      appendFinance(section, result.data, element);
    } catch {
      message.textContent = '暫時無法載入組內收支。';
      retry.hidden = false;
    } finally {
      pending = false;
    }
  };
  const onOpen = () => { if (section.open && retry.hidden) load(); };
  retry.addEventListener('click', load);
  section.append(message, retry);
  section.addEventListener('toggle', onOpen);
  if (section.open) load();
}

function appendFinance(section, finance, element) {
  if (!finance) {
    section.append(element('p', '目前沒有收支資料。'));
    return;
  }

  const money = new Intl.NumberFormat('zh-TW', {style:'currency', currency:'TWD', maximumFractionDigits:0});
  const balance = element('div', '', 'finance-card');
  balance.append(element('span', '目前結餘'), element('strong', money.format(finance.balance)));
  section.append(balance);

  for (const [title, rows] of [['收支明細',finance.transactions],['預算說明',finance.budgetItems]]) {
    const details = element('details', '', 'finance-list');
    details.append(element('summary',title+'（'+rows.length+'）'));
    for (const row of rows) {
      const item = element('div', '', 'finance-entry');
      const description = element('div');
      description.append(element('strong',row.item),element('small',[row.date || row.period,row.type].filter(Boolean).join(' · ')));
      if (row.note) description.append(element('small',row.note));
      const tone = row.type === '支出' ? 'expense' : row.type === '收入' ? 'income' : '';
      item.append(description,element('strong',money.format(row.amount),'finance-amount '+tone));
      details.append(item);
    }
    if (!rows.length) details.append(element('p','目前沒有資料。'));
    section.append(details);
  }
}

