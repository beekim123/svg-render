// 单文件入口先用于微场景；清单批处理复用同一会话 API。
import fs from 'node:fs/promises';
import {captureStatic} from './index.mjs';
const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--'));const option=(name,fallback)=>{const n=args.indexOf(name);return n<0?fallback:args[n+1];};
if(!file){console.error('用法：node tools/ref/cli.mjs <文件.svg> --out <输出.png> [--scale 1] [--oplog]');process.exitCode=2;}else{try{const start=performance.now();const result=await captureStatic({svg:await fs.readFile(file,'utf8'),scale:Number(option('--scale',1)),output:option('--out','out/static.png'),oplog:args.includes('--oplog')});console.log(JSON.stringify({...result.metadata,耗时毫秒:performance.now()-start}));}catch(e){console.error(e.stack);process.exitCode=2;}}
