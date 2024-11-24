import { convertTextToSpeech } from "./huoshan.mjs";
import { getPhonemes } from "./rhubarbLipSync.mjs";
import { PromiseQueue } from "./promiseQueue.mjs";
import { readJsonTranscript, audioFileToBase64 } from "../utils/files.mjs";
import fs from "fs";
const MAX_RETRIES = 10;
const RETRY_DELAY = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const _lipSync = async ({ messages }) => {
  await Promise.all(
    messages.map(async (message, index) => {
      const fileName = `audios/message_${index}.mp3`;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await convertTextToSpeech({ text: message.text, fileName });
          await delay(RETRY_DELAY);
          break;
        } catch (error) {
          if (error.response && error.response.status === 429 && attempt < MAX_RETRIES - 1) {
            await delay(RETRY_DELAY);
          } else {
            throw error;
          }
        }8
      }
      console.log(`Message ${index} converted to speech`);
    })
  );

  await Promise.all(
    messages.map(async (message, index) => {
      const fileName = `audios/message_${index}.mp3`;

      try {
        await getPhonemes({ message: index });
        message.audio = await audioFileToBase64({ fileName });
        message.lipsync = await readJsonTranscript({ fileName: `audios/message_${index}.json` });
      } catch (error) {
        console.error(`Error while getting phonemes for message ${index}:`, error);
      }
    })
  );

  return messages;
};

const lipSync = async ({ messages }) => {

  const queue = new PromiseQueue(2);
  messages.map(async (message, index) => {
    const fileName = `audios/message_${index}.mp3`;
    await queue.enqueue(() => convertTextToSpeech({ text: message.text, fileName }));
  })
  await queue.allDone()

  await Promise.all(
    messages.map(async (message, index) => {
      const fileName = `audios/message_${index}.mp3`;
      try {
        await getPhonemes({ message: index });
        message.audio = await audioFileToBase64({ fileName });
        message.lipsync = await readJsonTranscript({ fileName: `audios/message_${index}.json` });
        // 删除
        fs.unlinkSync(fileName)
        fs.unlinkSync(`audios/message_${index}.json`)
      } catch (error) {
        console.error(`Error while getting phonemes for message ${index}:`, error);
      }
    })
  );

  return messages;
};

async function task(message,index) {
  const fileName = `audios/message_${index}.mp3`;
  try {
    await convertTextToSpeech({ text: message.text, fileName });
    await getPhonemes({ message: index , skipConvert:false });
    message.audio = await audioFileToBase64({ fileName });
    message.lipsync = await readJsonTranscript({ fileName: `audios/message_${index}.json` });
    // 删除
    fs.unlinkSync(fileName)
    fs.unlinkSync(`audios/message_${index}.json`)
    return message;
  } catch (error) {
    console.error(`Error while processing message ${index}:`, error);
    return { ...message, error: true, errorMessage: error.message };
  }
}
const lipSyncGenerator = function* ({ messages }) {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    try { 
      yield task(message,index);
    } catch (error) {
      console.error(`Error while processing message ${index}:`, error);
      yield { ...message, error: true, errorMessage: error.message };
    }
  }
};
export { lipSync,lipSyncGenerator };
