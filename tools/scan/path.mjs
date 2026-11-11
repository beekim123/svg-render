// cache: 路径在各平台使用各自缓存目录，清单不保存开发机绝对路径。
import path from 'node:path';
import {cacheRoot} from '../chrome/index.mjs';
const root=path.resolve(import.meta.dirname,'../..');
export function resolveAssetPath(asset,{repositoryRoot=root,cacheDirectory=cacheRoot}={}){
 const file=typeof asset==='string'?asset:asset.文件;
 if(typeof file!=='string'||!file)throw new Error('素材文件字段为空');
 if(file.startsWith('cache:')){
  const relative=file.slice(6);if(!relative||relative.includes('\\')||relative.split('/').some(p=>p==='..'||p==='')||path.isAbsolute(relative))throw new Error('非法缓存相对路径');
  return path.join(cacheDirectory,...relative.split('/'));
 }
 return path.resolve(repositoryRoot,file);
}
