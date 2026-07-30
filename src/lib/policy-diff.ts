const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Classes stamped onto changed blocks in the employee-facing diff view. */
export const POLICY_DIFF_ADDED_CLASS = 'policy-diff-added';
export const POLICY_DIFF_REMOVED_CLASS = 'policy-diff-removed';

/** @deprecated Use POLICY_DIFF_ADDED_CLASS or POLICY_DIFF_REMOVED_CLASS. */
export const POLICY_DIFF_HIGHLIGHT_CLASS = POLICY_DIFF_ADDED_CLASS;

type DiffBlock = {
  element: Element;
  signature: string;
};

function getTextContent(node: Element): string {
  return normalizeText(node.textContent ?? '');
}

function toDiffBlock(element: Element): DiffBlock {
  return {
    element,
    // Text alone misses semantic edits such as removing bold text or changing
    // a paragraph into a heading. DOM serialization is stable for the editor's
    // sanitized policy HTML, so it is safe to use as the comparison key.
    signature: `${element.tagName}:${element.innerHTML}`,
  };
}

const sameBlock = (oldBlock: DiffBlock, newBlock: DiffBlock) =>
  oldBlock.signature === newBlock.signature;

function collectBlocksFromDocument(doc: Document): DiffBlock[] {
  const blocks: DiffBlock[] = [];

  for (const node of Array.from(doc.body.children)) {
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      for (const li of Array.from(node.children)) {
        blocks.push(toDiffBlock(li as Element));
      }
    } else {
      blocks.push(toDiffBlock(node as Element));
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

    const list = doc.createElement(
      block.element.parentElement?.tagName === 'OL' ? 'ol' : 'ul',
    );
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

type TextLine = {
  html: string;
  text: string;
};

type LineEditOperation =
  | { type: 'equal'; line: TextLine }
  | { type: 'insert'; line: TextLine }
  | { type: 'delete'; line: TextLine }
  | { type: 'replace'; oldLine: TextLine; newLine: TextLine };

function buildEditOperations(oldBlocks: DiffBlock[], newBlocks: DiffBlock[]) {
  const dp = Array.from({ length: oldBlocks.length + 1 }, () =>
    Array<number>(newBlocks.length + 1).fill(0),
  );

  for (let oldIndex = oldBlocks.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newBlocks.length - 1; newIndex >= 0; newIndex -= 1) {
      if (sameBlock(oldBlocks[oldIndex], newBlocks[newIndex])) {
        dp[oldIndex][newIndex] = dp[oldIndex + 1][newIndex + 1] + 1;
      } else {
        dp[oldIndex][newIndex] = Math.max(
          dp[oldIndex + 1][newIndex],
          dp[oldIndex][newIndex + 1],
        );
      }
    }
  }

  const rawOperations: Array<
    | { type: 'equal'; block: DiffBlock }
    | { type: 'insert'; block: DiffBlock }
    | { type: 'delete'; block: DiffBlock }
  > = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldBlocks.length || newIndex < newBlocks.length) {
    if (
      oldIndex < oldBlocks.length &&
      newIndex < newBlocks.length &&
      sameBlock(oldBlocks[oldIndex], newBlocks[newIndex])
    ) {
      rawOperations.push({ type: 'equal', block: oldBlocks[oldIndex] });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (
      oldIndex < oldBlocks.length &&
      (newIndex === newBlocks.length ||
        dp[oldIndex + 1][newIndex] >= dp[oldIndex][newIndex + 1])
    ) {
      rawOperations.push({ type: 'delete', block: oldBlocks[oldIndex] });
      oldIndex += 1;
    } else {
      rawOperations.push({ type: 'insert', block: newBlocks[newIndex] });
      newIndex += 1;
    }
  }

  const operations: EditOperation[] = [];
  let operationIndex = 0;

  while (operationIndex < rawOperations.length) {
    const operation = rawOperations[operationIndex];
    if (operation.type === 'equal') {
      operations.push(operation);
      operationIndex += 1;
      continue;
    }

    const deleted: DiffBlock[] = [];
    const inserted: DiffBlock[] = [];
    while (
      operationIndex < rawOperations.length &&
      rawOperations[operationIndex].type !== 'equal'
    ) {
      const changedOperation = rawOperations[operationIndex];
      if (changedOperation.type === 'delete')
        deleted.push(changedOperation.block);
      if (changedOperation.type === 'insert')
        inserted.push(changedOperation.block);
      operationIndex += 1;
    }

    const replacementCount = Math.min(deleted.length, inserted.length);
    for (let index = 0; index < replacementCount; index += 1) {
      operations.push({
        type: 'replace',
        oldBlock: deleted[index],
        newBlock: inserted[index],
      });
    }
    deleted.slice(replacementCount).forEach((block) => {
      operations.push({ type: 'delete', block });
    });
    inserted.slice(replacementCount).forEach((block) => {
      operations.push({ type: 'insert', block });
    });
  }

  return operations;
}

/** CKEditor stores Shift+Enter/new-line content within the same list item or
 * paragraph as `<br>`. Splitting those lines lets a one-line edit stay a
 * one-line diff instead of replacing the entire parent block. */
function getTextLines(element: Element): TextLine[] {
  const html = element.innerHTML;
  const lines = html.split(/<br\b[^>]*>/i).map((lineHtml) => ({
    html: lineHtml,
    text: getTextContent(
      new DOMParser().parseFromString(lineHtml, 'text/html').body,
    ),
  }));

  // CKEditor leaves trailing `<br>`/non-breaking-space placeholders when lines
  // are deleted. They are editor artifacts, not employee-visible additions.
  while (lines.at(-1)?.text === '') lines.pop();

  return lines;
}

const hasLineBreak = (element: Element) =>
  /<br\b[^>]*>/i.test(element.innerHTML);

const sameLine = (oldLine: TextLine, newLine: TextLine) =>
  oldLine.html === newLine.html;

function buildLineEditOperations(
  oldLines: TextLine[],
  newLines: TextLine[],
): LineEditOperation[] {
  // Longest-common-subsequence matching deliberately maximizes unchanged lines
  // before it decides which lines were inserted or removed. A plain edit
  // distance can choose a cheaper same-position replacement and incorrectly
  // show an unchanged line as newly added after earlier lines are removed.
  const dp = Array.from({ length: oldLines.length + 1 }, () =>
    Array<number>(newLines.length + 1).fill(0),
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      if (sameLine(oldLines[oldIndex], newLines[newIndex])) {
        dp[oldIndex][newIndex] = dp[oldIndex + 1][newIndex + 1] + 1;
      } else {
        dp[oldIndex][newIndex] = Math.max(
          dp[oldIndex + 1][newIndex],
          dp[oldIndex][newIndex + 1],
        );
      }
    }
  }

  const rawOperations: Array<
    | { type: 'equal'; line: TextLine }
    | { type: 'insert'; line: TextLine }
    | { type: 'delete'; line: TextLine }
  > = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (
      oldIndex < oldLines.length &&
      newIndex < newLines.length &&
      sameLine(oldLines[oldIndex], newLines[newIndex])
    ) {
      rawOperations.push({ type: 'equal', line: oldLines[oldIndex] });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (
      oldIndex < oldLines.length &&
      (newIndex === newLines.length ||
        dp[oldIndex + 1][newIndex] >= dp[oldIndex][newIndex + 1])
    ) {
      rawOperations.push({ type: 'delete', line: oldLines[oldIndex] });
      oldIndex += 1;
    } else {
      rawOperations.push({ type: 'insert', line: newLines[newIndex] });
      newIndex += 1;
    }
  }

  const operations: LineEditOperation[] = [];
  let operationIndex = 0;

  while (operationIndex < rawOperations.length) {
    const operation = rawOperations[operationIndex];
    if (operation.type === 'equal') {
      operations.push(operation);
      operationIndex += 1;
      continue;
    }

    const deleted: TextLine[] = [];
    const inserted: TextLine[] = [];
    while (
      operationIndex < rawOperations.length &&
      rawOperations[operationIndex].type !== 'equal'
    ) {
      const changedOperation = rawOperations[operationIndex];
      if (changedOperation.type === 'delete')
        deleted.push(changedOperation.line);
      if (changedOperation.type === 'insert')
        inserted.push(changedOperation.line);
      operationIndex += 1;
    }

    const replacementCount = Math.min(deleted.length, inserted.length);
    for (let index = 0; index < replacementCount; index += 1) {
      operations.push({
        type: 'replace',
        oldLine: deleted[index],
        newLine: inserted[index],
      });
    }
    deleted.slice(replacementCount).forEach((line) => {
      operations.push({ type: 'delete', line });
    });
    inserted.slice(replacementCount).forEach((line) => {
      operations.push({ type: 'insert', line });
    });
  }

  return operations;
}

