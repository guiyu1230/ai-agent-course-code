import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import fs from 'fs/promises';
import { z } from 'zod';

// 1. 声明模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME || "qwen-coder-turbo",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0, // 设置温度为0以获得更确定的输出
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  }
})

// 2. 定义读取文件工具
const readFileTool = tool(
  async ({ filePath }) => {
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`[工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`);
    return`文件内容:\n${content}`;
  },
  {
    name: 'read_file',
    description: '用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或绝对路径）。',
    schema: z.object({
      filePath: z.string().describe('要读取的文件路径'),
    }),
  }
);

const tools = [
  readFileTool,
];

// 3. 绑定工具到模型
const modelWithTools = model.bindTools(tools);

// 4. 构建对话消息
const messages = [
new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。

工作流程：
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析和解释

可用工具：
- read_file: 读取文件内容（使用此工具来获取文件内容）
`),
new HumanMessage('请读取 src/tool-file-read.mjs 文件内容并解释代码')
];

// 5. 发起对话
let response = await modelWithTools.invoke(messages);
console.log('\n[模型初始回复]');
console.log(response.content);

messages.push(response);
/**
 * "tool_calls": [
    {
      "name": "read_file",
      "args": {
        "filePath": "src/tool-file-read.mjs"
      },
      "type": "tool_call",
      "id": "call_f974678e98004168a8bb59"
    }
  ],
 */
// 6. 调用工具并处理响应
while (response.tool_calls && response.tool_calls.length > 0) {

  console.log(`\n[检测到 ${response.tool_calls.length} 个工具调用]`);

  // const toolsResult = await modelWithTools.executeToolCalls(response.tool_calls);
  // for (const toolResult of toolsResult) {
  //   messages.push(new ToolMessage({
  //     name: toolResult.toolName,
  //     content: toolResult.result,
  //   }));
  // }

  // 执行所有工具调用
  const toolResults = await Promise.all(
    response.tool_calls.map(async (toolCall) => {
      const tool = tools.find(t => t.name === toolCall.name);
      if(!tool) {
        return `错误:找不到工具 ${toolCall.name}`;
      }
      console.log(`[执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`)

      try {
        const result = await tool.invoke(toolCall.args);
        return result;
      } catch (error) {
        return `错误 ${error.message}`;
      }
    })
  );

  // 将工具结果添加到消息历史中
  response.tool_calls.forEach((toolCall, index) => {
    console.log(`[工具结果] ${toolCall.name} 返回 ${toolResults[index].slice(0, 200)}...`);
    messages.push(
      new ToolMessage({
        content: toolResults[index],
        tool_call_id: toolCall.id,
      })
    );
  });

  // 再次调用模型，传入工具结果
  response = await modelWithTools.invoke(messages);
}

console.log('\n[最终回复]');
console.log(response.content);