import { audioFileToBase64, readJsonTranscript } from "../utils/files.mjs";
import dotenv from "dotenv";
dotenv.config();

const openAIApiKey = process.env.OPENAI_API_KEY;
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

async function sendDefaultMessages({ userMessage }) {
  let messages;
  if (!userMessage) {
    messages = [
      {
        text: "Hey there... How was your day?",
        audio: await audioFileToBase64({ fileName: "audios/intro_0.wav" }),
        lipsync: await readJsonTranscript({ fileName: "audios/intro_0.json" }),
        facialExpression: "smile",
        animation: "TalkingOne",
      },
      {
        text: "I'm Jack, your personal AI assistant. I'm here to help you with anything you need.",
        audio: await audioFileToBase64({ fileName: "audios/intro_1.wav" }),
        lipsync: await readJsonTranscript({ fileName: "audios/intro_1.json" }),
        facialExpression: "smile",
        animation: "TalkingTwo",
      },
    ];
    return messages;
  }
  if (!elevenLabsApiKey || !openAIApiKey) {
    messages = [
      {
        text: "Please my friend, don't forget to add your API keys!",
        audio: await audioFileToBase64({ fileName: "audios/api_0.wav" }),
        lipsync: await readJsonTranscript({ fileName: "audios/api_0.json" }),
        facialExpression: "angry",
        animation: "TalkingThree",
      },
      {
        text: "You don't want to ruin Jack with a crazy ChatGPT and ElevenLabs bill, right?",
        audio: await audioFileToBase64({ fileName: "audios/api_1.wav" }),
        lipsync: await readJsonTranscript({ fileName: "audios/api_1.json" }),
        facialExpression: "smile",
        animation: "Angry",
      },
    ];
    return messages;
  }
}

const defaultResponse = [
  {
    text: "很抱歉，我不知道你在说什么，要不您在问我一次?",
    facialExpression: "sad",
    animation: "Idle",
  },
];

export { sendDefaultMessages, defaultResponse };
