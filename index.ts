import { readFileContent } from './utils/readFileContent'
import { writeFileContent } from './utils/writeFileContent'
import { runTests } from './utils/runTests'

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources'

const content = readFileContent('tests/add.spec.ts')

const basePrompt = `
    Write a Typescript module that passes these tests.
    Only return executable Typescript code.
    Do not return Markdown output.
    Do not wrap code in triple backticks.
    Do not return YAML.
`
const prompt = content + basePrompt

const openai = new OpenAI()
const model = 'gpt-4o-mini'
const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: prompt },
]

let testPassed = false
let attempt = 0
const maxAttempts = 5

while (!testPassed && attempt < maxAttempts) {
    attempt++
    const completion = await openai.chat.completions.create({
        model,
        messages,
    })

    writeFileContent('add.ts', completion.choices[0].message.content ?? '')
    const { passed, testOutput } = await runTests()
    testPassed = passed

    messages.push({
        role: 'system',
        content:
            'Tests are failing with this output. Try again. \n\n' + testOutput,
    })
}
