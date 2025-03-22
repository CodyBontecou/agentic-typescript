import { readFileContent } from './utils/readFileContent'

import OpenAI from 'openai'
import type {
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from 'openai/resources'
import { callFunction } from './utils/callFunction'

const content = readFileContent('tests/add.spec.ts')

const basePrompt = `
    Write a Typescript function that passes these tests.
    Only return executable Typescript code.
    Do not return Markdown output.
    Do not wrap code in triple backticks.
    Do not return YAML.
`
const prompt = basePrompt + content

const openai = new OpenAI()
const model = 'gpt-4o-mini'
const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: prompt },
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
        },
    },
    {
        type: 'function',
        function: {
            name: 'readFileContent',
            description: 'Reads content of a file at the specified path.',
            parameters: {
                type: 'object',
                properties: {
                    filePath: { type: 'string' },
                },
                required: ['filePath'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'runTests',
            description:
                'Runs tests, returning if the tests passed and the stdout.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: false,
            },
        },
    },
]

let testPassed = false
let attempt = 0
const maxAttempts = 5
let lastTestOutput = ''

while (!testPassed && attempt < maxAttempts) {
    attempt++

    if (attempt > 1 && lastTestOutput.length > 0) {
        messages.push({
            role: 'user',
            content: `The tests failed. Here's the output:\n\n${lastTestOutput}\n\nFix the issues and try again.`,
        })
    }

    const completion = await openai.chat.completions.create({
        model,
        messages,
        tools,
    })

    const message = completion.choices[0].message
    messages.push(message)

    if (message.tool_calls && message.tool_calls.length > 0) {
        const toolOutputs = await Promise.all(
            message.tool_calls.map(async toolCall => {
                const { name, arguments: args } = toolCall.function
                const parsedArgs = args ? JSON.parse(args) : {}

                // Use the callFunction helper
                const result = await callFunction(name, parsedArgs)

                // For test results, check if tests passed
                switch (name) {
                    case 'runTests':
                        const { passed, testOutput } = JSON.parse(result)
                        testPassed = passed
                        lastTestOutput = testOutput
                        console.log(`Tests run complete. Passed: ${passed}`)
                        break
                    case 'writeFileContent':
                        console.log(`Wrote file: ${parsedArgs.filePath}`)
                        break
                    case 'readFileContent':
                        console.log(`Read file: ${parsedArgs.filePath}`)
                        break
                    default:
                        console.log('defaulted')
                }

                return {
                    tool_call_id: toolCall.id,
                    content: result,
                }
            })
        )

        // Add tool outputs to messages
        toolOutputs.forEach(output => {
            messages.push({
                role: 'tool',
                tool_call_id: output.tool_call_id,
                content: output.content,
            })
        })

        // If tests passed, we're done
        if (testPassed) {
            console.log('Tests passed successfully!')
        }
    }
}

if (!testPassed) {
    console.log(`Failed to pass tests after ${maxAttempts} attempts`)
    console.log(`Last test output: ${lastTestOutput}`)
}
