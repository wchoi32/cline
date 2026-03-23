import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { expect } from "chai"
import { afterEach, describe, it } from "mocha"
import {
	getPersistentMemoryFiles,
	getPersistentMemoryInstructions,
	normalizeMemoryFileName,
	saveWorkspaceMemory,
} from "../memory"

describe("persistent memory", () => {
	let tempDirs: string[] = []

	async function makeTempDir(prefix: string): Promise<string> {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
		tempDirs.push(dir)
		return dir
	}

	async function cleanup(): Promise<void> {
		await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })))
		tempDirs = []
	}

	afterEach(async () => {
		await cleanup()
	})

	it("normalizes memory file names safely", () => {
		expect(normalizeMemoryFileName("project notes")).to.equal("project-notes.md")
		expect(normalizeMemoryFileName("project-notes.md")).to.equal("project-notes.md")
		expect(() => normalizeMemoryFileName("../escape")).to.throw("path separators")
	})

	it("loads workspace memory before global memory in deterministic order", async () => {
		const cwd = await makeTempDir("cline-memory-workspace-")
		const homeDir = await makeTempDir("cline-memory-home-")

		await fs.mkdir(path.join(cwd, ".cline", "memory"), { recursive: true })
		await fs.writeFile(path.join(cwd, ".cline", "memory", "workspace.md"), "workspace memory", "utf8")
		await fs.mkdir(path.join(homeDir, "memory"), { recursive: true })
		await fs.writeFile(path.join(homeDir, "memory", "global.md"), "global memory", "utf8")

		const files = await getPersistentMemoryFiles(cwd, { homeDir })
		expect(files.map((file) => file.displayPath)).to.deep.equal([
			path.join(".cline", "memory", "workspace.md"),
			path.join("~/.cline", "memory", "global.md"),
		])

		const instructions = await getPersistentMemoryInstructions(cwd, { homeDir })
		expect(instructions).to.include("## Workspace Memory")
		expect(instructions).to.include("## Global Memory")
		const workspaceIndex = instructions!.indexOf("Workspace Memory")
		const globalIndex = instructions!.indexOf("Global Memory")
		expect(workspaceIndex).to.be.lessThan(globalIndex)
	})

	it("writes workspace memory files under .cline/memory", async () => {
		const cwd = await makeTempDir("cline-memory-save-")

		const savedPath = await saveWorkspaceMemory(cwd, "project notes", "Remember this")
		expect(path.relative(cwd, savedPath)).to.equal(path.join(".cline", "memory", "project-notes.md"))

		const content = await fs.readFile(savedPath, "utf8")
		expect(content).to.equal("Remember this\n")
	})
})
