// Compile the exact before/after sources used by the recorded editor demo.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=JSON.parse(await readFile(`${root}workspace-demo/editor-source.json`,'utf8'));
for(const [name,text] of [['initial',source.initial],['compiled',source.initial.replace('\n\\end{document}',source.insertion+'\n\\end{document}')]]) {
  const output=`${root}output/editor-tex/${name}/`;
  await mkdir(output,{recursive:true});
  await writeFile(`${output}sample.tex`,text);
  const result=spawnSync(process.env.PDFLATEX || 'pdflatex',['-interaction=nonstopmode','-halt-on-error','-no-shell-escape','sample.tex'],{cwd:output,encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stdout || result.stderr || 'pdflatex failed');
  const pdf=await readFile(`${output}sample.pdf`);
  await writeFile(`${root}workspace-demo/editor-${name}.json`,JSON.stringify({source:text,pdf:pdf.toString('base64'),sourceMap:{inputs:{},boxes:[]}})+'\n');
  console.log(`${name}: compiled ${pdf.length} PDF bytes`);
}
