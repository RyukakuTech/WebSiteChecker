// website-check.js
const puppeteer = require('puppeteer');

async function websiteCheck() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // ユーザーエージェントを設定（ボット検知回避）
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('ページにアクセス中...');
    await page.goto('https://store.stpr.com/products/rinu-0014', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    console.log('ボタンの状態を確認中...');
    
    // ボタンの状態をチェック
    const buttonInfo = await page.evaluate(() => {
      const buyButtonsDiv = document.querySelector('div.ProductForm__BuyButtons');
      if (!buyButtonsDiv) {
        return { found: false, error: 'BuyButtons div not found' };
      }
      
      const button = buyButtonsDiv.querySelector('button');
      if (!button) {
        return { found: false, error: 'Button not found in BuyButtons div' };
      }
      
      return {
        found: true,
        disabled: button.disabled,
        text: button.textContent?.trim() || '',
        className: button.className || ''
      };
    });
    
    console.log('ボタン情報:', JSON.stringify(buttonInfo, null, 2));
    
    if (!buttonInfo.found) {
      console.log('エラー:', buttonInfo.error);
      await sendSlackNotification({
        type: 'error',
        message: `ボタンが見つかりませんでした: ${buttonInfo.error}`
      });
      return;
    }
    
    // ボタンがアクティブ（disabled=false）の場合に通知
    if (!buttonInfo.disabled) {
      console.log('🎉 ボタンがアクティブになりました！');
      await sendSlackNotification({
        type: 'success',
        message: 'ボタンがアクティブになりました！',
        buttonText: buttonInfo.text,
        url: 'https://store.stpr.com/products/rinu-0014'
      });
    } else {
      console.log('ボタンはまだ無効です');
      // 無効状態では通知しない（ログのみ）
    }
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
    await sendSlackNotification({
      type: 'error',
              message: `チェック中にエラーが発生しました: ${error.message}`
    });
  } finally {
    await browser.close();
  }
}

async function sendSlackNotification({ type, message, buttonText, url }) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error('SLACK_WEBHOOK_URL が設定されていません');
    return;
  }
  
  let payload;
  
  if (type === 'success') {
    payload = {
      text: "🎉 ボタンステータス通知",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 ボタンがアクティブになりました！"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*商品:* RINU-0014`
            },
            {
              type: "mrkdwn",
              text: `*ボタンテキスト:* ${buttonText}`
            },
            {
              type: "mrkdwn",
              text: `*確認時刻:* ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
            }
          ]
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "商品ページを開く"
              },
              url: url,
              style: "primary"
            }
          ]
        }
      ]
    };
  } else {
    // エラー通知
    payload = {
      text: "⚠️ ボタンチェックエラー",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚠️ ボタンチェックでエラーが発生"
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*エラー内容:* ${message}\n*確認時刻:* ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
          }
        }
      ]
    };
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log('Slack通知を送信しました');
    } else {
      console.error('Slack通知の送信に失敗:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Slack通知送信エラー:', error);
  }
}

// Node.jsのfetchポリフィル（Node.js 18未満の場合）
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// メイン実行
websiteCheck().catch(console.error);