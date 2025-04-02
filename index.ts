import { readFileContent } from './utils/readFileContent'
import { writeFileContent } from './utils/writeFileContent'
import { runTests } from './utils/runTests'

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources'

const fileContent = readFileContent('tests/add.spec.ts')
const openai = new OpenAI()
const model = 'gpt-4o-mini'
const messages: ChatCompletionMessageParam[] = [
    {
        role: 'system',
        content: `
            You are a professional software developer that relies on well-tested code.
        `,
    },
    {
        role: 'user',
        content:
            fileContent +
            `
              Write a Typescript function that passes these tests.
              Only return executable Typescript code.
              Do not return Markdown output.
              Do not wrap code in triple backticks.
              Do not return YAML.
            `,
    },
]

let testPassed = false
let attempts = 0
const maxAttempts = 5
while (!testPassed && attempts < maxAttempts) {
    attempts++
    const response = await openai.chat.completions.create({
        model,
        messages,
    })
    const llmContent = response.choices[0].message.content ?? ''

    if (!response) {
        console.error('Failed to get a response from the AI.')
        break
    } else {
        messages.push({ role: 'assistant', content: llmContent })

        writeFileContent('add.ts', llmContent)
        const { passed, testOutput } = await runTests()
        testPassed = passed

        messages.push({
            role: 'system',
            content:
                'Tests are failing with this output. Try again.\n\n' +
                testOutput,
        })
    }
}
