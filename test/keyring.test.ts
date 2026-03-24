import { describe, it, expect, beforeEach } from 'vitest';
import { keyring } from '../src/lib/keyring';

describe('keyring', () => {
  beforeEach(() => {
    keyring.reset();
  });

  it('should have default values', () => {
    expect(keyring.apiKey).toBe('');
    expect(keyring.stage).toBe('dev');
    expect(keyring.isGeoloniaStyle).toBe(true);
  });

  it('should set and get apiKey', () => {
    keyring.setApiKey('test-api-key');
    expect(keyring.apiKey).toBe('test-api-key');
  });

  it('should set and get stage', () => {
    keyring.setStage('v1');
    expect(keyring.stage).toBe('v1');
  });

  it('should set and get isGeoloniaStyle', () => {
    keyring.isGeoloniaStyle = false;
    expect(keyring.isGeoloniaStyle).toBe(false);
  });

  it('should reset all values', () => {
    keyring.setApiKey('test');
    keyring.setStage('v1');
    keyring.isGeoloniaStyle = false;
    keyring.reset();
    expect(keyring.apiKey).toBe('');
    expect(keyring.stage).toBe('dev');
    expect(keyring.isGeoloniaStyle).toBe(true);
  });

  describe('isGeoloniaStyleCheck', () => {
    it('should return true for empty string', () => {
      expect(keyring.isGeoloniaStyleCheck('')).toBe(true);
    });

    it('should return true for Geolonia CDN URL', () => {
      expect(
        keyring.isGeoloniaStyleCheck('https://cdn.geolonia.com/style/geolonia/basic-v2/ja.json'),
      ).toBe(true);
    });

    it('should return true for Geolonia API URL', () => {
      expect(
        keyring.isGeoloniaStyleCheck('https://api.geolonia.com/v1/style'),
      ).toBe(true);
    });

    it('should return false for external HTTP URL', () => {
      expect(
        keyring.isGeoloniaStyleCheck('https://example.com/style.json'),
      ).toBe(false);
    });

    it('should return false for .json file', () => {
      expect(keyring.isGeoloniaStyleCheck('my-style.json')).toBe(false);
    });

    it('should return true for logical name', () => {
      expect(keyring.isGeoloniaStyleCheck('geolonia/basic-v2')).toBe(true);
      expect(keyring.isGeoloniaStyleCheck('geolonia/gsi')).toBe(true);
    });
  });
});
