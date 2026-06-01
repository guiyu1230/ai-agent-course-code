import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
  baseURL: 'https://integrate.api.nvidia.com/v1',
})
 
async function main() {
  const completion = await openai.chat.completions.create({
    model: "z-ai/glm4.7",
    messages: [{"role":"user","content":"你好，介绍一下自己"}],
    temperature: 1,
    top_p: 1,
    max_tokens: 16384,
    chat_template_kwargs: {"enable_thinking":true,"clear_thinking":false},
    stream: true
  })
   
  for await (const chunk of completion) {
        const reasoning = chunk.choices[0]?.delta?.reasoning_content;
    if (reasoning) process.stdout.write(reasoning);
        process.stdout.write(chunk.choices[0]?.delta?.content || '')
    
  }
  
}

main();