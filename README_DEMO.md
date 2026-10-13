# TempleHub 完整流程 Demo

這是可操作的競賽 Demo，流程為：AI 對話推薦 → 選供品與店家 → 建立 QR 預約 → 店家核銷 → 廟方參拜打卡 → 設定還願提醒。

## 本機執行

在此資料夾執行：

```powershell
node server.js
```

然後開啟 `http://localhost:3000`。信徒端建立預約後，按「切到店家核銷端 Demo」，輸入 QR 下方的核銷碼。核銷成功後，回到信徒端即可繼續參拜與還願流程。

## 部署前準備

此專案可直接以 `Dockerfile` 部署到 Render 或 Railway。部署平台需要設定環境變數 `APP_URL`、`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`LIFF_ID`；這些值不可提交到 Git 或放在畫面原始碼。

## 正式 LINE 化的四個替換點

1. Rich Menu 的「AI 諮詢」送 postback 到 Messaging API webhook，取代首頁的範例問題。
2. 把這個 HTML 放到 HTTPS 網址並註冊為 LIFF；使用者從 OA 開啟，不另做帳密。
3. 店家端以另一個 LIFF 或網頁掃描 QR，呼叫 `/api/redeem`；正式版須由資料庫驗證一次性 token、店家身分與到期時間。
4. 使用排程服務查詢提醒日，再以 Messaging API push message 發送還願提醒；僅對已加好友且主動同意提醒的使用者發送。

## LINE 原生分工

使用者不會從 OA 被導到一般產品網站：OA 聊天室處理「詢問考試／文昌」、Rich Menu 是入口、Messaging API 回覆 Flex Message 與推播提醒。只有選店、顯示 QR、設定還願日期會開啟 LIFF；LIFF 仍在 LINE App 的內建瀏覽器中。外部 HTTPS 網址只是 LINE 對 LIFF 與 webhook 的技術要求。

設定時請複製 `.env.example` 為 `.env`，填入 LINE Developers 提供的 Channel secret、Channel access token 與 LIFF ID。Messaging API 的 webhook URL 設為：`https://你的網域/callback`。若使用者在 OA 輸入「下週考試，想求心安」，`/callback` 會回覆可直接開啟 LIFF 的 Flex Message。

## 示範資料聲明

台北市文昌宮與店家名稱是依公開資訊選出的「潛在合作名單」，不是已合作對象。請在比賽簡報與畫面維持此標示，直到取得書面同意。
