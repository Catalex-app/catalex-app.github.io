// Local recording adapter. Only rendered pixels leave this harness; no live agent runs.
import {EditorView} from "@codemirror/view";
import {useDocumentStore} from "@/stores/document-store";
import {useSettingsStore} from "@/stores/settings-store";
import {useAgentChatStore, type AgentStreamMessage} from "@/stores/agent-chat-store";
import {useProposedChangesStore} from "@/stores/proposed-changes-store";
import {useCodexSetupStore} from "@/stores/codex-setup-store";
import {useHistoryStore} from "@/stores/history-store";

export async function prepareHeroDemo(mode:"artisan"|"duet"="duet") {
  const document = useDocumentStore.getState();
  const root = document.projectRoot!;
  const source = document.files.find(file=>file.id==="sample.tex")!.content!;
  const abstract = source.slice(source.indexOf("Your abstract here."),source.indexOf("\\end{abstract}"));
  const polished = "This demonstration paper examines how small research teams can compare learning\nmethods when labelled examples are scarce. Through illustrative prose, equations,\na results table, and an evaluation checklist, it presents a clear and reproducible\nworkflow for research writing. All experimental values are fictional and serve\nonly to demonstrate the workspace.\n";
  const draft = source.replace(abstract,polished);
  const tabId = useAgentChatStore.getState().activeTabId;
  localStorage.setItem(`catalex-harness-comments:${root}`,"{}");
  useSettingsStore.setState({showEditorMinimap:false,editorCommentsPanelOpenByProject:{[JSON.stringify(root)]:false}});
  useSettingsStore.getState().setWorkspacePreferences(root,{mode,chatLayout:"drawer"});
  useCodexSetupStore.setState({status:"ready",error:null});
  await useCodexSetupStore.getState().refreshModels();
  useHistoryStore.setState({init:async()=>{},createSnapshot:async()=>null});
  const phase = (value:string) => { window.document.documentElement.dataset.demoPhase=value; };
  function messages(messages:AgentStreamMessage[],isStreaming=false) {
    useAgentChatStore.setState(state=>({
      tabs:state.tabs.map(tab=>tab.id===tabId ? {...tab,title:"Polish the abstract",messages,isStreaming,isSettling:false,turnPhase:isStreaming ? "running" : null,pauseState:null,agentWorkspace:null,error:null,history:undefined,draft:{input:"",pinnedContexts:[]}} : tab),
      messages,isStreaming,error:null,
    }));
  }
  let generation = 0;
  const wait = (ms:number) => new Promise<void>(resolve=>setTimeout(resolve,ms));
  async function stream(token:number,id:string,text:string,duration:number) {
    const chunks=text.match(/.{1,4}|\n/g) ?? [];
    for(const chunk of chunks) {
      if(token!==generation) return false;
      useAgentChatStore.getState()._applyActivity(tabId,{kind:"text_delta",id,text:chunk});
      await wait(duration/chunks.length);
    }
    return token===generation;
  }
  async function runAgent(token:number) {
    const chat=useAgentChatStore.getState();
    chat._setProviderStatus(tabId,"codex","Reading the abstract");
    await wait(450);
    if(token!==generation) return;
    if(!await stream(token,"opening","I’ll polish the abstract for clarity and flow, while preserving its meaning.",1800)) return;
    chat._applyActivity(tabId,{kind:"tool_started",id:"read-abstract",name:"Read",input:{file_path:"sample.tex"}});
    await wait(650);
    if(token!==generation) return;
    chat._applyActivity(tabId,{kind:"tool_completed",id:"read-abstract",content:abstract});
    chat._setProviderStatus(tabId,"codex","Polishing the abstract");
    const response="The opening can be more direct. I’m keeping the focus on limited-label evaluation and the distinction between illustrative examples and research findings.\n\nHere is the revised abstract:\n\n> "+polished.replace(/\n/g," ").trim()+"\n\nThe revision removes repetition, improves the flow, and keeps the original scope.";
    if(!await stream(token,"revision",response,8000)) return;
    chat._applyActivity(tabId,{kind:"tool_started",id:"polish-abstract",name:"Edit",input:{file_path:"sample.tex",old_string:abstract,new_string:polished}});
    chat._setProviderStatus(tabId,"codex","Preparing the proposal");
    await wait(650);
    if(token!==generation) return;
    chat._applyActivity(tabId,{kind:"tool_completed",id:"polish-abstract",content:"Prepared one abstract revision for review. The original source is unchanged."});
    if(!await stream(token,"completion","The revised abstract is ready. You can accept it or keep the original.",1400)) return;
    await wait(350);
    if(token!==generation) return;
    chat._setProviderStatus(tabId,"codex",null);
    chat._setStreaming(tabId,false);
    useProposedChangesStore.getState().addChange({id:"hero-abstract-polish",filePath:"sample.tex",absolutePath:`${root}/sample.tex`,oldContent:source,newContent:draft,toolName:"Edit"});
    phase("review");
  }
  useAgentChatStore.setState({sendPrompt:async(prompt,_context,_retry,onAccepted)=>{
    const token=++generation;
    messages([{type:"user",provider:"codex",message:{content:[{type:"text",text:prompt}]}}],true);
    onAccepted?.();
    phase("working");
    // The same continuous response runs while the capture changes display modes.
    void runAgent(token).catch(error=>{
      window.document.documentElement.dataset.demoError=String(error);
      phase("error");
    });
  }});
  function editor() {
    const el=window.document.querySelector(".cm-editor");
    return el ? EditorView.findFromDOM(el as HTMLElement) : null;
  }
  function reset() {
    generation++;
    useProposedChangesStore.setState({changes:[],changesByProject:{},workspaceReview:null,workspaceReviewsByProject:{},activeProjectRoot:root});
    useDocumentStore.setState(state=>({files:state.files.map(file=>file.id==="sample.tex" ? {...file,content:source,isDirty:false} : file),selectionRange:null,cursorPosition:0}));
    messages([]);
    useAgentChatStore.getState().requestDrawerCollapse();
    const view=editor();
    view?.dispatch({selection:{anchor:0}});
    window.document.querySelectorAll(".cm-scroller").forEach(el=>el.scrollTop=0);
    phase("ready");
  }
  window.catalexHeroDemo = {
    reset,
    selectionPoints() {
      const view=editor()!;
      const start=source.indexOf("Your abstract here.");
      const end=source.indexOf("\\end{abstract}")-1;
      return {start:view.coordsAtPos(start),end:view.coordsAtPos(end)};
    },
    state() {
      const file=useDocumentStore.getState().files.find(file=>file.id==="sample.tex");
      const chat=useAgentChatStore.getState();
      const outputChars=chat.messages.filter(message=>message.type==="assistant").flatMap(message=>message.message?.content ?? []).reduce((sum,block)=>sum+(block.text?.length ?? 0),0);
      return {restored:file?.content===source,changes:useProposedChangesStore.getState().changes.length,streaming:chat.isStreaming,outputChars,selected:editor()?.state.sliceDoc(editor()!.state.selection.main.from,editor()!.state.selection.main.to)};
    },
  };
  reset();
}

declare global {
  interface Window { catalexHeroDemo: {
    reset:()=>void;
    selectionPoints:()=>{start:ReturnType<EditorView["coordsAtPos"]>;end:ReturnType<EditorView["coordsAtPos"]>};
    state:()=>{restored:boolean;changes:number;streaming:boolean;outputChars:number;selected:string|undefined};
  }; }
}
