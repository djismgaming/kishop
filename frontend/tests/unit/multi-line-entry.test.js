/**
 * Frontend Unit Tests - Multi-line entry (issue #29)
 *
 * Verifies the parser that turns pasted multi-line text into individual
 * shopping list items, and that the quick-add bar is wired to it.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const appContent = readFileSync('app.js', 'utf-8');

/**
 * Evaluate app.js in a sandbox that mimics the browser (document + console)
 * and return the functions it exports for tests.
 */
function loadAppModule() {
  const sandbox = {
    document: globalThis.document,
    console,
    module: { exports: {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(appContent, sandbox);
  return sandbox.module.exports;
}

describe('parseMultiLineItems', () => {
  let parseMultiLineItems;

  it('should be exported for tests', () => {
    parseMultiLineItems = loadAppModule().parseMultiLineItems;
    expect(typeof parseMultiLineItems).toBe('function');
  });

  it('should split one item per line', () => {
    const result = loadAppModule().parseMultiLineItems('apple\nbanana\nbread');
    expect(result).toEqual(['apple', 'banana', 'bread']);
  });

  it('should handle carriage-return line endings from text messages', () => {
    const result = loadAppModule().parseMultiLineItems('milk\r\ntuna\r\nrice');
    expect(result).toEqual(['milk', 'tuna', 'rice']);
  });

  it('should trim whitespace around each line', () => {
    const result = loadAppModule().parseMultiLineItems('  apples  \n  bananas \n');
    expect(result).toEqual(['apples', 'bananas']);
  });

  it('should drop empty lines, including leading and trailing ones', () => {
    const result = loadAppModule().parseMultiLineItems('\nolive oil\n\nsoy sauce\n\n');
    expect(result).toEqual(['olive oil', 'soy sauce']);
  });

  it('should return a single item for plain single-line input', () => {
    const result = loadAppModule().parseMultiLineItems('  eggs  ');
    expect(result).toEqual(['eggs']);
  });

  it('should return no items for empty or whitespace-only input', () => {
    expect(loadAppModule().parseMultiLineItems('')).toEqual([]);
    expect(loadAppModule().parseMultiLineItems('\n\n   \n')).toEqual([]);
    expect(loadAppModule().parseMultiLineItems(null)).toEqual([]);
  });

  it('should preserve the order of the lines', () => {
    const result = loadAppModule().parseMultiLineItems('1. Rice\n2. Beans\n3. Chicken');
    expect(result).toEqual(['1. Rice', '2. Beans', '3. Chicken']);
  });
});

describe('Quick-add multi-line wiring', () => {
  const htmlContent = readFileSync('index.html', 'utf-8');

  it('should register a paste handler on the quick-add input', () => {
    expect(appContent).toMatch(
      /quickAddInput\.addEventListener\(\s*'paste'[\s\S]*?e\.clipboardData\?\.getData\('text'\)[\s\S]*?addListItems\(names\)/
    );
  });

  it('should keep single pastes out of the way so normal paste still works', () => {
    expect(appContent).toMatch(/names\.length > 1/);
  });

  it('should add every parsed line as an item on submit', () => {
    expect(appContent).toMatch(
      /quickAddSubmit\.addEventListener\('click'[\s\S]*?parseMultiLineItems\(quickAddInput\.value\)[\s\S]*?addListItems\(names\)/
    );
  });

  it('should hint at multi-line entry in the quick-add placeholder', () => {
    expect(htmlContent).toMatch(/id="quick-add-input"[^>]*one per line/);
  });
});
