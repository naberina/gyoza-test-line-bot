'use strict';

const line = require('@line/bot-sdk');
const express = require('express');
const conf = require("./conf")
const func = require("./function")

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// LINE SDK clientの作成
const client = new line.Client(config);

// Express appの作成
const app = express();

// webhookのhandler設定
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  let reply_msg;
  switch (event.type){

    // **************************
    // メッセージイベント受信時に実行
    // **************************
    case "message":
      reply_msg = await func.messageFunc(event);
      console.log(reply_msg)
      break;

    // **************************
    // 問題の返信(postback)イベント受信時に実行
    // **************************
    case "postback":
      reply_msg = await func.postbackFunc(event);
      break;
  }

  if (reply_msg !== undefined) {
    return client
      .replyMessage(event.replyToken, reply_msg)
      .catch((err) => {
        console.error(err);
      })
  }
}

// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
