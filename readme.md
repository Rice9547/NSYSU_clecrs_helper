# 課表預覽

## 成果
![demo](https://i.imgur.com/hjImsQB.png)

## 架構
### 爬蟲
於 `/spider/` 內。
#### 設定
包含必修課、期望過濾的課程(課號or部分課名)、想找的課程(類別or部分課名)。可見 `config.json`。
#### 主體
使用 node.js 的 request 發請求、cheerio 做分析、iconv-lite 編碼及解碼。
### 前端
原本是純 html，後來拆改寫 ejs，但 code 沒什麼改，所以基本上可以當 html 看...。沒有特別拆 js file。使用 bootstrap 的按鈕 + table + modal。

## 使用
1. 先確認電腦有 node.js 的環境。
2. 進入爬蟲的資料夾。`cd spider`。
3. 編輯 `config.json`，建議撈的類別 + 課名不要超過 7 種。
4. 開始爬。`node spider.js`，這步驟會根據 `config.json` 而產生一個陣列到 `result.js` 裡。
5. 回到根目錄。`cd ../`。
6. `npm start` 開啟 server。
7. 可以用啦~

## 困難
1. 中文似乎只能傳 Big5 編碼，但 request 中的 qs 參數會自動 encode 成 UTF8，暫時的解法是直接在 url 中用字串串接的方式做，但不是長久之計。
2. 期末考要爆炸惹我卻在寫 code，學分母湯了QQ
