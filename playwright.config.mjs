import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	use: {
		baseURL: "http://127.0.0.1:4322/catalex.github.io/",
		headless: true,
		screenshot: "only-on-failure",
	},
	webServer: [
		{
			command: "node scripts/serve.mjs --dist",
			env: { PORT: "4322", BASE_PATH: "/catalex.github.io/" },
			url: "http://127.0.0.1:4322/catalex.github.io/",
			reuseExistingServer: false,
		},
		{
			command: "node scripts/serve.mjs",
			env: { PORT: "4323", BASE_PATH: "/" },
			url: "http://127.0.0.1:4323/",
			reuseExistingServer: false,
		},
	],
});
