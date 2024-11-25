import { z } from "zod";
import { ConversationSummaryMemory } from "langchain/memory";
import { LLMChain } from "langchain/chains";

import { ChatOpenAI } from "@langchain/openai";
import {  PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import dotenv from 'dotenv'
dotenv.config()
const PROMPT = `
You are an AI assistant named 'Jaker'. 
Please note the following rules:
1.Respond in conversational Chinese.
2.Respond in JSON format adhering to the following schema:
{format_instructions}
--
Examples:
{example}
--
Current conversation:
{chat_history}
Human: {input}
AI:`
;
const EXAMPLE = `{
messages:[
{
"text": "你好，我是Jack，你的助手。",
"facialExpression": "default",
"animation": "Idle"
}
]
}`

const model = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY || "-",
    modelName: process.env.OPENAI_MODEL || "davinci",
    temperature: 0.2,
  }, {
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



export class Bot {
  constructor() {
    this.memory = new ConversationSummaryMemory({
      memoryKey: 'chat_history', // 记忆变量的键名
      llm: model, // 语言模型
      inputKey: 'input', 
    });

    // 创建一个新的链，包含记忆组件
    this.openAIChainWithMemory = new LLMChain({
      llm: model, // 替换为你的 OpenAI API 密钥和模型
      prompt: new PromptTemplate({
        template: PROMPT,
        inputVariables: ['chat_history', 'input','example', 'format_instructions'],
      }),
      outputParser,
    });
  }
  /**
   * 
   * @param {string} question 
   * @returns 
   */
  async chat(question) {
    const {chat_history}  = await this.memory.loadMemoryVariables({}) ; // 加载记忆变量
    const result = await this.openAIChainWithMemory.invoke({
        format_instructions:outputParser.formatInstructions,
        example:EXAMPLE,
        input: question,
        chat_history
    });
    const text = result.text.messages.map((m) => m.text).join("\n");
    this.memory.saveContext({input:question},{output:text})
    return result.text.messages; // 返回结果
  }
}
