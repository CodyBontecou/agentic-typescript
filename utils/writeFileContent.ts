import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const writeFileContent = (filePath: string, content: string): void => {
    try {
        const absolutePath = path.resolve(__dirname, '..', filePath)
        fs.writeFileSync(absolutePath, content, 'utf8')
        console.log(`File ${filePath} updated successfully`)
    } catch (error) {
        console.error(`Error writing to file ${filePath}:`, error)
    }
}
