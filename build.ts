// Statusline runtime bundle (unchanged)
await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "bun",
});

// Browser viewer bundle (Pierre + Shiki)
await Bun.build({
	entrypoints: ["./src/viewer/main.ts"],
	outdir: "./dist/viewer",
	target: "browser",
	minify: true,
});

// Copy the viewer shell HTML next to the bundle
await Bun.write(
	"./dist/viewer/index.html",
	Bun.file("./src/viewer/index.html"),
);
