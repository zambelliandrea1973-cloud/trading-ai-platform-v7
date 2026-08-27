function replaceText(text: string) {
  return text
    .replace(/tre cervelli/g, 'cinque cervelli')
    .replace(/Tre cervelli/g, 'Cinque cervelli')
    .replace(/three brains/g, 'five brains')
    .replace(/Three brains/g, 'Five brains');
}

function patchTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && node.data && /tre cervelli|three brains/i.test(node.data)) nodes.push(node);
    node = walker.nextNode();
  }
  for (const textNode of nodes) textNode.data = replaceText(textNode.data);
}

export function installFiveBrainCopyFix() {
  if (typeof document === 'undefined') return;
  const run = () => patchTextNodes(document.body);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) patchTextNodes(added);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
