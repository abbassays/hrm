// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  getPolicyDiffSummary,
  highlightChangedBlocks,
  POLICY_DIFF_ADDED_CLASS,
  POLICY_DIFF_REMOVED_CLASS,
} from './policy-diff';

describe('policy diff helpers', () => {
  it('marks new and changed blocks and reports a summary count', () => {
    const oldHtml =
      '<h2>Overview</h2><p>Existing rule.</p><ul><li>First</li></ul>';
    const newHtml =
      '<h2>Overview</h2><p>Existing rule.</p><p>New guidance added.</p><ul><li>First</li><li>Second</li></ul>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const addedBlocks = Array.from(
      doc.body.querySelectorAll(`.${POLICY_DIFF_ADDED_CLASS}`),
    );

    expect(
      addedBlocks.some((node) =>
        node.textContent?.includes('New guidance added'),
      ),
    ).toBe(true);
    expect(
      addedBlocks.some((node) => node.textContent?.includes('Second')),
    ).toBe(true);
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(2);
  });

  it('shows removed blocks in red and replacements as remove-then-add', () => {
    const oldHtml = '<p>Alpha</p><p>Beta</p><p>Gamma</p>';
    const newHtml = '<p>Alpha</p><p>Delta</p>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const addedBlocks = Array.from(
      doc.body.querySelectorAll(`.${POLICY_DIFF_ADDED_CLASS}`),
    );
    const removedBlocks = Array.from(
      doc.body.querySelectorAll(`.${POLICY_DIFF_REMOVED_CLASS}`),
    );

    expect(
      addedBlocks.some((node) => node.textContent?.includes('Delta')),
    ).toBe(true);
    expect(
      removedBlocks.some((node) => node.textContent?.includes('Beta')),
    ).toBe(true);
    expect(
      removedBlocks.some((node) => node.textContent?.includes('Gamma')),
    ).toBe(true);
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(2);
  });

  it('highlights only an appended line within an existing list item', () => {
    const oldHtml =
      '<ul><li>Keep this bullet.</li><li>First line.<br>Second line.</li></ul>';
    const newHtml =
      '<ul><li>Keep this bullet.</li><li>First line.<br>Second line.<br>New final line.</li></ul>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const changedItem = doc.body.querySelectorAll('li')[1];

    expect(changedItem?.textContent).toContain(
      'First line.Second line.New final line.',
    );
    expect(
      changedItem?.querySelector(`.${POLICY_DIFF_ADDED_CLASS}`)?.textContent,
    ).toBe('New final line.');
    expect(
      changedItem?.querySelector(`.${POLICY_DIFF_REMOVED_CLASS}`),
    ).toBeNull();
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(1);
  });

  it('keeps matching lines intact when a middle line is replaced or removed', () => {
    const oldHtml = '<p>First.<br>Old middle.<br>Last.</p>';
    const newHtml = '<p>First.<br>New middle.<br>Last.</p>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const paragraph = doc.body.querySelector('p');

    expect(
      paragraph?.querySelector(`.${POLICY_DIFF_REMOVED_CLASS}`)?.textContent,
    ).toBe('Old middle.');
    expect(
      paragraph?.querySelector(`.${POLICY_DIFF_ADDED_CLASS}`)?.textContent,
    ).toBe('New middle.');
    expect(paragraph?.textContent).toContain(
      'First.Old middle.New middle.Last.',
    );
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(1);
  });

  it('matches duplicate lines before marking a deleted line', () => {
    const oldHtml = '<li>Repeat.<br>Remove me.<br>Repeat.</li>';
    const newHtml = '<li>Repeat.<br>Repeat.</li>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(
      doc.querySelector(`.${POLICY_DIFF_REMOVED_CLASS}`)?.textContent,
    ).toBe('Remove me.');
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(1);
  });

  it('preserves a later matching line when earlier lines are deleted', () => {
    const oldHtml =
      '<li>First.<br>Keep this.<br>Delete one.<br>Delete two.<br>Keep this later.</li>';
    // The trailing empty/non-breaking-space lines mirror the markup CKEditor
    // leaves after deleting content at the end of a list item.
    const newHtml =
      '<li>First.<br>Keep this.<br>Keep this later.<br><br>&nbsp;</li>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const added = Array.from(
      doc.querySelectorAll(`.${POLICY_DIFF_ADDED_CLASS}`),
    );
    const removed = Array.from(
      doc.querySelectorAll(`.${POLICY_DIFF_REMOVED_CLASS}`),
    );

    expect(added).toHaveLength(0);
    expect(removed.map((line) => line.textContent)).toEqual([
      'Delete one.',
      'Delete two.',
    ]);
    expect(doc.body.textContent).toContain('Keep this later.');
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(2);
  });

  it('shows only the removed final line when line breaks are deleted too', () => {
    const oldHtml = '<li>Keep this.<br>Remove this.</li>';
    const newHtml = '<li>Keep this.</li>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(
      doc.querySelector(`.${POLICY_DIFF_REMOVED_CLASS}`)?.textContent,
    ).toBe('Remove this.');
    expect(doc.querySelector(`.${POLICY_DIFF_ADDED_CLASS}`)).toBeNull();
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(1);
  });

  it('detects formatting-only edits', () => {
    const oldHtml = '<p>Use <strong>approved</strong> tools.</p>';
    const newHtml = '<p>Use approved tools.</p>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(doc.querySelector(`.${POLICY_DIFF_REMOVED_CLASS}`)).not.toBeNull();
    expect(doc.querySelector(`.${POLICY_DIFF_ADDED_CLASS}`)).not.toBeNull();
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(1);
  });

  it('keeps later identical blocks aligned after a deletion', () => {
    const oldHtml = '<p>Keep first.</p><p>Remove this.</p><p>Keep later.</p>';
    const newHtml = '<p>Keep first.</p><p>Keep later.</p>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    expect(doc.querySelectorAll(`.${POLICY_DIFF_REMOVED_CLASS}`)).toHaveLength(
      1,
    );
    expect(
      doc.querySelector(`.${POLICY_DIFF_REMOVED_CLASS}`)?.textContent,
    ).toBe('Remove this.');
    expect(doc.querySelector(`.${POLICY_DIFF_ADDED_CLASS}`)).toBeNull();
  });

  it('preserves ordered-list semantics for removed items', () => {
    const oldHtml = '<ol><li>Keep.</li><li>Remove.</li></ol><p>After.</p>';
    const newHtml = '<ol><li>Keep.</li></ol><p>After.</p>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const removedItem = doc.querySelector(`.${POLICY_DIFF_REMOVED_CLASS}`);

    expect(removedItem?.tagName).toBe('LI');
    expect(removedItem?.parentElement?.tagName).toBe('OL');
  });
});
