import {
  type AudioConfig,
  HuoshanPayload,
  type ASRRequest,
  type ContentData,
  type ASRResponse,
} from './HuoshanType'
import { HuoshanClient } from './HuoshanClient'
import EventEmitter from 'events'
import { nanoid } from 'nanoid'

export class HuoshanASR {
  private audioConfig: AudioConfig
  private client: HuoshanClient
  private static readonly WSS_URL = 'wss://openspeech.bytedance.com/api/v2/asr'
  private CHUNK_DURATION_MS = 1000 * 5 // 5 second chunks
  private finalText: string = ''
  private status: 'pending' | 'processing' | 'done' = 'pending'
  private eventEmitter = new EventEmitter()
  private static readonly DEFAULT_AUDIO_CONFIG: AudioConfig = {
    format: 'raw',
    rate: 16000,
    bits: 16,
    channel: 1,
  }

  constructor(client: HuoshanClient, audioConfig?: Partial<AudioConfig>) {
    this.client = client
    this.audioConfig = {
      ...HuoshanASR.DEFAULT_AUDIO_CONFIG,
      ...audioConfig,
    }
    this.onReceive = this.onReceive.bind(this)
  }
  onClose(callback: (error?: Error) => void): void {
    this.eventEmitter.on('close', callback)
  }
  async stop(): Promise<string> {
    await this.close()
    return this.finalText
  }

  async start(): Promise<void> {
    if (this.status != 'pending') {
      throw new Error('ASR is already started')
    }
    try {
      await this.client.connect(HuoshanASR.WSS_URL)
      this.client.once('close', () => {
        this.status = 'pending'
      })

      const fullRequest = this.createFullClientRequest(1)
      const fullRequestMessage = HuoshanPayload.createBody(
        JSON.stringify(fullRequest),
        true,
      )
      await this.client.send(fullRequestMessage)
      // 监听
      this.client.onMessage(this.onReceive)
      this.status = 'processing'
    } catch (error) {
      this.status = 'pending'
      throw error
    }
  }

  private async onReceive(content: ContentData<ASRResponse>) {
    if (content.type === 'error') {
      this.eventEmitter.emit('close', new Error(content.error.message))
    }
    if (content.type === 'json') {
      const response = content.data
      if (response.result && response.result[0]) {
        this.finalText = response.result[0].text
        this.eventEmitter.emit('text', this.finalText)
      }
    }
  }

  close(): Promise<void> {
    this.client.offMessage(this.onReceive)
    this.status = 'pending'
    this.eventEmitter.emit('close', undefined)
    return this.client.close()
  }
  onText(callback: (text: string) => void): void {
    this.eventEmitter.on('text', callback)
  }

  private calculateChunkSize(): number {
    const bytesPerSample = this.audioConfig.bits / 8
    const samplesPerSecond = this.audioConfig.rate
    const channels = this.audioConfig.channel
    return Math.floor(
      (samplesPerSecond * bytesPerSample * channels * this.CHUNK_DURATION_MS) /
        1000,
    )
  }

  private async sendAudioChunk(
    chunk: Buffer,
    isLastChunk: boolean,
  ): Promise<void> {
    const audioMessage = HuoshanPayload.createAudioRequest(
      chunk,
      isLastChunk,
      true,
    )
    await this.client!.send(audioMessage)
  }

  setAudioFormat(format: string) {
    this.audioConfig.format = format
  }

  private splitAudioBuffer(buffer: Buffer): Buffer[] {
    const chunkSize = this.calculateChunkSize()
    const chunks: Buffer[] = []
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, buffer.length)
      chunks.push(buffer.subarray(i, end))
    }
    return chunks
  }

  private createFullClientRequest(sequence: number): ASRRequest {
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
        workflow: 'audio_in,resample,partition,vad,fe,decode,nlu_punctuate',
        sequence: sequence,
        show_utterances: true,
      },
    }
  }

  /**
   * 发送片段
   * @param chunk
   * @returns
   */
  async post(chunk: Buffer, last: boolean): Promise<void> {
    if (this.status !== 'processing') {
      throw new Error('ASR is not started')
    }
    try {
      const chunks = this.splitAudioBuffer(chunk)
      for (let i = 0; i < chunks.length; i++) {
        await this.sendAudioChunk(chunks[i], last && chunks.length - 1 === i)
      }
    } catch (error) {
      await this.close()
      throw error
    }
  }

  // isStarted
  isStarted(): boolean {
    return this.status === 'processing'
  }
}
