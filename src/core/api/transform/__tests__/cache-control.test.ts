import { describe, it } from "mocha"
import "should"
import { addEphemeralCacheControlToLastMatchingBlock, makeEphemeralTextBlock } from "../cache-control"

describe("makeEphemeralTextBlock", () => {
	it("creates a text block with ephemeral cache_control", () => {
		const block = makeEphemeralTextBlock("hello")
		block.should.deepEqual({
			type: "text",
			text: "hello",
			cache_control: { type: "ephemeral" },
		})
	})

	it("handles empty string", () => {
		const block = makeEphemeralTextBlock("")
		block.should.have.property("type", "text")
		block.should.have.property("text", "")
		block.should.have.property("cache_control").deepEqual({ type: "ephemeral" })
	})
})

describe("addEphemeralCacheControlToLastMatchingBlock", () => {
	it("returns empty array unchanged", () => {
		const result = addEphemeralCacheControlToLastMatchingBlock([], () => true)
		result.should.deepEqual([])
	})

	it("returns array unchanged when no blocks match", () => {
		const blocks = [
			{ type: "text", text: "hello" },
			{ type: "text", text: "world" },
		]
		const result = addEphemeralCacheControlToLastMatchingBlock(blocks, () => false)
		result.should.deepEqual(blocks)
		result.should.not.equal(blocks) // should be a new array (shallow copy)
	})

	it("adds cache_control to the last matching block", () => {
		const blocks = [
			{ type: "text", text: "first" },
			{ type: "image", text: "img" },
			{ type: "text", text: "last" },
		]
		const result = addEphemeralCacheControlToLastMatchingBlock(blocks, (b) => b.type === "text")
		result[0].should.not.have.property("cache_control")
		result[1].should.not.have.property("cache_control")
		result[2].should.have.property("cache_control").deepEqual({ type: "ephemeral" })
	})

	it("only adds cache_control to the LAST match, not all matches", () => {
		const blocks = [
			{ type: "text", text: "first" },
			{ type: "text", text: "second" },
			{ type: "text", text: "third" },
		]
		const result = addEphemeralCacheControlToLastMatchingBlock(blocks, (b) => b.type === "text")
		result[0].should.not.have.property("cache_control")
		result[1].should.not.have.property("cache_control")
		result[2].should.have.property("cache_control").deepEqual({ type: "ephemeral" })
	})

	it("does not mutate the original array", () => {
		const blocks = [
			{ type: "text", text: "hello" },
		]
		const original = [...blocks]
		addEphemeralCacheControlToLastMatchingBlock(blocks, () => true)
		blocks.should.deepEqual(original)
		blocks[0].should.not.have.property("cache_control")
	})

	it("does not mutate the original block object", () => {
		const block = { type: "text", text: "hello" }
		const blocks = [block]
		const result = addEphemeralCacheControlToLastMatchingBlock(blocks, () => true)
		block.should.not.have.property("cache_control")
		result[0].should.have.property("cache_control")
		result[0].should.not.equal(block) // should be a new object
	})
})
