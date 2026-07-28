/**
 * ステージの既定値です。本番環境を表す `"v1"` です。
 *
 * ステージは、SDK がタイルや API をどの環境から取得するかを決める値です。
 * `stage` を指定しなかった場合は、この値が使われます。
 *
 * - `"v1"`（既定）: 本番環境。`tileserver.geolonia.com` と `https://api.geolonia.com/v1` を使用します。
 * - `"dev"`: 開発環境。`tileserver-dev.geolonia.com` と `https://api.geolonia.com/dev` を使用します。
 *
 * 通常は指定する必要がありません。開発環境を使う場合のみ、`GeoloniaMap` の
 * `stage` オプションか {@link Keyring.setStage} で明示的に切り替えてください。
 *
 * `@geolonia/maps-react` や `@geolonia/maps-suite` のようなラッパーが、
 * 自身の既定として参照することを想定して公開しています。値をハードコードせず
 * この定数を使うことで、SDK 全体で既定のステージが揃います。
 *
 * @example
 * ```typescript
 * import { DEFAULT_STAGE, GeoloniaMap } from "@geolonia/maps-core";
 *
 * new GeoloniaMap({
 *   container: "#map",
 *   apiKey: "YOUR-API-KEY",
 *   stage: DEFAULT_STAGE,
 * });
 * ```
 */
export const DEFAULT_STAGE = "v1";

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
   * 初期値は {@link DEFAULT_STAGE}（`"v1"`）です。
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
   * API キーは空文字列、ステージは {@link DEFAULT_STAGE}、Geolonia スタイル判定は `true` にリセットされます。
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
