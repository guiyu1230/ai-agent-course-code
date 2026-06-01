import dotenv from 'dotenv';
import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';

dotenv.config();

if (!globalThis.ReadableStream) globalThis.ReadableStream = ReadableStream;
if (!globalThis.WritableStream) globalThis.WritableStream = WritableStream;
if (!globalThis.TransformStream) globalThis.TransformStream = TransformStream;

const { ChatOpenAI } = await import('@langchain/openai');

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME || 'qwen-coder-turbo',
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  maxTokens: 16384,
  chatTemplateKwargs: {
    enableThinking: false,
    clearThinking: false,
  },
});

const response = await model.invoke('介绍下自己');
console.log(response.content);