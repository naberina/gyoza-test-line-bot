'use strict';

const { KintoneRestAPIClient } = require("@kintone/rest-api-client");
const conf = require("./conf")
const kintoneGyozaQuizAppId = 181;
const kintoneGyozaLevelAppId = 182;
const kintoneGyozaUserAppId = 183;

const kintone_client = new KintoneRestAPIClient({
  baseUrl: process.env.KINTONE_BASE_URL,
  auth: { apiToken: process.env.QUIZ_KINTONE_API_TOKEN }
});

const kintone_level_client = new KintoneRestAPIClient({
  baseUrl: process.env.KINTONE_BASE_URL,
  auth: { apiToken: process.env.LEVEL_KINTONE_API_TOKEN }
});

const kintone_user_client = new KintoneRestAPIClient({
  baseUrl: process.env.KINTONE_BASE_URL,
  auth: { apiToken: process.env.USER_KINTONE_API_TOKEN }
});

// **************************
// 餃子ランクに対応するメッセージを返す関数
// **************************
async function getGyozaRankMessage(record) {
  let level_id = (Number(record.point.value) === 0) ? 11 : (Number(record.point.value) + 1) ;
  const result = await kintone_level_client.record.getRecord({
    app: kintoneGyozaLevelAppId,
    id: level_id
  });
  return result;
}

// **************************
// FIX: ランダムに10件の質問を作成する
// **************************
// async function createRandomGyozaQuizRecord(event) {
//   const getKintoneRecords = await kintone_client.record.getRecords({app: kintoneGyozaQuizAppId});
//   let arry = [];
//   let params_obj = {};
//   getKintoneRecords.records.forEach(record => {
//     params_obj = {
//         value: {
//           question: {
//             value: record.question.value
//           },
//           answer: {
//             value: record.answer.value
//           }
//         }
//       }
//     arry.push(params_obj);
//   });
//   return arry;
// }

// **************************
// 挑戦者アプリにレコード登録
// **************************
async function postGyozaQuizChallengerRecord(event, quiz_record) {
  let params = {
    user_id: {
      value: event.source.userId,
    },
    table: {
      value: [
        {
          question: {
            value: quiz_record.question.value
          },
          answer: {
            value: quiz_record.answer.value
          }
        }
      ]
    }
  };
  const result = await kintone_user_client.record.addRecord({app: kintoneGyozaUserAppId, record: params });
  return result;
}

// **************************
// 挑戦者アプリのレコード更新
// **************************
async function updateGyozaQuizChallengerRecord(event, quiz_record, update_id, params_obj) {
  let new_obj = {
    value: {
      question: {
        value: quiz_record.question.value
      },
      answer: {
        value: quiz_record.answer.value
      }
    }
  };

  params_obj.push(new_obj);

  let params = {
    table: {
      value: params_obj
    }
  };

  const result = await kintone_user_client.record.updateRecord({
    app: kintoneGyozaUserAppId,
    id: update_id,
    record: params
  });
  return result;
}

// **************************
// 挑戦者アプリのレコード更新
// **************************
async function updateChallengerStatus(update_id, params, update_point) {
  const result = await kintone_user_client.record.updateRecord({
    app: kintoneGyozaUserAppId,
    id: update_id,
    record: {
      point: {
        value: update_point
      }, 
      table: {
        value: params
      }
    }
  });
  return result;
}

// **************************
// 問題の回答を受信した場合に実行する関数
// **************************
async function postbackFunc(event) {
  const max = 10;
  let msg;
  let next_message;
  let status;
  let params_obj = [];
  let table_id;
  let get_point;

	switch (event.postback.data) {
    case ('正解'):
      msg = { type: 'text', text: '正解です' };
      status = '正解';
      get_point = 1;
      break;
    case ('-'):
      msg = { type: 'text', text: '不正解です' };
      status = '-';
      get_point = 0;
      break;
  }

  const current_user_data = await kintone_user_client.record.getRecords({
    app: kintoneGyozaUserAppId,
    query: `user_id="${event.source.userId}" order by $id desc limit 1`,
  });

  current_user_data.records[0].table.value.forEach((element, ind) => {
    if (ind === current_user_data.records[0].table.value.length -1) {
      table_id = {
        id: element.id,
        value: {
          answer_status: {
            value: status
          }
        }
      };
    } else {
      table_id = {
        id: element.id
      };
    }
    params_obj.push(table_id);
  });
  
  // ログインユーザーの回答ステータスを更新する
  let update_point = Number(current_user_data.records[0].point.value) + get_point;
  const update_current_user_data = await updateChallengerStatus(current_user_data.records[0].$id.value, params_obj, update_point);
  console.log(update_current_user_data);

  // 10問解き終わっていたらメッセージを返す
  if (current_user_data.records[0].table.value.length === max) {
    const getRankMessage = await getGyozaRankMessage(current_user_data.records[0]);
    next_message = { type: 'text', text: getRankMessage.record.message.value };
  } else {
    next_message = await getGyozaQuizFunc(event);
  }
  return [msg, next_message];
}



