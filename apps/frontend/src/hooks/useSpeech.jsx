import { createContext, useContext, useEffect, useRef, useState } from "react";
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



function connectWebSocket() {
  // 获得当前请求
  const currentUrl = new URL(window.location.href);
  const wsurl = `${currentUrl.protocol === 'https:' ? 'wss' : 'ws'}://${currentUrl.host}${backendUrl}/ws`;
  console.log("Connecting to WebSocket:", wsurl);
  const ws = new WebSocket(wsurl);
  return new Promise((resolve,reject) => {
    ws.onopen = () => {
      resolve(ws);
    };
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      reject(error);
    }
  }
  );
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
  let chunks = [];

  const initiateRecording = () => {
    chunks = [];
    ws.current.send(JSON.stringify({ action: "start" }));
  };

  const onDataAvailable = (e) => {
    //chunks.push(e.data);
    ws.current.send(e.data);
  };

  const sendAudioData = async (audioBlob) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async function () {
      const base64Audio = reader.result.split(",")[1];
      setLoading(true);
      try {
        const data = await fetch(`${backendUrl}/sts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ audio: base64Audio }),
        });
        const response = (await data.json()).messages;
        setMessages((messages) => [...messages, ...response]);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
  };
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      let audioContext
      connectWebSocket().then(_ws=>{
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
    }
  }, []);

  const startRecording = async() => {
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
      const data = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });
      const response = (await data.json()).messages;
      setMessages((messages) => [...messages, ...response]);
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
