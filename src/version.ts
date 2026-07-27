/**
 * `@geolonia/maps-core` のバージョン文字列です。
 * index.ts から `coreVersion` という名前で公開されます。
 *
 * 値はビルド時に package.json の version から自動注入されます。
 */
declare const __PACKAGE_VERSION__: string;
export const VERSION: string = __PACKAGE_VERSION__;
