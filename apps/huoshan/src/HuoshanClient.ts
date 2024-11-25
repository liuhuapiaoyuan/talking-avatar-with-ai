import WebSocket from 'ws'
import { EventEmitter } from 'events'
import {
  CompressionMethod,
  type ContentData,
  type ErrorResponse,
  type Header,
  HuoshanPayload,
  MessageType,
} from './HuoshanType'
import { gunzipSync } from 'zlib'

export interface HuoshanClientConfig {
  token: string
  appid: string
  cluster?: string
  uid?: string
}

export class HuoshanClient extends EventEmitter {
  private ws: WebSocket | null = null
  private config: HuoshanClientConfig
  private isConnected: boolean = false

  constructor(config: HuoshanClientConfig) {
    super()
    this.config = config
    this.setMaxListeners(100)
  }

  getConfig() {
    return this.config
  }

  onMessage(callback: (data: ContentData) => void) {
    this.on('message', callback)
  }
  onceMessage(callback: (data: ContentData) => void) {
    this.once('message', callback)
  }
  offMessage(callback: (data: ContentData) => void) {
    this.off('message', callback)
  }

  private getContent(parsedMessage: Header): ContentData {
    if (!parsedMessage.payload) {
      throw new Error('Failed to parse message')
    }
    if (parsedMessage.messageType === MessageType.ERROR_RESPONSE) {
      const errorCode = parsedMessage.payload.readUInt32BE(0)
      const errorLength = parsedMessage.payload.readUInt32BE(4)
      const payload = parsedMessage.payload.subarray(8, 8 + errorLength)
      // buffer转ArrayBuffer

      const arrayBuffer = payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength,
      ) as ArrayBuffer
      const rawContent =
        parsedMessage.messageCompression === CompressionMethod.GZIP
          ? gunzipSync(arrayBuffer).toString()
          : payload.toString('utf-8')
      return {
        raw: parsedMessage,
        type: 'error',
        code: errorCode,
        error: JSON.parse(rawContent) as ErrorResponse,
      }
    }

    if (parsedMessage.messageType === MessageType.FULL_SERVER_RESPONSE) {
      const payloadSize = parsedMessage.payload.readUInt32BE(0)
      const payload = parsedMessage.payload.subarray(4, 4 + payloadSize)
      const arrayBuffer = payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength,
      ) as ArrayBuffer
      const rawContent =
        parsedMessage.messageCompression === CompressionMethod.GZIP
          ? gunzipSync(arrayBuffer).toString()
          : payload.toString('utf-8')
      return {
        raw: parsedMessage,
        type: 'json',
        data: JSON.parse(rawContent),
      }
    }

    if (parsedMessage.messageType === MessageType.AUDIO_ONLY_RESPONSE) {
      return {
        raw: parsedMessage,
        type: 'audio',
        payload: parsedMessage.payload,
      }
    }
    throw new Error('Failed to parse message')
  }

  public async connect(endpoint: string): Promise<void> {
    const headers = {
      Authorization: 'Bearer;' + this.config.token,
    }
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(endpoint, { headers })
      this.ws.on('open', () => {
        this.isConnected = true
        resolve()
      })

      this.ws.on('error', reject)

      this.ws.on('message', (data: Buffer) => {
        const parsedMessage = HuoshanPayload.parseMessage(data)
        const content = this.getContent(parsedMessage)
        this.emit('message', content)
      })

      this.ws.on('close', () => {
        this.isConnected = false
        this.emit('close')
      })
    })
  }

  public async send(data: Buffer): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket is not connected')
    }

    return new Promise((resolve, reject) => {
      this.ws!.send(data, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  //https://openspeech.bytedance.com/api/v1/tts
  public async http(url:string,data?:Record<string,any>){
    const link = `https://openspeech.bytedance.com/api${url}`
    return fetch(link,{
      method: 'POST',
      headers: {
        'Authorization': 'Bearer;' + this.config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  }

  /**
   * 发送json包
   * @param json
   * @returns
   */
  public async sendJSON(json: string): Promise<void> {
    const data = HuoshanPayload.createBody(json, true)
    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket is not connected')
    }
    return this.send(data)
  }

  public async close(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      // 情况所有callback
      this.removeAllListeners()
    }
    this.isConnected = false
  }

  public isActive(): boolean {
    return this.isConnected
  }
}