// **************************
// 餃子問題を取得する関数
// **************************
async function getGyozaQuizFunc(event) {
  const min = 1;
  const max = 10;

  // ランダムで1問取得
  const result = await kintone_client.record.getRecord({
    app: kintoneGyozaQuizAppId,
    id: Math.floor(Math.random() * (max + 1 - min)) + min
  });

  const current_user_data = await kintone_user_client.record.getRecords({
    app: kintoneGyozaUserAppId,
    query: `user_id="${event.source.userId}" order by $id desc limit 1`,
  });

  // ログインしているユーザーのクイズ数を確認
  // 最新のレコードが0,10問の時は新規レコード,10問以内は更新
  console.log(current_user_data.records);
  console.log(current_user_data.records.レコード番号.value);
  if (current_user_data.records.length === 0 || current_user_data.records[0].length === 0 || current_user_data.records[0].table.value.length === max) {
    const postUser = await postGyozaQuizChallengerRecord(event, result.record);
  } else {
    let params_obj = [];
    current_user_data.records[0].table.value.forEach(element => {
      let table_id = {
        id: element.id
      };
      params_obj.push(table_id);
    });
    const postUser = await updateGyozaQuizChallengerRecord(event, result.record, current_user_data.records[0].$id.value,  params_obj);
  }

  const correct_arry = [];
  const correct_radio = result.record.answer.value;
  result.record.table.value.forEach(sub_table => {
    let val = (correct_radio === sub_table.value.select_radio.value) ? '正解' : '-';
    correct_arry.push(val);
  });

  let message = {
      type: "flex",
      altText: "解答を表示",
      contents: {
        "type": "bubble",
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            {
              "type": "text",
              "text": "問題",
              "weight": "bold",
              "size": "xl"
            },
            {
              "type": "text",
              "text": result.record.question.value,
              "size": "md",
              "wrap": true
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "A:" + result.record.table.value[0].value.select_answer.value,
                "data": correct_arry[0]
              },
              "height": "sm",
              "margin": "sm",
              "style": "primary",
              "color": "#87ceeb"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "B:" + result.record.table.value[1].value.select_answer.value,
                "data": correct_arry[1]
              },
              "height": "sm",
              "margin": "sm",
              "style": "primary",
              "color": "#87ceeb"
            },
            {
              "type": "button",
              "action": {
                "type": "postback",
                "label": "C:" + result.record.table.value[2].value.select_answer.value,
                "data": correct_arry[2]
              },
              "height": "sm",
              "margin": "sm",
              "style": "primary",
              "color": "#87ceeb"
            }
          ]
        }
      }
    }
  return message;
}

// **************************
// メッセージのテキストを判断して返信内容を変更する
// **************************
async function messageTextFunc(event) {
  let message;
  switch (event.message.text) {
    case ('餃子検定を受験する'):
      message = await getGyozaQuizFunc(event);
      break;

    case ('結果をシェアする'):
      console.log('結果をシェアする');
      message = { type: 'text', text: '作成中です。暫しお待ちください。' };
      break;
    case ('おすすめの餃子'):
      console.log('おすすめの餃子');
      message = { type: 'text', text: 'おすすめのお店を紹介します！' + conf.gyoza_stores[Math.floor(Math.random() * conf.gyoza_stores.length)] };
      break;
    case ('問題をつくる'):
      console.log('問題をつくる');
      break;
    case ('問い合わせ'):
      console.log('問合せ');
      message = { type: 'text', text: '作成中です。暫しお待ちください。' };
      break;
    default:
      console.log(event);
      message = { type: 'text', text: event.message.text };
      break;
  }
  return message;
}

// **************************
// メッセージの内容毎に返信を変える
// **************************
async function messageFunc(event) {
	let message;
	switch (event.message.type) {
		case 'text':
      message = await messageTextFunc(event);
			break;
		case 'image':
		case 'sticker':
      message = { 
        type: 'sticker',
        packageId: conf.package_id,
        stickerId: conf.stickers[Math.floor(Math.random() * conf.stickers.length)]
      };
			break;
	}
	return message;
}

module.exports = {messageFunc, postbackFunc};