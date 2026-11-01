import { EditorView } from "@codemirror/view";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { HistoryWorkspaceHarness } from "@/dev/harnesses/history-workspace-harness";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { Toaster } from "@/components/ui/sonner";
import { useAgentEvents } from "@/hooks/use-agent-events";
import { ensureDesktopBrowserMocks } from "@/dev/desktop-browser-mocks";
import { initializeWebsiteFixture } from "@/dev/harnesses/comment-workspace-demo";
import { initializeWebsiteGit } from "@/dev/harnesses/git-three-way-demo";
import { initializeWebsiteReview } from "@/dev/harnesses/agent-file-review-demo";
import { useDocumentStore } from "@/stores/document-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useAgentChatStore } from "@/stores/agent-chat-store";
import { browserHarness } from "@/lib/desktop/bridge";
import { compileLatex } from "@/lib/latex-compiler";
import "@/styles/globals.css";
import "./website.css";
import {prepareHeroDemo} from "./hero-demo";
import {prepareEditorDemo} from "./editor-demo";

const parameters = new URLSearchParams(location.search);
const review = parameters.get("scene") === "review";
const git = parameters.get("scene") === "git";
const hero = parameters.get("scene") === "hero";
const editorDemo = parameters.get("scene") === "editor";
// The existing fixture selects a local LaTeX paper with these flags.
parameters.set("debug", "comment-workspace");
parameters.set("pdf", "");
parameters.set("textReview", "");
history.replaceState(null, "", `${location.pathname}?${parameters}`);
// Every visit resets the sample comments stored by the browser fixture.
for (const key of Object.keys(localStorage)) {
	if (key.startsWith("catalex-harness-")) localStorage.removeItem(key);
}
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: input.url;
	if (url === "/__demo/compile") return originalFetch("./paper.json");
	return originalFetch(input, init);
};

function Workspace() {
	useAgentEvents();
	return <WorkspaceLayout />;
}

function App() {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		async function prepare() {
			if (window.catalex) throw new Error("This sample runs in a browser.");
			ensureDesktopBrowserMocks();
			useSettingsStore.setState({
				modeThemes: { artisan: "modern", duet: "modern" },
			});
			if (git) await initializeWebsiteGit();
			else if (review) await initializeWebsiteReview();
			else {
				initializeWebsiteFixture();
				// Keep this public fixture focused on the paper, not developer test cases.
				useDocumentStore.setState((state) => ({
					files: state.files.filter(
						(file) => !file.relativePath?.includes("minimap"),
					),
				}));
				const result = await compileLatex(
					"/browser-demo/Comment Review",
					"sample.tex",
				);
				useDocumentStore.getState().setPdfData(result.pdfData, "sample.tex");
			}
			const harness = browserHarness();
			const invoke = harness!.invoke;
			// Native actions remain local fixtures. Never launch a real provider or account flow.
			harness!.invoke = async (command, args, options) => {
				if (
					/^(start_|send_.*message|.*_login|.*_logout|open_settings_window|open_path|open_url)/.test(
						command,
					)
				) {
					throw new Error(
						"This is a sample workspace. Live agents and desktop actions are available in Catalex.",
					);
				}
				return invoke(command, args, options);
			};
			if (hero) await prepareHeroDemo();
			if (editorDemo) await prepareEditorDemo();
			setReady(true);
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					document
						.querySelector<HTMLButtonElement>('[aria-label="Hide comments"]')
						?.click();
					window.parent.postMessage(
						{ type: "catalex-ready", scene: review ? "review" : "write" },
						location.origin,
					);
				}),
			);
		}
		prepare().catch((e) => setError(String(e)));
		const handle = (event: MessageEvent) => {
			if (event.origin !== location.origin || event.source !== window.parent)
				return;
			if (
				event.data?.type === "catalex-theme" &&
				["modern", "classic"].includes(event.data.theme)
			) {
				useSettingsStore.setState({
					modeThemes: { artisan: event.data.theme, duet: event.data.theme },
				});
			}
			if (event.data?.type === "catalex-scene" && !review) {
				const scene = event.data.scene;
				if (scene === "agent" || scene === "context")
					useAgentChatStore.getState().requestDrawerOpen();
				if (scene === "write" || scene === "comments")
					useAgentChatStore.getState().requestDrawerCollapse();
				const editor = document.querySelector(".cm-editor");
				const view = editor && EditorView.findFromDOM(editor as HTMLElement);
				if (view && scene === "context") {
					const text = view.state.doc.toString();
					const start = text.indexOf("Reliable evaluation");
					view.dispatch({
						selection: {
							anchor: start,
							head:
								start +
								"Reliable evaluation is difficult when collecting labels is expensive."
									.length,
						},
						scrollIntoView: true,
					});
					view.focus();
				}
				if (scene === "comments")
					document
						.querySelector<HTMLButtonElement>(
							'[aria-label="Comment H-8, line 14"]',
						)
						?.click();
			}
		};
		window.addEventListener("message", handle);
		return () => window.removeEventListener("message", handle);
	}, []);
	return (
		<ThemeProvider attribute="class" forcedTheme="light">
			{ready ? (
				<Workspace />
			) : (
				<div className="website-loading">
					{error || "Making room for your paper…"}
				</div>
			)}
			<Toaster />
		</ThemeProvider>
	);
}
createRoot(document.getElementById("root")!).render(
	parameters.get("scene") === "history" ? <HistoryWorkspaceHarness /> : <App />,
);
