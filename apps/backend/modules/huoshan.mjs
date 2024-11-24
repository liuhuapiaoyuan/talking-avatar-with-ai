

import {HuoshanTTS,HuoshanClient} from 'huoshan-audio'
import fs from 'fs'
async function convertTextToSpeech({ text, fileName }) {
    let ttsOption = {};
    if (process.env.TTS_HUOSHAN_CONFIG) {
      try {
        ttsOption = JSON.parse(process.env.TTS_HUOSHAN_CONFIG);
      } catch (_error) {}
    }
    const tts = new HuoshanTTS(
        new HuoshanClient({
          appid: process.env.TTS_HUOSHAN_APPID,
          token: process.env.TTS_HUOSHAN_TOKEN,
          cluster: process.env.TTS_HUOSHAN_CLUSTER,
          uid: process.env.TTS_HUOSHAN_UID,
        }),
        {
          ...ttsOption,
          encoding:"mp3"
        }
      );

    const blob = await  tts.synthesize(text);
    // 保存到fileName
    fs.writeFileSync(fileName, blob);

}
  
export {convertTextToSpeech}