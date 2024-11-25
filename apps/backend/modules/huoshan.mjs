

import {HuoshanTTS,HuoshanClient} from 'huoshan-audio'
async function convertTextToSpeech({ text }) {
   const time = Date.now();
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

    const resp = await tts.tts(text)
    console.log(`[HUOSHAN] Converted text to speech in ${Date.now() - time}ms`)
    return resp
}

/**
 * 批量处理，带有口型数据
 * @param {*} messages 
 */
export async function* batchConvertTextToSpeech({messages}) {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    try { 
      const { data,addition:{frontend:{phonemes}} } = await convertTextToSpeech({ text: message.text });
      const mouthCues = phonemes.map(z => ({
        start: z.start_time,
        end: z.end_time,
        value: z.phone
      }));
      //转base64
      const audio = Buffer.from(data).toString('base64');
      yield {...message,lipsync:{mouthCues} , audio}
    } catch (error) {
      console.error(`Error while processing message ${index}:`, error);
      yield { ...message, error: true, errorMessage: error.message };
    }
  }

}
  
export {convertTextToSpeech}