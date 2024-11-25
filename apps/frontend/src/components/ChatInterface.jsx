import { useEffect, useRef } from "react";
import { useSpeech } from "../hooks/useSpeech";
import { AudioPlayerQueue } from "../lib/AudioPlayerQueue";

export const ChatInterface = ({ hidden, ...props }) => {
  const input = useRef();
  const { tts, loading, audioRef,message, asrText,onMessagePlayed,startRecording, stopRecording, recording } = useSpeech();
  
  const first = useRef(true);

  useEffect(()=>{
    if (message) {
      // message.audio
      //const audioBlob = new Blob([message.audio], { type: 'audio/mp3' });
      //const audioUrl = URL.createObjectURL(audioBlob);
      const audioUrl = "data:audio/mp3;base64," + message.audio
      audioRef.current.src = audioUrl
      audioRef.current.play()
      audio.onended = onMessagePlayed;
    }
  },[message])
  const triggerAudio = () => {
    if (!first.current) {
      return;
    }
    first.current = false;
    const audio = audioRef.current;
    audio.play();
    setTimeout(() => {
      audio.pause();
    }, 20);
  }

  const sendMessage = () => {
    triggerAudio()
    const text = input.current.value;
    if (!loading && !message) {
      tts(text);
      input.current.value = "";
    }
  };
  if (hidden) {
    return null;
  }

  const showAsr = asrText.length > 0 ? asrText : "请说话...";
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex justify-between p-4 flex-col pointer-events-none">
      <div className="self-start backdrop-blur-md bg-white bg-opacity-50 p-4 rounded-lg">
        <h1 className="font-black text-xl text-gray-700">数字人DEMO</h1>
        <p className="text-gray-600">
          {recording  ?  (showAsr): (loading ? "思考中..." : "输入内容或者语音来跟我对话吧。")}
           
        </p>
      </div>
      <div className="w-full flex flex-col items-end justify-center gap-4"></div>
      <div className="flex items-center gap-2 pointer-events-auto max-w-screen-sm w-full mx-auto">
        <button
          onClick={()=>{
            triggerAudio()
            recording ? stopRecording() : startRecording()
          }}
          className={`bg-gray-500 hover:bg-gray-600 text-white p-4 px-4 font-semibold uppercase rounded-md ${
            recording ? "bg-red-500 hover:bg-red-600" : ""
          } ${loading || message ? "cursor-not-allowed opacity-30" : ""}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
            />
          </svg>
        </button>

        <input
          className="flex-1 placeholder:text-gray-800 placeholder:italic p-4 rounded-md bg-opacity-50 bg-white backdrop-blur-md"
          placeholder="输入一个话题"
          ref={input}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
        />
        <button
          disabled={loading || message}
          onClick={sendMessage}
          className={`bg-gray-500 w-20 hover:bg-gray-600 text-white p-4   font-semibold uppercase rounded-md ${
            loading || message ? "cursor-not-allowed opacity-30" : ""
          }`}
        >
          发送
        </button>
      </div>
    </div>
  );
};
