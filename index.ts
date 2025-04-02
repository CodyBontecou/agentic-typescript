import OpenAI from 'openai'
import type {
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from 'openai/resources'
import { callFunction } from './utils/callFunction'
import { readFileContent } from './utils/readFileContent'

const fileContent = readFileContent('tests/add.spec.ts')
const openai = new OpenAI()
const model = 'gpt-4o-mini'
const messages: ChatCompletionMessageParam[] = [
    {
        role: 'system',
        content: `
            You are a professional software developer that relies on well-tested code.

            Once you've written the test, you should:
            - Use the writeFileContent tool to write the function to a file
            - Use the runTests tool to ensure the newly created function passes the tests.
            - Use the readFileContent tool read file content and adjust
        `,
    },
    {
        role: 'user',
        content:
            fileContent +
            `
              Write Typescript functions that passes all of the tests.
              Only return executable Typescript code.
              Do not return Markdown output.
              Do not wrap code in triple backticks.
              Do not return YAML.
            `,
    },
]
const tools: ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'writeFileContent',
            description: 'Writes content to a file at the specified path.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string' },
                    content: { type: 'string' },
                },
                required: ['filePath', 'content'],
                additionalProperties: false,
            },
            strict: true,
        },
    },
    {
        type: 'function',
        function: {
            name: 'readFileContent',
            description: 'Read content of a file at the specified path.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string' },
                },
                required: ['filePath'],
                additionalProperties: false,
            },
            strict: true,
        },
    },
    {
        type: 'function',
        function: {
            name: 'runTests',
            description:
                'Runs tests, returning if the tests passed and the stdout.',
        },
    },
]

let testPassed = false
while (!testPassed) {
    const completion = await openai.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'required',
    })

    const message = completion.choices[0].message
    messages.push(message)

    if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
            try {
                const args = JSON.parse(toolCall.function.arguments)
                console.log(
                    `Calling ${toolCall.function.name} with ${JSON.stringify(
                        args
                    )}`
                )
                const result = await callFunction(toolCall.function.name, args)
                const newMessage: ChatCompletionMessageParam = {
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: result,
                }

                // Explicit check on `runTests` to extract passed and testOutput from result
                if (toolCall.function.name === 'runTests') {
                    const { passed, testOutput } = JSON.parse(result)

                    testPassed = passed
                    newMessage.content = testOutput
                }

                messages.push(newMessage)
            } catch (error) {
                console.log('error: ', error)
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(error),
                })
            }
        }
    }

    if (testPassed) break

    if (!testPassed) {
        messages.push({
            role: 'user',
            content:
                'The tests are failing. Please fix your implementation and try again.',
        })
    }
}
