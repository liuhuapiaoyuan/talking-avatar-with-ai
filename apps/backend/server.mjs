import cors from "cors";
import express from "express";
import { invokeLLM } from "./modules/openAI.mjs";
import { sendDefaultMessages } from "./modules/defaultMessages.mjs";
import http from "http";
import { server as WebSocketServer } from 'websocket';
import { HuoshanASR, HuoshanClient } from 'huoshan-audio'
import { batchConvertTextToSpeech } from "./modules/huoshan.mjs";



const app = express();
app.use(express.json());
app.use(cors());


app.post("/tts", async (req, res) => {
  const userMessage = await req.body.message;
  const defaultMessages = await sendDefaultMessages({ userMessage });
  if (defaultMessages) {
    res.send({ messages: defaultMessages });
    return;
  }
  let openAImessages = await invokeLLM(userMessage)
  const messages = []
  const generator = batchConvertTextToSpeech({ messages: openAImessages.messages })
  for await (const message of generator) {
    messages.push(message)
  }
  res.send({ messages: messages });
});

// app.post("/sts", async (req, res) => {
//   const base64Audio = req.body.audio;
//   const audioData = Buffer.from(base64Audio, "base64");
//   const userMessage = await convertAudioToText({ audioData });
//   let openAImessages;
//   try {
//     openAImessages = await openAIChain.invoke({
//       question: userMessage,
//       format_instructions: parser.getFormatInstructions(),
//     });
//   } catch (error) { 
//     openAImessages = {messages:defaultResponse};
//   }
//   openAImessages = await lipSync({ messages: openAImessages.messages });
//   res.send({ messages: openAImessages });
// });

// app.listen(port, () => {
//   console.log(`Jack are listening on port ${port}`);
// });

const server = http.createServer(app);
// 创建 WebSocket 服务器
const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
});

wsServer.on('request', async request => {
  const connection = request.accept(null, request.origin);
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
    let openAImessages = await invokeLLM(question)
    const generator = batchConvertTextToSpeech({ messages: openAImessages.messages })
    for await (const message of generator) {
      connection.send(JSON.stringify({
        action: 'gpt:chunk',
        text: message
      }))
    }
    connection.send(JSON.stringify({
      action: 'gpt:end',
    }))
    // openAImessages = await lipSync({ messages: openAImessages.messages });
    // connection.send(JSON.stringify({
    //   action: 'gpt:end',
    //   messages: openAImessages
    // }))
  }
  function createTimmer() {
    if (!timmer) {
      timmer = setTimeout(() => {
        stopAsr()
        timmer = null
      }, 5000) 
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
      createTimmer()
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
          // 启动定时器
          createTimmer()
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