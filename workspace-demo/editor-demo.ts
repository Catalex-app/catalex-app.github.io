// Recording fixture: actual renderer, real precompiled LaTeX, local agent output.
import {EditorView} from '@codemirror/view';
import {useDocumentStore} from '@/stores/document-store';
import {useSettingsStore} from '@/stores/settings-store';
import {useAgentChatStore} from '@/stores/agent-chat-store';
import {useCodexSetupStore} from '@/stores/codex-setup-store';
import {useHistoryStore} from '@/stores/history-store';
import {compileLatex} from '@/lib/latex-compiler';
import source from './editor-source.json';
import initial from './editor-initial.json';
import compiled from './editor-compiled.json';

export async function prepareEditorDemo() {
  const root=useDocumentStore.getState().projectRoot!;
  localStorage.setItem(`catalex-harness-comments:${root}`,'{}');
  useSettingsStore.setState({showEditorMinimap:false,editorCommentsPanelOpenByProject:{[JSON.stringify(root)]:false}});
  useSettingsStore.getState().setProjectAutoCompile(root,false);
  useSettingsStore.getState().setWorkspacePreferences(root,{mode:'artisan',chatLayout:'drawer'});
  useHistoryStore.setState({init:async()=>{},createSnapshot:async()=>null});
  useCodexSetupStore.setState({status:'ready',error:null});
  await useCodexSetupStore.getState().refreshModels();
  useAgentChatStore.setState(state=>({
    messages:[],isStreaming:false,error:null,
    tabs:state.tabs.map(tab=>tab.id===state.activeTabId ? {...tab,title:'New session',messages:[],isStreaming:false,isSettling:false,turnPhase:null,pauseState:null,agentWorkspace:null,error:null,draft:{input:'',pinnedContexts:[]}} : tab),
  }));
  useDocumentStore.setState(state=>({files:state.files.map(file=>file.id==='sample.tex' ? {...file,content:source.initial,isDirty:false} : file.id==='manuscript.md' ? {...file,content:'# A clean space to write\n\nIdeas first. Everything else in its place.\n\n- LaTeX and Markdown\n- Code and preview\n- Artisan and Duet\n',isDirty:false} : file)}));
  let compileCount=0;
  const fetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    if(input==='/__demo/compile') {
      const body=JSON.parse(String(init?.body));
      if(body.source!==initial.source && body.source!==compiled.source)throw new Error('Recording source does not match its compiled PDF.');
      // Keep the real compile button's busy state visible for a natural beat.
      if(body.source===compiled.source){compileCount++;await new Promise(resolve=>setTimeout(resolve,700));}
      return new Response(JSON.stringify(body.source===compiled.source ? compiled : initial),{headers:{'Content-Type':'application/json'}});
    }
    return fetch(input,init);
  };
  const result=await compileLatex(root,'sample.tex');
  useDocumentStore.getState().setPdfData(result.pdfData,'sample.tex');
  useDocumentStore.getState().setActiveFile('manuscript.md');
  useAgentChatStore.setState({sendPrompt:async(prompt,_context,_retry,onAccepted)=>{
    const chat=useAgentChatStore.getState(),tabId=chat.activeTabId;
    const messages=[{type:'user' as const,provider:'codex' as const,message:{content:[{type:'text',text:prompt}]}}];
    useAgentChatStore.setState(state=>({messages,isStreaming:true,tabs:state.tabs.map(tab=>tab.id===tabId ? {...tab,messages,isStreaming:true,turnPhase:'running',title:'A clearer introduction'} : tab)}));
    onAccepted?.();
    chat._setProviderStatus(tabId,'codex','Reading your introduction');
    const reply='Start with the idea you want to explore.\n\nGood research begins with a clear question. A focused workspace gives that question room to develop.';
    await new Promise(resolve=>setTimeout(resolve,500));
    for(const chunk of reply.match(/.{1,3}|\n/g) ?? []){
      chat._applyActivity(tabId,{kind:'text_delta',id:'editor-demo-reply',text:chunk});
      await new Promise(resolve=>setTimeout(resolve,55));
    }
    chat._setProviderStatus(tabId,'codex',null);
    chat._setStreaming(tabId,false);
  }});
  window.catalexEditorDemo={
    insertionPoint(){
      const view=EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!;
      const position=view.state.doc.toString().indexOf('\n\\end{document}');
      return {position,rect:view.coordsAtPos(position)};
    },
    state(){const view=EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement);return {cursor:view?.state.selection.main.head ?? 0,source:useDocumentStore.getState().files.find(file=>file.id==='sample.tex')?.content,compileCount,activeFile:useDocumentStore.getState().activeFileId,streaming:useAgentChatStore.getState().isStreaming};},
  };
}

declare global {
  interface Window {catalexEditorDemo:{insertionPoint:()=>{position:number;rect:ReturnType<EditorView['coordsAtPos']>};state:()=>{cursor:number;source:string|undefined;compileCount:number;activeFile:string;streaming:boolean}};}
}
