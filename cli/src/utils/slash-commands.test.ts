import type { SlashCommandInfo } from "@shared/proto/cline/slash"
import { describe, expect, it } from "vitest"
import { createCliOnlySlashCommands, filterCommands, getStandaloneSlashCommandToExecute } from "./slash-commands"

const createCommand = (name: string): SlashCommandInfo => ({
	name,
	description: `${name} command`,
	section: "default",
	cliCompatible: true,
})

describe("filterCommands", () => {
	it("prioritizes exact matches ahead of fuzzy matches", () => {
		const commands = [createCommand("help"), createCommand("history"), createCommand("q")]

		const result = filterCommands(commands, "q")

		expect(result.map((command) => command.name)[0]).toBe("q")
	})

	it("prioritizes prefix matches ahead of fuzzy matches", () => {
		const commands = [createCommand("history"), createCommand("help"), createCommand("exit")]

		const result = filterCommands(commands, "hi")

		expect(result.map((command) => command.name)[0]).toBe("history")
	})
})

describe("createCliOnlySlashCommands", () => {
	it("exposes checkpoints as a CLI-only slash command", () => {
		const result = createCliOnlySlashCommands()

		expect(result.some((command) => command.name === "checkpoints")).toBe(true)
	})
})

describe("getStandaloneSlashCommandToExecute", () => {
	it("ignores standalone execution when slash menu is visible", () => {
		expect(
			getStandaloneSlashCommandToExecute({
				prompt: "/q",
				inSlashMode: true,
				hasSlashMenu: true,
				hasPendingAsk: false,
				isSpinnerActive: false,
			}),
		).toBeNull()
	})

	it("returns standalone command when enter should execute it directly", () => {
		expect(
			getStandaloneSlashCommandToExecute({
				prompt: "/exit",
				inSlashMode: false,
				hasSlashMenu: false,
				hasPendingAsk: false,
				isSpinnerActive: false,
			}),
		).toBe("exit")
	})
})
