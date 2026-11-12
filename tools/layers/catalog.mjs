const baseId = id => id.replace(/@[0-9a-f]{6}$/i, '');

export function selectVariants(actions, selected = []) {
  const groups = new Map();
  for (const action of actions) {
    const id = baseId(action.素材);
    if (selected.length && !selected.includes(id) && !selected.includes(action.素材)) continue;
    if (!groups.has(id)) groups.set(id, {id, variants: []});
    const group = groups.get(id);
    let variant = group.variants.find(item => item.source === action.素材);
    if (!variant) {
      variant = {source: action.素材, actions: []};
      group.variants.push(variant);
    }
    variant.actions.push(action);
  }
  return groups;
}

export function migrateAssets(assets) {
  return assets.map(asset => ({...asset, variants: asset.variants || [{source: asset.source, actions: asset.actions}]}));
}

export function mergeVariants(existing, id, updated, actions) {
  const previous = existing ? migrateAssets([existing])[0].variants : [];
  const replaced = new Set(updated.map(variant => variant.source));
  const variants = [...previous.filter(variant => !replaced.has(variant.source)), ...updated];
  const order = [...new Set(actions.map(action => action.素材))];
  variants.sort((a, b) => order.indexOf(a.source) - order.indexOf(b.source));
  return {
    id,
    source: variants[0].source,
    name: existing?.name || id.split('/').at(-1),
    actions: variants[0].actions,
    variants,
  };
}
