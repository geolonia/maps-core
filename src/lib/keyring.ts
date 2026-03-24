class Keyring {
  #apiKey = '';
  #stage = 'dev';
  #isGeoloniaStyle = true;

  get apiKey() {
    return this.#apiKey;
  }

  get stage() {
    return this.#stage;
  }

  get isGeoloniaStyle() {
    return this.#isGeoloniaStyle;
  }

  set isGeoloniaStyle(value: boolean) {
    this.#isGeoloniaStyle = value;
  }

  setApiKey(key: string) {
    this.#apiKey = key;
  }

  setStage(stage: string) {
    this.#stage = stage;
  }

  reset() {
    this.#apiKey = '';
    this.#stage = 'dev';
    this.#isGeoloniaStyle = true;
  }

  /**
   * Check if the given style is a Geolonia style (requires API key)
   */
  isGeoloniaStyleCheck(style: string): boolean {
    if (!style || style === '') {
      return true;
    }

    if (
      style.startsWith('https://cdn.geolonia.com/style/') ||
      style.startsWith('https://api.geolonia.com/')
    ) {
      return true;
    }

    if (style.match(/^https?:\/\//)) {
      return false;
    }

    if (style.endsWith('.json')) {
      return false;
    }

    // Geolonia logical name like "geolonia/basic"
    return true;
  }
}

const keyring = new Keyring();

export { keyring };
