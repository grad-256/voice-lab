/**
 * PWA 起動時に LP ルート（`/`・`/ja`・`/en`）に到達したら `/app` へ同期退避する
 * インラインスクリプト。React hydration 前に実行される（`app/layout.tsx` 参照）。
 *
 * 判定：`display-mode: standalone`（一般）＋ `navigator.standalone`（古い iOS Safari）の OR。
 * `location.replace` で履歴に LP を残さない。
 */
export const PWA_REDIRECT_SCRIPT = `(function(){try{var isPwa=window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;if(!isPwa)return;var p=location.pathname;var seg=p.split("/").filter(Boolean);var isLanding=seg.length===0||(seg.length===1&&(seg[0]==="ja"||seg[0]==="en"));if(isLanding){location.replace("/app");}}catch(e){}})();`;
