import { describe, it } from "mocha"
import "should"
import type { ModelInfo } from "@shared/api"
import sinon from "sinon"
import { createOpenRouterStream } from "../openrouter-stream"

describe("createOpenRouterStream", () => {
	const createAsyncIterable = () => ({
		async *[Symbol.asyncIterator]() {},
	})

	const createClient = () => {
		const create = sinon.stub().resolves(createAsyncIterable())
		return {
			client: {
				chat: {
					completions: {
						create,
					},
				},
			},
			create,
		}
	}

	const createModelInfo = (maxTokens: number): ModelInfo => ({
		maxTokens,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
	})

	it("caps Gemini Flash OpenRouter requests to 8192 max_tokens", async () => {
		const { client, create } = createClient()

		await createOpenRouterStream(client as any, "system prompt", [{ role: "user", content: "hello" }] as any, {
			id: "google/gemini-2.5-flash",
			info: createModelInfo(65_536),
		})

		const payload = create.firstCall.args[0] as Record<string, unknown>
		payload.should.have.property("max_tokens", 8_192)
	})

	it("keeps lower Gemini Flash max_tokens values when already below 8192", async () => {
		const { client, create } = createClient()

		await createOpenRouterStream(client as any, "system prompt", [{ role: "user", content: "hello" }] as any, {
			id: "google/gemini-2.5-flash",
			info: createModelInfo(4_096),
		})

		const payload = create.firstCall.args[0] as Record<string, unknown>
		payload.should.have.property("max_tokens", 4_096)
	})

	it("does not send max_tokens for non-Gemini models", async () => {
		const { client, create } = createClient()

		await createOpenRouterStream(client as any, "system prompt", [{ role: "user", content: "hello" }] as any, {
			id: "anthropic/claude-sonnet-4.5",
			info: createModelInfo(64_000),
		})

		const payload = create.firstCall.args[0] as Record<string, unknown>
		payload.should.not.have.property("max_tokens")
	})

	it("does not send max_tokens for non-Flash Gemini models", async () => {
		const { client, create } = createClient()

		await createOpenRouterStream(client as any, "system prompt", [{ role: "user", content: "hello" }] as any, {
			id: "google/gemini-2.5-pro",
			info: createModelInfo(65_536),
		})

		const payload = create.firstCall.args[0] as Record<string, unknown>
		payload.should.not.have.property("max_tokens")
	})

	it("does NOT apply cache_control for non-Anthropic/non-MiniMax models", async () => {
		const { client, create } = createClient()

		await createOpenRouterStream(
			client as any,
			"system prompt",
			[
				{ role: "user", content: "first user message" },
				{ role: "assistant", content: "assistant reply" },
				{ role: "user", content: "second user message" },
			] as any,
			{
				id: "google/gemini-2.0-flash",
				info: createModelInfo(32_000),
			},
		)

		const payload = create.firstCall.args[0] as any
		// System prompt should be a plain string, not an array with cache_control
		payload.messages[0].content.should.equal("system prompt")
		// User messages should be plain strings, not arrays with cache_control
		payload.messages[1].content.should.equal("first user message")
		payload.messages[3].content.should.equal("second user message")
	})

	it("applies prompt cache control to the system prompt and the last two user messages for Anthropic models", async () => {
		const { client, create } = createClient()

		await createOpenRouterStream(
			client as any,
			"system prompt",
			[
				{ role: "user", content: "first user message" },
				{ role: "assistant", content: "assistant reply" },
				{ role: "user", content: "second user message" },
			] as any,
			{
				id: "anthropic/claude-sonnet-4.5",
				info: createModelInfo(64_000),
			},
		)

		const payload = create.firstCall.args[0] as any
		payload.messages[0].content[0].cache_control.should.deepEqual({ type: "ephemeral" })
		payload.messages[1].content[0].cache_control.should.deepEqual({ type: "ephemeral" })
		payload.messages[3].content[0].cache_control.should.deepEqual({ type: "ephemeral" })
	})
})
