import {createReferenceSession, triggersAction} from '../ref/index.mjs';
import {exportScene} from '../scene/export-page.mjs';
import {installLayerPage} from './browser-page.mjs';

export async function createLayerSession(options = {}) {
  const reference = await createReferenceSession(options);
  const browser = reference.browser;
  let base = 0;
  const load = async ({svg, id = '', color, action, triggerTime = 1000}) => {
    base = triggersAction(action) ? triggerTime : 0;
    const size = await reference.prepare({svg, id, color, action, triggerTime, scale: 1});
    await browser.evaluate(`(${installLayerPage.toString()})()`);
    return size;
  };
  return {
    browser,
    load,
    keyTimes: duration => browser.evaluate(`__layers.keyTimes(${duration})`),
    sample: (time, nodes) => browser.evaluate(`__ref.seek(${time + base});__layers.read(${JSON.stringify(nodes)})`),
    async rest({svg, id = '', color, tracks = []}) {
      await load({svg, id, color});
      const state = await browser.evaluate('__layers.rest()');
      const scene = await browser.evaluate(`(${exportScene.toString()})(document.querySelector('svg'), ${JSON.stringify({layers: true, tracks})})`);
      return {scene, ...state};
    },
    close: () => reference.close(),
  };
}