const wrapLine = (className: string, html: string) =>
  `<span class="${className}">${html}</span>`;

/** Returns the number of changed inner lines when both blocks use line breaks,
 * otherwise `null` so callers can keep the normal whole-block behavior. */
function getLineDiffOperationCount(
  oldBlock: DiffBlock,
  newBlock: DiffBlock,
): number | null {
  if (oldBlock.element.tagName !== newBlock.element.tagName) return null;
  if (!hasLineBreak(oldBlock.element) && !hasLineBreak(newBlock.element)) {
    return null;
  }

  const oldLines = getTextLines(oldBlock.element);
  const newLines = getTextLines(newBlock.element);

  return buildLineEditOperations(oldLines, newLines).filter(
    (operation) => operation.type !== 'equal',
  ).length;
}

/** Refines a replaced list item/paragraph into line-level changes. This avoids
 * falsely rendering every existing line as removed and re-added when only one
 * `<br>`-separated line changes. */
function highlightChangedLines(oldBlock: DiffBlock, newBlock: DiffBlock) {
  if (oldBlock.element.tagName !== newBlock.element.tagName) return false;
  if (!hasLineBreak(oldBlock.element) && !hasLineBreak(newBlock.element)) {
    return false;
  }

  const oldLines = getTextLines(oldBlock.element);
  const newLines = getTextLines(newBlock.element);

  const fragments = buildLineEditOperations(oldLines, newLines).flatMap(
    (operation) => {
      if (operation.type === 'equal') return [operation.line.html];
      if (operation.type === 'insert') {
        return [wrapLine(POLICY_DIFF_ADDED_CLASS, operation.line.html)];
      }
      if (operation.type === 'delete') {
        return [wrapLine(POLICY_DIFF_REMOVED_CLASS, operation.line.html)];
      }
      return [
        wrapLine(POLICY_DIFF_REMOVED_CLASS, operation.oldLine.html),
        wrapLine(POLICY_DIFF_ADDED_CLASS, operation.newLine.html),
      ];
    },
  );

  newBlock.element.innerHTML = fragments.join('<br>');
  return true;
}

export function getPolicyDiffSummary(oldHtml: string, newHtml: string): number {
  const oldBlocks = collectBlocks(oldHtml);
  const newBlocks = collectBlocks(newHtml);
  const operations = buildEditOperations(oldBlocks, newBlocks);

  return operations.reduce((count, operation) => {
    if (operation.type === 'equal') return count;
    if (operation.type !== 'replace') return count + 1;

    return (
      count +
      (getLineDiffOperationCount(operation.oldBlock, operation.newBlock) ?? 1)
    );
  }, 0);
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
      const newBlock = newBlocks[nextNewIndex];
      if (!highlightChangedLines(operation.oldBlock, newBlock)) {
        insertRemovedBlock(doc, operation.oldBlock, newBlock);
        markAdded(newBlock);
      }
      nextNewIndex += 1;
    }
  }

  return doc.body.innerHTML;
}
