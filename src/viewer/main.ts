// TEMPORARY walking-skeleton spike: proves @pierre/diffs + @pierre/trees (+ Shiki)
// bundle offline via `Bun.build` (target browser) and render in a browser.
// Task 11 replaces this entire file with the real viewer implementation.
import { CodeView, parsePatchFiles } from "@pierre/diffs";
import { FileTree } from "@pierre/trees";

const SAMPLE = `diff --git a/hello.ts b/hello.ts
index 0000001..0000002 100644
--- a/hello.ts
+++ b/hello.ts
@@ -1,2 +1,2 @@
-const greeting = "hi";
+const greeting = "hello";
 console.log(greeting);
`;

const files = parsePatchFiles(SAMPLE).flatMap((p) => p.files);

const tree = new FileTree({
	paths: files.map((f) => f.name),
	initialExpansion: "open",
});
tree.render({
	containerWrapper: document.getElementById("tree") as HTMLElement,
});

const codeView = new CodeView({ diffStyle: "unified", themeType: "dark" });
codeView.setup(document.getElementById("diff") as HTMLElement);
codeView.setItems(
	files.map((f) => ({ id: f.name, type: "diff", fileDiff: f })),
);
codeView.render();
