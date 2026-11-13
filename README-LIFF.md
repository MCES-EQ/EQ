# 民族國小 EQ｜新版 LIFF 夥伴中心部署說明

## 這版做了什麼
- 公開招募網站 + LINE LIFF 夥伴中心分流
- 第一次登入：LINE + 姓名 + 手機末三碼綁定志工名單
- 後續登入：只需 LINE，一鍵進入
- 夥伴中心：本月入班、我的協助、備課、組內收支
- 組內收支為唯讀，避免一般夥伴修改帳務
- 入班協助仍只寫入班表的「協助1～協助3」欄

## 還差一個必要值：LIFF ID
LINE Channel ID 不是 LIFF ID。請到 LINE Developers Console → 你的 LINE Login Channel → LIFF → Add LIFF app，建立後會得到類似 `1234567890-AbCdEfGh` 的 LIFF ID。
目前網站已使用 LIFF ID `2012514874-kYSNuZdO`，不需要再修改 LIFF ID。

Endpoint URL 請填你的正式網站網址，例如：
https://mces-eq.github.io/EQ/

Scopes 至少勾：openid、profile。

## Apps Script
將 Code.gs 內容放到 Apps Script 後，在 Script Properties 設定：
- LINE_CHANNEL_ID = LINE Login Channel ID
- MASTER_SPREADSHEET_ID = 1gQ34vpuSNIqU42cjMmFQuNQif56fm-hI68sLfkVVgko
- SCHEDULE_SPREADSHEET_ID = 1VIMJ1UwX1Zo3adPK1VWhD9nFQ7v6Id7jRNAF-75nWKk

部署成 Web App：
- Execute as: Me
- Who has access: Anyone

如果重新部署得到新 /exec URL，把 index.html 的 BACKEND_URL 換掉。現在檔案沿用：
https://script.google.com/macros/s/AKfycbzxgAOY6tTzP0F0jJ19GBmAXlPRCKIl1KUp2gNZ1IescQBTRiG3AHffqWHTLJi-2Aml/exec

## 志工授權名單
Code.gs 會自動建立 `LIFF志工授權` 分頁，欄位：
姓名｜手機末三碼｜LINE_USER_ID｜狀態｜角色｜綁定時間

第一次上線前，請先把現有 EQ 志工的「姓名、手機末三碼、狀態、角色」放進去；LINE_USER_ID、綁定時間留空即可。
狀態可填：啟用 / 停用。
角色可填：主講志工 / 協助志工 / 組長 / 副組長。

## 收支資料
在 EQ志工主資料庫新增兩個分頁：

### EQ收支
日期｜項目｜類別｜類型｜金額｜備註
2026/09/01｜培訓教材費｜教材｜支出｜3500｜
2026/09/05｜志工繳費｜培訓｜收入｜8000｜

「類型」請固定使用：收入 / 支出。

### EQ預算
年度/學期｜預算項目｜預算金額｜備註
115上｜教材｜15000｜
115上｜影印｜5000｜

夥伴中心只讀取這兩張表，不提供修改按鈕。

## 安全原則
- 前端不靠 LINE 顯示名稱判斷身分。
- ID token 傳到 Apps Script，由伺服器向 LINE 驗證。
- 第一次綁定用志工姓名＋手機末三碼核對。
- 入班資料只允許寫入協助欄，不碰日期、時間、主講與備註。
- 收支區完全唯讀。


## 2026-11-13 更新：我的行事曆＋統一資料庫

### 主要資料庫
改用「EQ組資料」Google Sheet：
https://docs.google.com/spreadsheets/d/1TssKrjjbUgKtq_fHcAhIG9vyEqbtatVTGVRoVh_nL5c/edit

- `Line名單`：志工名單＋LIFF 綁定資料
- `財務報表`：現有收支明細（網站唯讀）
- `預算編列`：預算項目與金額（網站唯讀）

`Line名單` 已新增欄位：
`手機末三碼 / LINE_USER_ID / 登入狀態 / 角色 / 綁定時間`

第一次 LIFF 綁定前，請先在「手機末三碼」欄填入該志工的資料。綁定成功後，`LINE_USER_ID`、`登入狀態`、`角色`、`綁定時間` 會由後端自動寫入。

### 我的行事曆
登入後新增「我的行事曆」頁籤，會從 115 上雲端班表找出姓名出現在：
- 主講1 / 主講2 → 顯示「主講」
- 協助1 / 協助2 / 協助3 → 顯示「協助」

只顯示今天以後的入班，依日期排序。

### Apps Script Script Properties
- `LINE_CHANNEL_ID`：LINE Login Channel ID
- `MASTER_SPREADSHEET_ID`：可不填，預設已指向 EQ組資料
- `SCHEDULE_SPREADSHEET_ID`：可不填，預設已指向 115上民族EQ雲端班表


## 11/23 志工權限切換
- `Line名單` 的 L 欄為「有效志工」。
- 2026/11/23 前：現有名單成員可先完成 LINE 綁定。
- 2026/11/23 起：只有 L 欄為 TRUE／是／有效／啟用的人可以進入志工專區。
- 這個欄位只作為權限名單，不需要再定期詢問服務狀態。
- 暫停或退出的夥伴把 L 欄改成 FALSE 或留空，即會停止志工專區權限。
