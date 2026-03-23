import { createStructuredStartEvent, writeStructuredEvent } from "./structured-output"

export function emitTaskStartedMessage(taskId: string, jsonOutput: boolean): void {
	if (jsonOutput) {
		writeStructuredEvent(createStructuredStartEvent(taskId), (line) => process.stdout.write(line))
		return
	}

	process.stderr.write(`Task started: ${taskId}\n`)
}
