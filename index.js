'use strict';

const line = require('@line/bot-sdk');
const express = require('express');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// LINE SDK clientの作成
const client = new line.Client(config);

// Express appの作成
const app = express();

// webhookのhandler設定
// エンドポイントになりそう？
app.post('/callback', line.middleware(config), (res, req) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(reslt))
    .catch((err) => {
      console.log(err);
      res.status(500).end();
    })
});

// event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore event
    return Promise.resolve(null);
  }

  // returnするメッセージの処理
  const echo = { type: 'text', text: event.message.text };

  // use reply API
  return client.replyMessage(event.replyToken, echo);
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
