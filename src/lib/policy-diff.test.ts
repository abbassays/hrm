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
    const oldHtml = '<h2>Overview</h2><p>Existing rule.</p><ul><li>First</li></ul>';
    const newHtml =
      '<h2>Overview</h2><p>Existing rule.</p><p>New guidance added.</p><ul><li>First</li><li>Second</li></ul>';

    const html = highlightChangedBlocks(oldHtml, newHtml);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const addedBlocks = Array.from(
      doc.body.querySelectorAll(`.${POLICY_DIFF_ADDED_CLASS}`),
    );

    expect(addedBlocks.some((node) => node.textContent?.includes('New guidance added'))).toBe(true);
    expect(addedBlocks.some((node) => node.textContent?.includes('Second'))).toBe(true);
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

    expect(addedBlocks.some((node) => node.textContent?.includes('Delta'))).toBe(true);
    expect(removedBlocks.some((node) => node.textContent?.includes('Beta'))).toBe(true);
    expect(removedBlocks.some((node) => node.textContent?.includes('Gamma'))).toBe(true);
    expect(getPolicyDiffSummary(oldHtml, newHtml)).toBe(2);
  });
});
