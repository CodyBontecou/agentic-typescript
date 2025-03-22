import { readFileContent } from './utils/readFileContent'
import OpenAI from 'openai'
import type {
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from 'openai/resources'
import { callFunction } from './utils/callFunction'

// Configuration
const MODEL = 'gpt-4o-mini'
const MAX_ATTEMPTS = 10

// Prepare initial setup
function preparePrompt(testFilePath: string): string {
    const basePrompt = `
    Write a Typescript function that passes these tests.
    Rewrite the tests if needed.
    Only return executable Typescript code.
    Do not return Markdown output.
    Do not wrap code in triple backticks.
    Do not return YAML.
`
    const content = readFileContent(testFilePath)
    return basePrompt + content
}

// Define available tools
function getTools(): ChatCompletionTool[] {
    return [
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
                    'Runs tests, returning the test results and its stdout.',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: [],
                    additionalProperties: false,
                },
            },
        },
    ]
}

// Create AI client
function createAIClient() {
    return new OpenAI()
}

// Process tool call
async function processToolCall(
    toolCall: any,
    testState: { testPassed: boolean; lastTestOutput: string }
) {
    const { name, arguments: args } = toolCall.function
    const parsedArgs = args ? JSON.parse(args) : {}

    // Use the callFunction helper
    const result = await callFunction(name, parsedArgs)

    // For test results, check if tests passed
    switch (name) {
        case 'runTests':
            const { passed, testOutput } = JSON.parse(result)
            testState.testPassed = passed
            testState.lastTestOutput = testOutput
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
}

// Make a single attempt
async function makeAttempt(
    openai: OpenAI,
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    testState: { testPassed: boolean; lastTestOutput: string }
) {
    const response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: 'required',
    })

    const message = response.choices[0].message
    messages.push(message)

    if (message.tool_calls && message.tool_calls.length > 0) {
        const toolOutputs = await Promise.all(
            message.tool_calls.map(async toolCall =>
                processToolCall(toolCall, testState)
            )
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
        if (testState.testPassed) {
            console.log('Tests passed successfully!')
        }
    }
}

// Main function to run the code generation workflow
async function generateCode(testFilePath: string) {
    const prompt = preparePrompt(testFilePath)
    const openai = createAIClient()
    const tools = getTools()

    const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: prompt },
    ]

    const testState = {
        testPassed: false,
        lastTestOutput: '',
    }

    let attempt = 0

    while (!testState.testPassed && attempt < MAX_ATTEMPTS) {
        attempt++

        if (attempt > 1 && testState.lastTestOutput.length > 0) {
            messages.push({
                role: 'user',
                content: `The tests failed. Here's the output:\n\n${testState.lastTestOutput}\n\nFix the issues and try again.`,
            })
        }

        await makeAttempt(openai, messages, tools, testState)
    }

    if (!testState.testPassed) {
        console.log(`Failed to pass tests after ${MAX_ATTEMPTS} attempts`)
        console.log(`Last test output: ${testState.lastTestOutput}`)
    }
}

// Execute the code generation
generateCode('tests/add.spec.ts')
