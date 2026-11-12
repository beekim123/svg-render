// Runs in Chrome after the reference timeline has prepared the live SVG.
export function installLayerPage() {
  const svg = document.querySelector('svg');
  const nodes = [svg, ...svg.querySelectorAll('*')];
  for (const [number, element] of nodes.entries()) element.setAttribute('data-svg-render-node', number);
  const animations = document.getAnimations().map(animation => ({
    anchor: -Number(animation.currentTime),
    timing: animation.effect.getTiming(),
    offsets: animation.effect.getKeyframes().map(keyframe => keyframe.computedOffset),
  }));
  const matrix = value => [value.a, value.b, value.c, value.d, value.e, value.f];
  const read = numbers => {
    const matrices = {};
    const opacities = {};
    const locals = {};
    for (const number of numbers) {
      const element = nodes[number];
      matrices[number] = matrix(element.getCTM());
      opacities[number] = Number(getComputedStyle(element).opacity);
    }
    const descriptors = numbers.map(number => ({节点号: number, 属性: 'transform', 来自: 'css'}));
    for (const value of __ref.read(descriptors)) locals[value.节点号] = value.完整局部矩阵;
    return {matrices, opacities, locals};
  };
  window.__layers = {
    read,
    keyTimes(duration) {
      const times = new Set([0, duration]);
      const add = time => {
        if (time >= 0 && time <= duration) times.add(time);
      };
      for (const {anchor, timing, offsets} of animations) {
        const {delay, endDelay, iterations, iterationStart, direction} = timing;
        const period = Number(timing.duration);
        const activeDuration = period * iterations;
        const activeEnd = delay + activeDuration;
        add(anchor);
        add(anchor + delay);
        add(anchor + activeEnd);
        add(anchor + Math.max(0, activeEnd + endDelay));
        if (!(period > 0)) continue;
        const firstActive = Math.max(0, -anchor - delay);
        const lastActive = Math.min(activeDuration, duration - anchor - delay);
        const firstIteration = Math.floor(iterationStart + firstActive / period);
        const lastIteration = Math.floor(iterationStart + lastActive / period);
        for (let iteration = firstIteration; iteration <= lastIteration; iteration++) {
          const reverse = direction === 'reverse' || direction === 'alternate' && iteration % 2 === 1 || direction === 'alternate-reverse' && iteration % 2 === 0;
          for (const offset of [0, ...offsets, 1]) {
            const position = reverse ? 1 - offset : offset;
            const active = (iteration + position - iterationStart) * period;
            if (active >= 0 && active <= activeDuration) add(anchor + delay + active);
          }
        }
      }
      return [...times].sort((a, b) => a - b);
    },
    rest() {
      for (const animation of document.getAnimations()) animation.cancel();
      for (const element of svg.querySelectorAll('animate,animateTransform,animateMotion,set')) element.remove();
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = '*{animation:none!important;transition:none!important}';
      svg.append(style);
      const renderable = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline']);
      const numbers = nodes.flatMap((element, number) => renderable.has(element.localName) ? [number] : []);
      return read(numbers);
    },
  };
}
