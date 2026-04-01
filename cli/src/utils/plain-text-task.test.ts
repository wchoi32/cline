import { afterEach, describe, expect, it, vi } from "vitest"
import { emitTaskStartedMessage } from "./task-start-output"

describe("emitTaskStartedMessage", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("writes structured task_started JSON to stdout in json mode", () => {
		const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
		const stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

		emitTaskStartedMessage("task-123", true)

		const payload = JSON.parse(stdoutWriteSpy.mock.calls[0][0] as string)
		expect(payload).toMatchObject({
			schemaVersion: 1,
			event: "start",
			taskId: "task-123",
			sessionId: "task-123",
		})
		expect(typeof payload.timestamp).toBe("number")
		expect(stderrWriteSpy).not.toHaveBeenCalled()
	})

	it("writes human-readable task started line to stderr in non-json mode", () => {
		const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
		const stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

		emitTaskStartedMessage("task-456", false)

		expect(stderrWriteSpy).toHaveBeenCalledWith("Task started: task-456\n")
		expect(stdoutWriteSpy).not.toHaveBeenCalled()
	})
})
