import { gzipSync } from 'zlib';

export interface AudioConfig {
  /**
   * 	raw / wav / mp3 / ogg
   */
  format: string;
  rate: number;
  bits: number;
  /**
   * raw / opus，默认为 raw(pcm) 。
   */
  codec?: string;
  channel: number;
  language?: string;
}
export interface ErrorResponse {
  reqid: string;
  message: string;
  code: number;
  backend_code: number;
}
export interface ASRRequest {
  app: {
    appid: string;
    token: string;
    cluster: string;
  };
  user: {
    uid: string;
    device?: string;
    platform?: string;
    network?: string;
    nation?: string;
    province?: string;
    city?: string;
  };
  audio: AudioConfig;
  request: {
    reqid: string;
    workflow: string;
    sequence: number;
    nbest?: number;
    show_utterances?: boolean;
    result_type?: string;
  };
}
export type TTSRequestAudio = {
  /**
   * 	，复刻音色使用声音ID(speaker id)
   * @default BV001_streaming

   * @link  [发音人参数列表](https://www.volcengine.com/docs/6561/97465)
   */
  voice_type: string;
  /**
   * 默认为 24000，可选8000，16000
   */
  rate?: number;
  /**
     * wav / pcm / ogg_opus / mp3，默认为 pcm
        注意：wav 不支持流式
     */
  encoding?: 'mp3' | 'wav' | 'pcm' | 'ogg_opus';
  /**
   * opus格式时编码压缩比	 [1, 20]，默认为 1
   */
  compression_rate?: number;
  /**
   * [0.2,3]，默认为1，通常保留一位小数即可
   */
  speed_ratio?: number;
  /**
   * 音量0.1, 3]，默认为1，通常保留一位小数即可
   */
  volume_ratio?: number;
  /**
   * 音高
   * [0.1, 3]，默认为1，通常保留一位小数即可
   */
  pitch_ratio?: number;
  /**
   * 情感/风格
   * @default "customer_service"
   * @link  (发音人参数列表)[https://www.volcengine.com/docs/6561/97465]
   */
  emotion?: string;
  language?: string;
};

export interface TTSRequest {
  app: {
    /** 应用标识, 申请见控制台使用FAQ */
    appid: string;
    /** 应用令牌, 可传入任意非空值 */
    token: string;
    /** 业务集群, 见控制台使用FAQ */
    cluster: string;
  };
  user: {
    /** 用户标识, 可传入任意非空值, 传入值可以通过服务端日志追溯 */
    uid: string;
  };
  audio: TTSRequestAudio;
  request: {
    /** 请求标识, 需要保证每次调用传入值唯一, 建议使用 UUID */
    reqid: string;
    /** 合成语音的文本, 长度限制 1024 字节（UTF-8编码） */
    text: string;
    /** 文本类型, plain / ssml, 默认为 plain */
    text_type?: 'plain' | 'ssml';
    /** 句尾静音时长, 单位为ms, 默认为125 */
    silence_duration?: number;
    /** 操作, query（非流式，http只能query） / submit（流式） */
    operation: 'query' | 'submit';
    /** 时间戳相关, 1 代表启用, 0 代表禁用 */
    with_frontend?: string;
    /** 时间戳相关, unitTson 代表音素级时间戳 */
    frontend_type?: string;
    /** 时间戳相关, 1 代表启用, 0 代表禁用 */
    with_timestamp?: string;
    /** 复刻音色语速优化, 1 代表启用, 0 代表禁用 */
    split_sentence?: string;
    /** 英文前端优化, 1 代表启用, 0 代表禁用 */
    pure_english_opt?: string;
  };
}
export interface ASRResponse {
  reqid: string;
  code: number;
  message: string;
  sequence: number;
  result?: Array<{
    text: string;
    utterances?: Array<{
      text: string;
      start_time: number;
      end_time: number;
      definite?: boolean;
    }>;
  }>;
}
// WebSocket message types
export enum MessageType {
  FULL_CLIENT_REQUEST = 0x1,
  AUDIO_ONLY_REQUEST = 0x2,
  FULL_SERVER_RESPONSE = 0x9,
  // b1011
  AUDIO_ONLY_RESPONSE = 0xb,
  ERROR_RESPONSE = 0xf,
}
// Message flags
enum MessageFlags {
  NONE = 0x0,
  LAST_AUDIO_PACKET = 0x2,
}
// Serialization methods
enum SerializationMethod {
  NONE = 0x0,
  JSON = 0x1,
}
// Compression methods
export enum CompressionMethod {
  NONE = 0x0,
  GZIP = 0x1,
}
export type ContentData<T = any> = {
  raw: Header;
} & (
  | { type: 'json'; data: T }
  | { type: 'error'; code: number; error: ErrorResponse }
  | {
      type: 'audio';
      payload: Buffer;
    }
);
// 定义 Header 的数据结构
export interface Header {
  protocolVersion: number; // 协议版本
  headerSize: number; // 头部大小
  messageType: MessageType; // 消息类型
  messageTypeFlags: MessageFlags | number; // 消息类型特定标志
  messageSerializationMethod: number; // 消息序列化方法
  messageCompression: CompressionMethod; // 消息压缩方式
  reserved: number; // 保留字段
  optionalHeaderExtensions?: Buffer; // 可选扩展头部
  payload?: Buffer; // 消息负载
}
export class HuoshanPayload {
  private static readonly PROTOCOL_VERSION = 0x1;
  private static readonly HEADER_SIZE = 0x1;
  private static readonly RESERVED_BYTE = 0x0;

