import cors from "cors";
import express from "express";
import http from "http";
import { server as WebSocketServer } from 'websocket';
import { HuoshanASR, HuoshanClient } from 'huoshan-audio'
import { batchConvertTextToSpeech } from "./modules/huoshan.mjs";
import session from 'express-session'
import { Bot } from "./modules/bot.mjs";

import dotenv from 'dotenv'
dotenv.config()

const BOT ={}

/**
 * 
 * @param {*} req 
 * @returns {Bot} bot
 */
function getBot(req){
  const bot =  BOT[req.sessionID] || new Bot()
  BOT[req.sessionID] = bot
  return bot
}



const app = express();
app.use(express.json());
app.use(cors());
const sessionStore = session({
  name: "ai-human-id",
  secret: 'your-secret-key', // 用于签名 session ID 的密钥
  resave: false, // 强制保存未修改的 session
  saveUninitialized: true, // 保存未初始化的 session
  cookie: { secure: false, maxAge: 24 * 60 * 1000 }
});
// 配置 session
app.use(sessionStore);






app.get("/", async (_req,res) => {
  res.send({code:0});
}); 


app.post("/tts", async (req, res) => {
   // 设置SSE响应头
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
  const userMessage = await req.body.message;
  const bot = getBot(req)
  const result =await  bot.chat(userMessage)
  const generator = batchConvertTextToSpeech({ messages: result })
  for await (const message of generator) {
    const {audio,lipsync,...body} = message
    res.write(`data: body: ${JSON.stringify(body)}\n\n`);
    res.write(`data: lipsync: ${JSON.stringify(lipsync)}\n\n`);
    res.write(`data: audio: ${audio}\n\n`);
  }
  res.end();
}); 



const server = http.createServer(app);
const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
});

wsServer.on('request', async request => {
  let sessionId = request.cookies.find(z=>z.name==='ai-human-id')?.value
  if(sessionId?.substring(0, 2) === 's:') {
    sessionId = sessionId.slice(2,sessionId.indexOf("."))
  }
  if(!sessionId){
    request.reject(400, 'no session id')
  }
  const connection = request.accept(null, request.origin);

  const bot = getBot({sessionID:sessionId})


  const huoshan = new HuoshanASR(new HuoshanClient({
    appid: process.env.ASR_HUOSHAN_APPID,
    token: process.env.ASR_HUOSHAN_TOKEN,
    cluster: process.env.ASR_HUOSHAN_CLUSTER,
    uid: process.env.ASR_HUOSHAN_UID,
  }))
  let timmer
  let asrText = ''
  async function stopAsr(){
    if(asrText.trim().length<1){
      huoshan.stop()
      connection.send(JSON.stringify({
        action: 'asr:end'
      }))
      return 
    }
    connection.send(JSON.stringify({ 
      action: 'gpt:start'
    }))
    const question = await huoshan.stop()
    let openAImessages = await bot.chat(question)
    const generator = batchConvertTextToSpeech({ messages: openAImessages })
    for await (const message of generator) {
      connection.send(JSON.stringify({
        action: 'gpt:chunk',
        text: message
      }))
    }
    connection.send(JSON.stringify({
      action: 'gpt:end',
    })) 
  }
  function createTimmer(delay = 5000) {
    if (!timmer) {
      timmer = setTimeout(() => {
        stopAsr()
        timmer = null
      }, delay) 
    }
  }

  huoshan.onText(text => {
    // 如果文本变化了就清理
    if(text !== asrText){
      asrText = text
      clearTimeout(timmer)
      timmer = null
      connection.send(JSON.stringify({
          action: 'asr:text',
          text: text
        }
      ))
      createTimmer(800)
    }
  })

  // 监听来自客户端的消息
  connection.on('message', async (message) => {
    try {
      if (message.type === 'utf8') {
        const data = JSON.parse(message.utf8Data);
        if (data.action == 'start') {
          asrText = ''
          await huoshan.start()
          connection.send(JSON.stringify({
            action: 'asr:start'
          }))
          // 启动定时器 首次5秒
          createTimmer(5000)
        } else if (data.action == 'stop') {
          timmer && clearTimeout(timmer)
          stopAsr()
        }
      } else if (message.type === 'binary') {
        // 接受音频消息保存 
          huoshan.post(message.binaryData).catch(()=>{

          })
      }
    } catch (error) {

    }
  });

  // 当连接关闭时触发
  connection.on('close', () => {
    console.log('Client disconnected');

  });
});

// 开始监听端口
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});