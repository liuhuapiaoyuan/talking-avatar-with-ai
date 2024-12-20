import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import dotenv from "dotenv";
import { defaultResponse } from "./defaultMessages.mjs";

dotenv.config();
// 总是用中文回答
const template = `
  You are Jack, a as assistant.
  You always speak in Chinese.
  You will always respond with a json array of messages, with a maximum of 3 messages:
  \n{format_instructions}.
  Each message has properties for text, facialExpression, and animation.
  The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
  The different animations are: Idle, TalkingOne, TalkingThree, SadIdle, Defeated, Angry, 
  Surprised, DismissingGesture and ThoughtfulHeadShake.
  Example message:
  {example}
`;

export const prompt = ChatPromptTemplate.fromMessages([
  ['system', template],
  ["human", "{question}"],
]);

const model = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY || "-",
  modelName: process.env.OPENAI_MODEL || "davinci",
  temperature: 0.2,
}, {
  //  baseURL:process.env.OPENAI_API_URL || "https://api.openai.com",
});

const outputParser = StructuredOutputParser.fromZodSchema(
  z.object({
    messages: z.array(
      z.object({
        text: z.string().describe("Text to be spoken by the AI"),
        facialExpression: z
          .string()
          .describe(
            "Facial expression to be used by the AI. Select from: smile, sad, angry, surprised, funnyFace, and default"
          ),
        animation: z
          .string()
          .describe(
            `Animation to be used by the AI. Select from: Idle, TalkingOne, TalkingThree, SadIdle, 
            Defeated, Angry, Surprised, DismissingGesture, and ThoughtfulHeadShake.`
          ),
      })
    ),
  })
);


const openAIChain = prompt.pipe(model).pipe(outputParser);

/**
 * @param {string} question 
 * @returns 
 */
export function invokeLLM(question) {
  return openAIChain.invoke({
    question,
    format_instructions: outputParser.getFormatInstructions(),
    example: `{
    messages:[
  {
    "text": "你好，我是Jack，你的助手。",
    "facialExpression": "default",
    "animation": "Idle"
  }
]
    }`
  }).catch(error => {
    console.log(error);
    return { messages: defaultResponse }
  })
}





export { openAIChain, outputParser as parser };
