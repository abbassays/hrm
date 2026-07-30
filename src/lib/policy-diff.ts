const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Classes stamped onto changed blocks in the employee-facing diff view. */
export const POLICY_DIFF_ADDED_CLASS = 'policy-diff-added';
export const POLICY_DIFF_REMOVED_CLASS = 'policy-diff-removed';

/** @deprecated Use POLICY_DIFF_ADDED_CLASS or POLICY_DIFF_REMOVED_CLASS. */
export const POLICY_DIFF_HIGHLIGHT_CLASS = POLICY_DIFF_ADDED_CLASS;

type DiffBlock = {
  element: Element;
  text: string;
};

function getTextContent(node: Element): string {
  return normalizeText(node.textContent ?? '');
}

function collectBlocksFromDocument(doc: Document): DiffBlock[] {
  const blocks: DiffBlock[] = [];

  for (const node of Array.from(doc.body.children)) {
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      for (const li of Array.from(node.children)) {
        blocks.push({
          element: li as Element,
          text: getTextContent(li as Element),
        });
      }
    } else {
      blocks.push({
        element: node as Element,
        text: getTextContent(node as Element),
      });
    }
  }

  return blocks;
}

function collectBlocks(html: string): DiffBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return collectBlocksFromDocument(doc);
}

function markAdded(block: DiffBlock) {
  block.element.classList.add(POLICY_DIFF_ADDED_CLASS);
}

function markRemoved(element: Element) {
  element.classList.add(POLICY_DIFF_REMOVED_CLASS);
}

function cloneBlockElement(block: DiffBlock, doc: Document): Element {
  return doc.importNode(block.element, true) as Element;
}

function insertAtBlockPosition(
  doc: Document,
  element: Element,
  beforeElement: Element | null,
) {
  if (!beforeElement) {
    doc.body.appendChild(element);
    return;
  }

  const anchor =
    beforeElement.tagName === 'LI' && beforeElement.parentElement
      ? beforeElement.parentElement
      : beforeElement;

  anchor.parentElement?.insertBefore(element, anchor);
}

function insertRemovedBlock(
  doc: Document,
  block: DiffBlock,
  beforeBlock: DiffBlock | undefined,
) {
  const cloned = cloneBlockElement(block, doc);
  markRemoved(cloned);
  const beforeElement = beforeBlock?.element ?? null;

  if (cloned.tagName === 'LI') {
    if (beforeElement?.tagName === 'LI' && beforeElement.parentElement) {
      beforeElement.parentElement.insertBefore(cloned, beforeElement);
      return;
    }

    const list = doc.createElement('ul');
    list.appendChild(cloned);
    insertAtBlockPosition(doc, list, beforeElement);
    return;
  }

  insertAtBlockPosition(doc, cloned, beforeElement);
}

type EditOperation =
  | { type: 'equal'; block: DiffBlock }
  | { type: 'insert'; block: DiffBlock }
  | { type: 'delete'; block: DiffBlock }
  | { type: 'replace'; oldBlock: DiffBlock; newBlock: DiffBlock };

function buildEditOperations(oldBlocks: DiffBlock[], newBlocks: DiffBlock[]) {
  const dp = Array.from({ length: oldBlocks.length + 1 }, () =>
    Array<number>(newBlocks.length + 1).fill(0),
  );

  for (let index = 1; index <= oldBlocks.length; index += 1) {
    dp[index][0] = index;
  }
  for (let index = 1; index <= newBlocks.length; index += 1) {
    dp[0][index] = index;
  }

  for (let oldIndex = 1; oldIndex <= oldBlocks.length; oldIndex += 1) {
    for (let newIndex = 1; newIndex <= newBlocks.length; newIndex += 1) {
      if (oldBlocks[oldIndex - 1].text === newBlocks[newIndex - 1].text) {
        dp[oldIndex][newIndex] = dp[oldIndex - 1][newIndex - 1];
      } else {
        dp[oldIndex][newIndex] =
          1 +
          Math.min(
            dp[oldIndex - 1][newIndex],
            dp[oldIndex][newIndex - 1],
            dp[oldIndex - 1][newIndex - 1],
          );
      }
    }
  }

  const operations: EditOperation[] = [];
  let oldIndex = oldBlocks.length;
  let newIndex = newBlocks.length;

  while (oldIndex > 0 || newIndex > 0) {
    if (oldIndex > 0 && newIndex > 0 && oldBlocks[oldIndex - 1].text === newBlocks[newIndex - 1].text) {
      operations.push({ type: 'equal', block: oldBlocks[oldIndex - 1] });
      oldIndex -= 1;
      newIndex -= 1;
      continue;
    }

    const deleteCost = oldIndex > 0 ? dp[oldIndex - 1][newIndex] + 1 : Number.POSITIVE_INFINITY;
    const insertCost = newIndex > 0 ? dp[oldIndex][newIndex - 1] + 1 : Number.POSITIVE_INFINITY;
    const replaceCost = oldIndex > 0 && newIndex > 0 ? dp[oldIndex - 1][newIndex - 1] + 1 : Number.POSITIVE_INFINITY;

    if (insertCost <= deleteCost && insertCost <= replaceCost) {
      operations.push({ type: 'insert', block: newBlocks[newIndex - 1] });
      newIndex -= 1;
    } else if (deleteCost <= insertCost && deleteCost <= replaceCost) {
      operations.push({ type: 'delete', block: oldBlocks[oldIndex - 1] });
      oldIndex -= 1;
    } else {
      operations.push({
        type: 'replace',
        oldBlock: oldBlocks[oldIndex - 1],
        newBlock: newBlocks[newIndex - 1],
      });
      oldIndex -= 1;
      newIndex -= 1;
    }
  }

  return operations.reverse();
}

export function getPolicyDiffSummary(oldHtml: string, newHtml: string): number {
  const oldBlocks = collectBlocks(oldHtml);
  const newBlocks = collectBlocks(newHtml);
  const operations = buildEditOperations(oldBlocks, newBlocks);

  return operations.filter((operation) => operation.type !== 'equal').length;
}

export function highlightChangedBlocks(
  oldHtml: string,
  newHtml: string,
): string {
  const oldBlocks = collectBlocks(oldHtml);
  const doc = new DOMParser().parseFromString(newHtml, 'text/html');
  const newBlocks = collectBlocksFromDocument(doc);
  const operations = buildEditOperations(oldBlocks, newBlocks);

  let nextNewIndex = 0;

  for (const operation of operations) {
    if (operation.type === 'equal') {
      nextNewIndex += 1;
    } else if (operation.type === 'insert') {
      markAdded(newBlocks[nextNewIndex]);
      nextNewIndex += 1;
    } else if (operation.type === 'delete') {
      insertRemovedBlock(doc, operation.block, newBlocks[nextNewIndex]);
    } else if (operation.type === 'replace') {
      insertRemovedBlock(doc, operation.oldBlock, newBlocks[nextNewIndex]);
      markAdded(newBlocks[nextNewIndex]);
      nextNewIndex += 1;
    }
  }

  return doc.body.innerHTML;
}
