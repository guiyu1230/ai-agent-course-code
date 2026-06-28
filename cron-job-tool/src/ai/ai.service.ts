import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { Runnable } from '@langchain/core/runnables';

const database = {
  users: {
    '001': { id: '001', name: '张三', email: 'zhangsan@example.com', role: 'admin' },
    '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
    '003': { id: '003', name: '王五', email: 'wangwu@example.com', role: 'user' },
  },
};

const queryUserArgsSchema = z.object({
  userId: z.string().describe('用户 ID, 例如: 001, 002, 003'),
});

// type QueryUserArgs = {
//   userId: string;
// }

// const queryUserTool = tool(
//   async ({ userId }: QueryUserArgs) => {
//     const user = database.users[userId];

//     if (!user) {
//       return `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`;
//     }

//     return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
//   },
//   {
//     name: 'query_user',
//     description: '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
//     schema: queryUserArgsSchema,
//   },
// );

@Injectable()
export class AiService {
  // const aiMessage = await this.modelWithTools.invoke(messages);
  // Runnable 的第一个类型参数是输入(messages)，第二个类型参数是输出(aiMessage)。
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

  constructor(
    @Inject('CHAT_MODEL') moel: ChatOpenAI,
    // @Inject('QUERY_USER_TOOL') private readonly queryUserTool: any,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any
  ) {
    this.modelWithTools = moel.bindTools([
      // this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool
    ]);
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手，可以在需要时调用工具（如 query_user）来查询用户信息，再用结果回答用户的问题。',
      ),
      new HumanMessage(query),
    ];

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];

      // 没有要调用的工具, 直接把回答返回给调用方
      if (!toolCalls.length) {
        console.log(aiMessage.content);
        return aiMessage.content as string;
      }

      // 依次执行本轮需要调用的所有工具 
      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name;
        console.log(`工具调用: ${toolName}, 参数: ${JSON.stringify(toolCall.args)}`);
        // if (toolName === 'query_user') {
        //   const args = queryUserArgsSchema.parse(toolCall.args);
        //   const result = await this.queryUserTool.invoke(args);

        //   messages.push(
        //     new ToolMessage({
        //       tool_call_id: toolCallId,
        //       name: toolName,
        //       content: result
        //     })
        //   )
        // } else
           if (toolName === 'send_mail') {
          const result = await this.sendMailTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result
            })
          )
        } else if (toolName === 'web_search') {
          const result = await this.webSearchTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result
            })
          )
        } else if (toolName === 'db_users_crud') {
          const result = await this.dbUsersCrudTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result
            })
          )
        }
      }
    }
  }

  async *runChainStream(query: string): AsyncIterable<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个智能助手，可以在需要时调用工具（如 query_user）来查询用户信息，再用结果回答用户的问题。',
      ),
      new HumanMessage(query),
    ];

    while (true) {
      // 一轮对话：先让模型思考并（可能）提出工具调用
      const stream = await this.modelWithTools.stream(messages);

      let fullAiMessage: AIMessageChunk | null = null;

      for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
        // 使用 concat 持续拼接，得到本轮完整的 AIMessageChunk
        fullAiMessage = fullAiMessage ? fullAiMessage.concat(chunk) : chunk;

        const hasToolCallChunk =
          !!fullAiMessage.tool_call_chunks &&
          fullAiMessage.tool_call_chunks.length > 0;

        // 我们判断如果没有 tool_call_chunks 代表不是工具调用，那就直接 yeild 返回内容
        // 只要当前论次还没出现 tool 调用的chunk，就可以把文本内容流式外推
        if (!hasToolCallChunk && chunk.content) {
          yield chunk.content as string;
        }
      }

      if (!fullAiMessage) {
        return;
      }

      messages.push(fullAiMessage);
      // 否则，就进入下面的工具调用逻辑，那部分和之前一样，concat 结束之后就是完整的 tool_calls 了。
      const toolCalls = fullAiMessage.tool_calls ?? [];

      // 没有工具调用：说明这一轮就是最终回答，已经在上面的 for-await 中流完了，可以结束
      if (!toolCalls.length) {
        return;
      }

      // 没有要调用的工具, 说明这一轮就是最终回答，已经在上面的 for-await 中流完了，可以结束
      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name;
        console.log(`工具调用: ${toolName}, 参数: ${JSON.stringify(toolCall.args)}`);
        // if (toolName === 'query_user') {
        //   const args = queryUserArgsSchema.parse(toolCall.args);
        //   const result = await this.queryUserTool.invoke(args);

        //   messages.push(
        //     new ToolMessage({
        //       tool_call_id: toolCallId,
        //       name: toolName,
        //       content: result,
        //     }),
        //   );
        // } else 
          if (toolName === 'send_mail') {
          const result = await this.sendMailTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result,
            }),
          );
        } else if (toolName === 'web_search') {
          const result = await this.webSearchTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result
            })
          )
        } else if (toolName === 'db_users_crud') {
          const result = await this.dbUsersCrudTool.invoke(toolCall.args);

          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: result
            })
          )
        }
      }
    }
  }
}