  /**
   * Creates a WebSocket message with the specified parameters according to Huoshan's binary protocol.
   *
   * @param messageType - Type of message (e.g., full client request, audio only request)
   * @param flags - Message flags (e.g., last audio packet)
   * @param serializationMethod - Method used for payload serialization
   * @param compressionMethod - Method used for payload compression
   * @param payload - The actual payload data
   * @returns Buffer containing the complete message
   */
  public static createMessage(
    messageType: MessageType,
    flags: MessageFlags,
    serializationMethod: SerializationMethod,
    compressionMethod: CompressionMethod,
    payload: Buffer
  ): Buffer {
    // Create header (4 bytes)
    const header = Buffer.alloc(4);

    // Byte 0: Protocol version (4 bits) | Header size (4 bits)
    header[0] = (this.PROTOCOL_VERSION << 4) | this.HEADER_SIZE;

    // Byte 1: Message type (4 bits) | Message flags (4 bits)
    header[1] = (messageType << 4) | flags;

    // Byte 2: Serialization method (4 bits) | Compression method (4 bits)
    header[2] = (serializationMethod << 4) | compressionMethod;

    // Byte 3: Reserved
    header[3] = this.RESERVED_BYTE;

    // Create payload size (4 bytes, big endian)
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32BE(payload.length, 0);

    // Combine all parts: header + size + payload
    return Buffer.concat([header, sizeBuffer, payload]);
  }

  /**
   * Parses a received WebSocket message according to Huoshan's binary protocol.
   *
   * @param data - The received binary data
   * @returns Parsed message information
   */
  public static parseMessage(data: Buffer): Header {
    // 检查 buffer 长度是否足够
    if (data.length < 4) {
      throw new Error('Buffer length is too short to contain a valid header.');
    }
    // 解析各字段
    const protocolVersion = (data[0] & 0b11110000) >> 4; // 前 4 位
    const headerSize = data[0] & 0b00001111; // 后 4 位

    const messageType = (data[1] & 0b11110000) >> 4; // 前 4 位
    const messageTypeFlags = data[1] & 0b00001111; // 后 4 位
    const messageSerializationMethod = (data[2] & 0b11110000) >> 4; // 前 4 位
    const messageCompression = data[2] & 0b00001111; // 后 4 位

    const reserved = data[3]; // 保留字段

    // 解析可选扩展头部和负载（根据 headerSize 动态确定）
    let optionalHeaderExtensions: Buffer | undefined;
    let payload: Buffer | undefined;

    if (headerSize > 4) {
      const optionalHeaderSize = headerSize - 4;
      optionalHeaderExtensions = data.subarray(4, 4 + optionalHeaderSize);
      payload = data.subarray(4 + optionalHeaderSize);
    } else {
      payload = data.subarray(4);
    }
    return {
      protocolVersion,
      headerSize,
      messageType,
      messageTypeFlags,
      messageSerializationMethod,
      messageCompression,
      reserved,
      optionalHeaderExtensions,
      payload,
    };
  }

  /**
   * Creates a full client request message
   *
   * @param payload - JSON payload
   * @param compressed - Whether the payload is already compressed
   * @returns Buffer containing the complete message
   */
  public static createFullClientRequest(payload: Buffer, compressed: boolean = false): Buffer {
    return this.createMessage(
      MessageType.FULL_CLIENT_REQUEST,
      MessageFlags.NONE,
      SerializationMethod.JSON,
      compressed ? CompressionMethod.GZIP : CompressionMethod.NONE,
      payload
    );
  }
  /**
   * 创建消息体
   * @param json - JSON 字符串
   * @param shouldCompress - 是否需要压缩，默认为 false
   * @returns 包含完整消息的 Buffer
   */
  public static createBody(json: string, shouldCompress: boolean = false): Buffer {
    const payload = shouldCompress ? gzipSync(Buffer.from(json)) : Buffer.from(json);
    return this.createMessage(
      MessageType.FULL_CLIENT_REQUEST,
      MessageFlags.NONE,
      SerializationMethod.JSON,
      shouldCompress ? CompressionMethod.GZIP : CompressionMethod.NONE,
      payload
    );
  }

  /**
   * 创建音频请求消息
   *
   * @param audioData - 音频数据缓冲区
   * @param isLastPacket - 是否为最后一个音频数据包
   * @param shouldCompress - 是否需要压缩音频数据
   * @returns 包含完整消息的 Buffer
   */
  public static createAudioRequest(
    audioData: Buffer,
    isLastPacket: boolean = false,
    shouldCompress: boolean = false
  ): Buffer {
    const processedAudioData = shouldCompress ? gzipSync(audioData) : audioData;
    return this.createMessage(
      MessageType.AUDIO_ONLY_REQUEST,
      isLastPacket ? MessageFlags.LAST_AUDIO_PACKET : MessageFlags.NONE,
      SerializationMethod.NONE,
      shouldCompress ? CompressionMethod.GZIP : CompressionMethod.NONE,
      processedAudioData
    );
  }
}
