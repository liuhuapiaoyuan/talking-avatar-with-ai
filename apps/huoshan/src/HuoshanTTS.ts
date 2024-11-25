import type { ContentData, TTSRequest, TTSRequestAudio } from './HuoshanType'
import { HuoshanClient } from './HuoshanClient'
import EventEmitter from 'events'
import { nanoid } from 'nanoid'

type TTSAddition = {
  frontend: {
    phonemes: Array<{
      phone: string
      start_time: number
      end_time: number
    }>
    words:Array<{
      word: string
      start_time: number
      end_time: number
      unit_type:"mark"|"text"
    }>
  }
}

export class HuoshanTTS {
  private static readonly WSS_URL =
    'wss://openspeech.bytedance.com/api/v1/tts/ws_binary'
  private client: HuoshanClient
  private emmit = new EventEmitter()
  private audioConfig: TTSRequestAudio

  constructor(client: HuoshanClient, audioConfig?: Partial<TTSRequestAudio>) {
    this.audioConfig = {
      voice_type: 'BV001_streaming',
      encoding: 'mp3',
      ...audioConfig,
    }
    this.client = client
  }
  onDone(callback: () => void): void {
    this.emmit.on('done', () => {
      callback()
    })
  }
  onAudioChunk(callback: (chunk: Buffer, isLast: boolean) => void): void {
    this.emmit.on(
      'audio',
      ({ chunk, isLast }: { chunk: Buffer; isLast: boolean }) => {
        callback(chunk, isLast)
      },
    )
  }
  onError(callback: (error: Error) => void): void {
    this.emmit.on('error', (error: Error) => {
      callback(error)
    })
  }
  setAudioConfig(audioConfig: TTSRequestAudio) {
    this.audioConfig = Object.assign(this.audioConfig, audioConfig)
  }
  private createFullClientRequest(text: string): TTSRequest {
    const config = this.client.getConfig()
    return {
      app: {
        appid: config.appid,
        token: config.token,
        cluster: config.cluster!,
      },
      user: {
        uid: config.uid!,
      },
      audio: this.audioConfig,
      request: {
        reqid: nanoid(),
        text,
        operation: 'submit',
      },
    }
  }

  public async synthesize(text: string): Promise<Buffer> {
    await this.client.connect(HuoshanTTS.WSS_URL)
    const payload = this.createFullClientRequest(text)
    await this.client.sendJSON(JSON.stringify(payload))
    return new Promise(async (resolve, reject) => {
      let buffer: Buffer = Buffer.alloc(0)
      const onMessage = (data: ContentData) => {
        const flag = data.raw.messageTypeFlags
        if (data.type == 'audio') {
          const isLast = flag == 2 || flag == 3
          buffer = Buffer.concat([buffer, data.payload])
          //buffer.length >= 4096 * 3 ||
          if (isLast) {
            this.emmit.emit('audio', { chunk: buffer, isLast })
            this.emmit.emit('done')
            this.client.close()
            this.client.offMessage(onMessage)
            resolve(buffer)
          }
        } else if (data.type === 'error') {
          this.client.offMessage(onMessage)
          this.emmit.emit('error', new Error(data.error.message))
          reject(new Error(data.error.message))
        }
      }
      this.client.onMessage(onMessage)
    })
  }

  /**
   * 同步合成语音，支持 wav格式
   * @param text 
   * @returns 
   */
  public async tts(text: string): Promise<{
    data: Buffer,
    addition:TTSAddition
  }> {
    const url = `/v1/tts` 
    const config = this.client.getConfig()

    const payload = {
        app: {
          appid: config.appid,
          token: config.token,
          cluster: config.cluster!,
        },
        user: {
          uid: config.uid!,
        },
        audio: this.audioConfig,
        request: {
            reqid: nanoid(),
            text, 
            "text_type": "plain",
            "operation": "query",
            "silence_duration": "125",
            "with_frontend": "1",
            "frontend_type": "unitTson",
            "pure_english_opt": "1"
        }
    }
    const response = await this.client.http(url, payload)
    if (response.status !== 200) {
      const me = await response.text()
      
      throw new Error(`Failed to get TTS result: ${response.status} ${me}`)
    }
    const json = await response.json() as {
      data:string , 
      message:string, 
      addition:{frontend:string}, 
    }
    if(json.message!=='Success'){
      throw new Error(`Failed to get TTS result: ${json.message}`)
    }
    // base64 转buffer
    const buffer = Buffer.from(json.data, 'base64')
    const frontend = JSON.parse(json.addition.frontend) as TTSAddition['frontend']
    return {
      data: buffer,
      addition:{frontend}
    }
  }

  public async stop(): Promise<void> {
    await this.client.close()
  }
}
