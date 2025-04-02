import { readFileContent } from './readFileContent'
import { runTests } from './runTests'
import { writeFileContent } from './writeFileContent'

export const callFunction = async (name: string, args: any) => {
    // Function map to store all available functions
    const functionMap: Record<string, (args: any) => Promise<any>> = {
        writeFileContent: async args => {
            return await writeFileContent(args.filePath, args.content)
        },

        runTests: async () => {
            const { passed, testOutput } = await runTests()
            return JSON.stringify({ passed, testOutput })
        },

        readFileContent: async args => {
            return await readFileContent(args.filePath)
        },
    }

    // Check if the requested function exists
    const requestedFunction = functionMap[name]

    if (requestedFunction) {
        return await requestedFunction(args)
    }

    throw new Error(`Function ${name} not implemented`)
}
