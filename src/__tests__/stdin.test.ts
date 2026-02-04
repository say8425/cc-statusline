import { describe, expect, test } from "bun:test";
import { readStdin } from "../lib.ts";

describe("readStdin", () => {
	test("reads and concatenates chunks from stdin stream", async () => {
		const encoder = new TextEncoder();

		// Mock Bun.stdin.stream with multiple chunks
		const originalStream = Bun.stdin.stream;
		// @ts-expect-error - mocking stdin
		Bun.stdin.stream = () =>
			new ReadableStream({
				start(controller) {
					// Send data in multiple chunks
					controller.enqueue(encoder.encode('{"test":'));
					controller.enqueue(encoder.encode(' "data"}'));
					controller.close();
				},
			});

		try {
			const result = await readStdin();
			expect(result).toBe('{"test": "data"}');
		} finally {
			// @ts-expect-error - restoring stdin
			Bun.stdin.stream = originalStream;
		}
	});

	test("handles empty stdin", async () => {
		const originalStream = Bun.stdin.stream;
		// @ts-expect-error - mocking stdin
		Bun.stdin.stream = () =>
			new ReadableStream({
				start(controller) {
					controller.close();
				},
			});

		try {
			const result = await readStdin();
			expect(result).toBe("");
		} finally {
			// @ts-expect-error - restoring stdin
			Bun.stdin.stream = originalStream;
		}
	});

	test("handles unicode content", async () => {
		const testData = '{"emoji": "🚀", "korean": "한글"}';
		const encoder = new TextEncoder();

		const originalStream = Bun.stdin.stream;
		// @ts-expect-error - mocking stdin
		Bun.stdin.stream = () =>
			new ReadableStream({
				start(controller) {
					controller.enqueue(encoder.encode(testData));
					controller.close();
				},
			});

		try {
			const result = await readStdin();
			expect(result).toBe(testData);
		} finally {
			// @ts-expect-error - restoring stdin
			Bun.stdin.stream = originalStream;
		}
	});
});
