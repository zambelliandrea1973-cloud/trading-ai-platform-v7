function replaceText(text: string) {
  return text
    .replace(/Lettura a (?:tre|cinque|5) cervelli/gi, 'Lettura AI')
    .replace(/Dettaglio decisione a (?:tre|cinque|5) cervelli/gi, 'Dettaglio decisione AI')
    .replace(/dove i (?:tre|cinque|5) cervelli concordano/gi, 'dove l\'AI rileva consenso')
    .replace(/la logica dei (?:tre|cinque|5) cervelli/gi, 'la logica interna dell\'AI')
    .replace(/i (?:tre|cinque|5) cervelli non hanno/gi, 'l\'AI non ha')
    .replace(/i (?:tre|cinque|5) cervelli/gi, 'l\'AI')
    .replace(/(?:Tre|Cinque|5) cervelli pronti/gi, 'AI pronta')
    .replace(/(?:Tre|Cinque|5) cervelli operativi/gi, 'AI ATTIVA')
    .replace(/Consenso\s+(?:Tre|Cinque|5) cervelli/gi, 'AI attiva')
    .replace(/(?:Tre|Cinque|5) cervelli/gi, 'AI')
    .replace(/three brains/gi, 'AI')
    .replace(/five brains/gi, 'AI')
    .replace(/technical brain/gi, 'Technical analysis')
    .replace(/fundamental brain/gi, 'Fundamental analysis')
    .replace(/risk brain/gi, 'Risk analysis')
    .replace(/cervello tecnico/gi, 'Analisi tecnica')
    .replace(/cervello fondamentale/gi, 'Analisi fondamentale')
    .replace(/cervello (?:di|del) rischio/gi, 'Analisi del rischio');
}

function patchTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && node.data && /cervell|brains?|technical brain|fundamental brain|risk brain/i.test(node.data)) {
      nodes.push(node);
    }
    node = walker.nextNode();
  }
  for (const textNode of nodes) textNode.data = replaceText(textNode.data);
}

function hideInternalArchitectureCards(root: ParentNode) {
  const elements = root.querySelectorAll<HTMLElement>('*');
  for (const element of elements) {
    const ownText = Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ')
      .trim();

    if (/^CERVELLO\s+[1-5]$/i.test(ownText) || /^BRAIN\s+[1-5]$/i.test(ownText)) {
      const card = element.closest<HTMLElement>('.rounded-md, .rounded-lg') ?? element.parentElement;
      if (card) card.style.display = 'none';
    }
  }

  for (const grid of root.querySelectorAll<HTMLElement>('.grid')) {
    const text = grid.textContent ?? '';
    if (/CERVELLO\s+1/i.test(text) && /CERVELLO\s+5/i.test(text)) {
      grid.style.display = 'none';
    }
  }
}

function patchVisibleUi(root: Node) {
  patchTextNodes(root);
  if (root instanceof Document || root instanceof Element) hideInternalArchitectureCards(root);
}

export function installFiveBrainCopyFix() {
  if (typeof document === 'undefined') return;

  const run = () => patchVisibleUi(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) patchVisibleUi(added);
    }
    patchVisibleUi(document);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}
