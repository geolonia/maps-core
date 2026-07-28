/**
 * ステージの既定値。
 *
 * かつては `"dev"` だった。stage が `"dev"` のとき SDK は
 * `tileserver.geolonia.com` を `tileserver-dev.geolonia.com` へ書き換え、
 * API も `https://api.geolonia.com/dev` を向く（`GeoloniaMap` を参照）。
 *
 * CDN 版の embed はスクリプトタグから stage を読んで設定するが、npm 経由で
 * SDK を直接使う場合はその材料がない。既定が `"dev"` だと、stage を渡し忘れた
 * 利用者が黙って dev 環境を叩いてしまう。既定は本番であるべきなので `"v1"` にする。
 *
 * dev を使いたい場合は {@link Keyring.setStage} か `GeoloniaMap` の
 * `stage` オプションで明示的に指定する。
 */
const DEFAULT_STAGE = "v1";

/**
 * API キー、ステージ、現在のスタイルが Geolonia スタイルかどうかを保持するクラスです。
 *
 * これらの値は SDK 全体で共有され、地図タイルやスタイルの取得時に参照されます。
 * 通常は `GeoloniaMap` の生成時に自動的に設定されるため、利用者が直接操作する必要はありません。
 * ただし `@geolonia/embed/core` のように地図インスタンスを生成せずに SDK の機能を利用する場合など、
 * 手動で API キーやステージを設定したいときに使用します。
 *
 * このクラスのインスタンスは {@link keyring} としてシングルトンで公開されます。
 *
 * @example
 * ```typescript
 * keyring.setApiKey("YOUR-API-KEY");
 * ```
 */
class Keyring {
  #apiKey = "";
  #stage = DEFAULT_STAGE;
  #isGeoloniaStyle = true;

  /**
   * 現在設定されている API キーを返します。
   *
   * 未設定の場合は空文字列を返します。
   *
   * @returns API キーの文字列を返します。
   */
  get apiKey() {
    return this.#apiKey;
  }

  /**
   * 現在設定されているステージを返します。
   *
   * 初期値は `"v1"`（本番）です。{@link DEFAULT_STAGE} を参照してください。
   *
   * @returns ステージを表す文字列を返します。
   */
  get stage() {
    return this.#stage;
  }

  /**
   * 現在のスタイルが Geolonia スタイル（API キーが必要なスタイル）かどうかを返します。
   *
   * @returns Geolonia スタイルの場合は `true`、それ以外の場合は `false` を返します。
   */
  get isGeoloniaStyle() {
    return this.#isGeoloniaStyle;
  }

  /**
   * 現在のスタイルが Geolonia スタイルかどうかを設定します。
   *
   * @param value Geolonia スタイルとして扱う場合は `true`、それ以外の場合は `false` を指定します。
   */
  set isGeoloniaStyle(value: boolean) {
    this.#isGeoloniaStyle = value;
  }

  /**
   * API キーを設定します。
   *
   * @param key 設定する API キーの文字列を指定します。
   */
  setApiKey(key: string) {
    this.#apiKey = key;
  }

  /**
   * ステージを設定します。
   *
   * @param stage 設定するステージの文字列を指定します。
   */
  setStage(stage: string) {
    this.#stage = stage;
  }

  /**
   * API キー、ステージ、Geolonia スタイル判定をすべて初期状態に戻します。
   *
   * API キーは空文字列、ステージは `"v1"`、Geolonia スタイル判定は `true` にリセットされます。
   */
  reset() {
    this.#apiKey = "";
    this.#stage = DEFAULT_STAGE;
    this.#isGeoloniaStyle = true;
  }

  /**
   * 与えられたスタイルが Geolonia スタイル（API キーが必要なスタイル）かどうかを判定します。
   *
   * 判定は次のロジックで行われます。
   *
   * - 空文字列（未指定）の場合は `true` を返します。
   * - `https://cdn.geolonia.com/style/` または `https://api.geolonia.com/` で始まる URL の場合は `true` を返します。
   * - 上記以外で `http://` または `https://` で始まる外部 URL の場合は `false` を返します。
   * - `geolonia://` で始まる場合は Geolonia 独自プロトコルのため `true` を返します。
   * - それ以外のプロトコル（`xxx://` 形式）で始まる場合は `false` を返します。
   * - `.json` で終わる場合は `false` を返します。
   * - 上記のいずれにも該当しない場合は、`geolonia/basic` のような Geolonia の論理名とみなして `true` を返します。
   *
   * @param style 判定対象のスタイル（URL、プロトコル付き文字列、または論理名）を指定します。
   * @returns Geolonia スタイルの場合は `true`、それ以外の場合は `false` を返します。
   */
  isGeoloniaStyleCheck(style: string): boolean {
    if (!style || style === "") {
      return true;
    }

    if (
      style.startsWith("https://cdn.geolonia.com/style/") ||
      style.startsWith("https://api.geolonia.com/")
    ) {
      return true;
    }

    if (style.match(/^https?:\/\//)) {
      return false;
    }

    // geolonia:// is a Geolonia protocol, other non-http protocols are not
    if (style.startsWith("geolonia://")) {
      return true;
    }
    if (style.match(/^[a-z][a-z0-9+.-]*:\/\//i)) {
      return false;
    }

    if (style.endsWith(".json")) {
      return false;
    }

    // Geolonia logical name like "geolonia/basic"
    return true;
  }
}

/**
 * {@link Keyring} のシングルトンインスタンスです。
 *
 * SDK 全体で共有される API キー、ステージ、Geolonia スタイル判定を保持します。
 * 通常は `GeoloniaMap` の生成時に自動設定されますが、手動で設定することもできます。
 *
 * @example
 * ```typescript
 * keyring.setApiKey("YOUR-API-KEY");
 * ```
 */
const keyring = new Keyring();

export { keyring };
