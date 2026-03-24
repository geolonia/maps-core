import { describe, it, expect, beforeEach } from 'vitest';
import { keyring } from '../src/lib/keyring';
import { getStyle } from '../src/lib/util';

describe('getStyle - edge cases', () => {
  beforeEach(() => {
    keyring.reset();
    keyring.setApiKey('test-key');
  });

  it('should resolve geolonia/gsi logical name', () => {
    expect(getStyle('geolonia/gsi', { lang: 'ja', apiKey: 'test-key' })).toBe(
      'https://cdn.geolonia.com/style/geolonia/gsi/ja.json',
    );
  });

  it('should resolve English variant of logical name', () => {
    expect(getStyle('geolonia/basic-v2', { lang: 'en', apiKey: 'test-key' })).toBe(
      'https://cdn.geolonia.com/style/geolonia/basic-v2/en.json',
    );
  });

  it('should pass through HTTPS style URL without modification', () => {
    const url = 'https://tiles.example.com/style/custom.json';
    expect(getStyle(url, { lang: 'ja' })).toBe(url);
  });

  it('should pass through HTTP style URL', () => {
    const url = 'http://tiles.example.com/style.json';
    expect(getStyle(url, { lang: 'ja' })).toBe(url);
  });

  it('should treat null-ish style as default', () => {
    expect(getStyle('', { lang: 'ja', apiKey: 'test-key' })).toContain('basic-v2/ja.json');
  });

  it('should not throw for external style without API key', () => {
    keyring.reset();
    expect(() =>
      getStyle('https://example.com/style.json', { lang: 'ja', apiKey: '' }),
    ).not.toThrow();
  });

  it('should throw for logical name without API key', () => {
    keyring.reset();
    expect(() =>
      getStyle('geolonia/gsi', { lang: 'ja', apiKey: '' }),
    ).toThrow('API key is required');
  });

  it('should throw for empty style without API key', () => {
    keyring.reset();
    expect(() =>
      getStyle('', { lang: 'ja', apiKey: '' }),
    ).toThrow('API key is required');
  });

  it('should use apiKey param over keyring', () => {
    keyring.reset();
    // No keyring API key set, but passed via options
    expect(() =>
      getStyle('geolonia/basic-v2', { lang: 'ja', apiKey: 'from-options' }),
    ).not.toThrow();
  });

  it('should default to English when lang is not ja', () => {
    expect(getStyle('geolonia/basic-v2', { lang: 'en', apiKey: 'test-key' })).toContain('/en.json');
    expect(getStyle('geolonia/basic-v2', { lang: 'fr' as 'en', apiKey: 'test-key' })).toContain('/en.json');
  });
});
