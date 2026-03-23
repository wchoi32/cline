import type { ClineMessage } from "@shared/ExtensionMessage"
import { describe, expect, it } from "vitest"
import { getCheckpointLabel, getCheckpointOptions } from "./CheckpointMenu"

function createMessage(overrides: Partial<ClineMessage>): ClineMessage {
	return {
		ts: Date.now(),
		type: "say",
		say: "text",
		text: "",
		...overrides,
	} as ClineMessage
}

describe("CheckpointMenu helpers", () => {
	it("sorts checkpoints newest-first", () => {
		const messages = [
			createMessage({ ts: 100, say: "text", lastCheckpointHash: "old" }),
			createMessage({ ts: 300, say: "completion_result", lastCheckpointHash: "new" }),
			createMessage({ ts: 200, say: "checkpoint_created", lastCheckpointHash: "mid" }),
		]

		const checkpoints = getCheckpointOptions(messages)

		expect(checkpoints.map((checkpoint) => checkpoint.ts)).toEqual([300, 200, 100])
		expect(checkpoints[0]?.label).toBe("Task completion")
		expect(checkpoints[1]?.label).toBe("Checkpoint")
	})

	it("formats fallback checkpoint labels", () => {
		const label = getCheckpointLabel(createMessage({ say: "info" }))

		expect(label).toBe("info")
	})
})
