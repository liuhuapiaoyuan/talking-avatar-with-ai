import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AudioPlayerQueue } from "../lib/AudioPlayerQueue";

const backendUrl = "/api";
// const backendUrl = "http://localhost:3000";
function float32ToInt16(float32Array) {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}
const SpeechContext = createContext();
let retryCount = 0
const MAX_RETRY_COUNT = 2

async function connectWebSocket(onclose) {
  await fetch(`${backendUrl}/`)
  // 获得当前请求
  const currentUrl = new URL(window.location.href);
  const wsurl = `${currentUrl.protocol === 'https:' ? 'wss' : 'ws'}://${currentUrl.host}${backendUrl}/ws`;
  console.log("Connecting to WebSocket:", wsurl);
  const ws = new WebSocket(wsurl);
  return new Promise((resolve,reject) => {
    ws.onopen = () => {
      retryCount = 0
      resolve(ws);
    };
    ws.onclose = e=>{
      onclose?.()
      retryCount+=1 
    }
    ws.onerror = (error) => {
       
      reject(error);
    }
  }
  );
}

async function* loadSSE(readableStream) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = ''; // 用于缓存未处理的数据

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // 处理剩余的缓存数据
      if (buffer) {
        yield buffer;
      }
      return;
    }

    let chunk = decoder.decode(value, { stream: true });
    buffer += chunk; // 将新数据块拼接到缓存中

    // 处理缓存中的数据，直到遇到 \n\n
    let parts = buffer.split('\n\n');
    buffer = parts.pop(); // 保留最后一个不完整的块

    for (const part of parts) {
      yield part;
    }
  }
}
export const SpeechProvider = ({ children }) => {
  const audioRef = useRef()
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(new AudioContext({ sampleRate: 16000 }));
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();
  const [loading, setLoading] = useState(false);
  const [asrText,setAsrText] = useState("")
  const ws =  useRef(null)
  const connect = useCallback(()=>{

    let audioContext
    return connectWebSocket(()=>{
      
      ws.current = null
      if( retryCount<=MAX_RETRY_COUNT &&   confirm("掉线了，是否重连")){
        connect()
      }else{
        retryCount = MAX_RETRY_COUNT
      }

    }).then(_ws=>{
      ws.current = _ws
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === "asr:start") {
          setRecording(true)
          navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(async stream => {
             audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(1024 * 4, 1, 1);
            source.connect(processor);
            processor.connect(audioContext.destination);
            processor.onaudioprocess = e => {
              
              const inputData = e.inputBuffer.getChannelData(0);
              const outputData = new Float32Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                outputData[i] = inputData[i];
              }
              const int16Array = float32ToInt16(outputData);
              ws.current.send(int16Array.buffer);
            
            };
            setMediaRecorder(audioContext)
          })
          .catch(err => {
            console.error('录音失败: ', err);
            setRecording(false);
            audioContext.close()
          });
        }
        if (data.action === "asr:end") {
          setRecording(false)
          audioContext.close().catch(()=>{})
        }
        if (data.action === "asr:text") {

          setAsrText(data.text)
        }  else if (data.action === "gpt:start") {
          audioContext.close().catch(()=>{})
          setRecording(false)
          setLoading(true)
        } else if (data.action === "gpt:end") {
          
          setLoading(false)
        } else if (data.action === "gpt:chunk") {
          setMessages((messages) => [...messages, data.text]);
        }
      };
    })
  
  },[])
  useEffect(() => {
    if (!ws.current) {
      connect()
    }
  }, []);

  const startRecording = async() => {
    // 获得连接状态
    if(!ws.current){
      if(confirm("掉线了，是否重连")){
        await connect()
      }else{
        return 
      }
    }
    setAsrText("")
    if(!ws.current){
      return 
    }
   ws.current.send(JSON.stringify({ action: "start" }));
   
  };

  const stopRecording = async () => {
    if (mediaRecorder) {
      mediaRecorder.close()
      await ws.current.send(JSON.stringify({ action: "stop" }));
    }
  };

  const tts = async (message) => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      // const response = (await data.json()).messages;
      // setMessages((messages) => [...messages, ...response]);
          // 使用生成器函数读取 SSE 数据
        let newMessage={}
      for await (const item of loadSSE(response.body)) {
        let chunk = item.slice("data: ".length).trim();
        if (chunk.startsWith("body: ")) {
          newMessage = JSON.parse(chunk.slice("body: ".length).trim());
        }else if(chunk.startsWith("lipsync: ")){
          newMessage.lipsync = JSON.parse(chunk.slice("lipsync: ".length).trim());
        }else if(chunk.startsWith("audio: ")){
          newMessage.audio = chunk.slice("audio: ".length).trim();
          setMessages((messages) => [...messages, newMessage]);
        }
      } 
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onMessagePlayed = () => {
    setMessages((messages) => messages.slice(1));
  };

  useEffect(() => {
    if (messages.length > 0) {
      setMessage(messages[0]);
    } else {
      setMessage(null);
    }
  }, [messages]);

  return (
    <>
        <audio ref={audioRef} style={{display:"none"}} id="audio" ></audio>
    <SpeechContext.Provider
      value={{
        audioRef,
        asrText,
        startRecording,
        stopRecording,
        recording,
        tts,
        message,
        onMessagePlayed,
        loading,
      }}
      >
      {children}
    </SpeechContext.Provider>
      </>
  );
};

export const useSpeech = () => {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error("useSpeech must be used within a SpeechProvider");
  }
  return context;
};
