import { describe, expect, it } from "vitest"
import { getCliStateOverrides } from "./vscode-context"

describe("getCliStateOverrides", () => {
	it("omits checkpoint overrides unless explicitly enabled", () => {
		const overrides = getCliStateOverrides()

		expect(overrides.enableCheckpointsSetting).toBeUndefined()
		expect(overrides.vscodeTerminalExecutionMode).toBe("backgroundExec")
	})

	it("applies explicit checkpoint session overrides", () => {
		const overrides = getCliStateOverrides({ enableCheckpointsSetting: true })

		expect(overrides.enableCheckpointsSetting).toBe(true)
	})
})
