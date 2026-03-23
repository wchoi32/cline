import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect } from "chai"
import { afterEach, beforeEach, describe, it } from "mocha"
import sinon from "sinon"
import { ClineDefaultTool } from "@/shared/tools"
import { SaveMemoryToolHandler } from "../SaveMemoryToolHandler"

describe("SaveMemoryToolHandler", () => {
	let cwd = ""
	let handler: SaveMemoryToolHandler
	let askStub: sinon.SinonStub
	let sayStub: sinon.SinonStub
	let shouldAutoApproveToolWithPathStub: sinon.SinonStub

	beforeEach(async () => {
		cwd = await fs.mkdtemp(path.join(os.tmpdir(), "cline-save-memory-"))
		handler = new SaveMemoryToolHandler()
		askStub = sinon.stub().resolves({ response: "yesButtonClicked" })
		sayStub = sinon.stub().resolves(undefined)
		shouldAutoApproveToolWithPathStub = sinon.stub().resolves(false)
	})

	afterEach(async () => {
		sinon.restore()
		await fs.rm(cwd, { recursive: true, force: true })
	})

	it("saves a markdown memory file after approval", async () => {
		const result = await handler.execute(
			{
				cwd,
				isSubagentExecution: false,
				autoApprovalSettings: { enableNotifications: false } as any,
				taskState: { consecutiveMistakeCount: 0 } as any,
				callbacks: {
					ask: askStub,
					say: sayStub,
					shouldAutoApproveToolWithPath: shouldAutoApproveToolWithPathStub,
					sayAndCreateMissingParamError: sinon.stub(),
				} as any,
			} as any,
			{
				name: ClineDefaultTool.SAVE_MEMORY,
				params: { name: "project notes", content: "Stable guidance" },
			} as any,
		)

		expect(result).to.include("Saved persistent workspace memory")
		expect(await fs.readFile(path.join(cwd, ".cline", "memory", "project-notes.md"), "utf8")).to.equal("Stable guidance\n")
		expect(askStub.calledOnce).to.be.true
	})

	it("skips manual approval when the memory write is auto-approved", async () => {
		shouldAutoApproveToolWithPathStub.resolves(true)

		const result = await handler.execute(
			{
				cwd,
				isSubagentExecution: false,
				autoApprovalSettings: { enableNotifications: false } as any,
				taskState: { consecutiveMistakeCount: 0 } as any,
				callbacks: {
					ask: askStub,
					say: sayStub,
					shouldAutoApproveToolWithPath: shouldAutoApproveToolWithPathStub,
					sayAndCreateMissingParamError: sinon.stub(),
				} as any,
			} as any,
			{
				name: ClineDefaultTool.SAVE_MEMORY,
				params: { name: "auto memory", content: "Reusable defaults" },
			} as any,
		)

		expect(result).to.include("Saved persistent workspace memory")
		expect(await fs.readFile(path.join(cwd, ".cline", "memory", "auto-memory.md"), "utf8")).to.equal("Reusable defaults\n")
		expect(askStub.called).to.be.false
		expect(shouldAutoApproveToolWithPathStub.calledOnce).to.be.true
	})

	it("does not write memory when rejected", async () => {
		askStub.resolves({ response: "noButtonClicked" })

		const result = await handler.execute(
			{
				cwd,
				isSubagentExecution: false,
				autoApprovalSettings: { enableNotifications: false } as any,
				taskState: { consecutiveMistakeCount: 0 } as any,
				callbacks: {
					ask: askStub,
					say: sayStub,
					shouldAutoApproveToolWithPath: shouldAutoApproveToolWithPathStub,
					sayAndCreateMissingParamError: sinon.stub(),
				} as any,
			} as any,
			{
				name: ClineDefaultTool.SAVE_MEMORY,
				params: { name: "project notes", content: "Stable guidance" },
			} as any,
		)

		expect(result).to.include("The user denied this operation")
		let fileExists = true
		try {
			await fs.stat(path.join(cwd, ".cline", "memory", "project-notes.md"))
		} catch {
			fileExists = false
		}
		expect(fileExists).to.be.false
	})
})
