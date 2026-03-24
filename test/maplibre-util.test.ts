/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { DOM, bindAll } from '../src/lib/maplibre-util';

describe('DOM.create', () => {
  it('should create an element with given tag name', () => {
    const el = DOM.create('div');
    expect(el.tagName).toBe('DIV');
  });

  it('should set className when provided', () => {
    const el = DOM.create('span', 'my-class');
    expect(el.className).toBe('my-class');
  });

  it('should append to container when provided', () => {
    const container = document.createElement('div');
    const el = DOM.create('p', 'child', container);
    expect(container.children.length).toBe(1);
    expect(container.children[0]).toBe(el);
  });

  it('should not set className when undefined', () => {
    const el = DOM.create('div');
    expect(el.className).toBe('');
  });
});

describe('DOM.remove', () => {
  it('should remove node from parent', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    expect(parent.children.length).toBe(1);
    DOM.remove(child);
    expect(parent.children.length).toBe(0);
  });

  it('should not throw if node has no parent', () => {
    const orphan = document.createElement('div');
    expect(() => DOM.remove(orphan)).not.toThrow();
  });
});

describe('DOM.createNS', () => {
  it('should create an element with namespace', () => {
    const el = DOM.createNS('http://www.w3.org/2000/svg', 'svg');
    expect(el.tagName).toBe('svg');
    expect(el.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

describe('bindAll', () => {
  it('should bind methods to context', () => {
    const obj = {
      value: 42,
      getValue() {
        return this.value;
      },
    };

    bindAll(['getValue'], obj as unknown as Record<string, unknown>);

    const fn = obj.getValue;
    expect(fn()).toBe(42);
  });

  it('should skip non-existent methods', () => {
    const obj = { value: 1 };
    expect(() =>
      bindAll(['nonExistent'], obj as unknown as Record<string, unknown>),
    ).not.toThrow();
  });

  it('should skip non-function properties', () => {
    const obj = { value: 42 };
    expect(() =>
      bindAll(['value'], obj as unknown as Record<string, unknown>),
    ).not.toThrow();
  });
});
