/**
 * @fileOverview
 *   要素の読み込み状況を把握して、コールバックを呼び出す。
 * @author <a href="http://0fk.org/">ofk</a>
 * @version 0.1
 * @license
 *   jquery.loaded.js (c) 2011 ofk
 *   Released under the MIT License.
 */

(function (jQuery, setTimeout, clearTimeout) {

//@vars

var	IS_MSIE = !!document.uniqueID,
	prefix = '*loaded*',
	deferredCache = jQuery.Deferred(),
	deferredName = prefix + 'Deferred',
	completeDeferredName = prefix + 'complete' + 'Deferred';

/**
 * 要素の読み込み状況に応じて、呼び出されるコールバックを指定する。
 *
 * @param {Object} [options] 設定するコールバックオプション。
 * @param {Function} [options.complete] 読み込みが完了もしくは失敗したら、呼び出される。
 * @param {Function} [options.success] 読み込みが完了したら、呼び出される。
 * @param {Function} [options.error] 読み込みが失敗したら、呼び出される。
 * @param {Function} [options.timeout] タイムアウトを設定する。同一のオブジェクトに複数のタイムアウトの付与はできません。
 * @returns {JQuery} コールバック呼び出しが付与されたjQueryオブジェクト。
 */
jQuery.fn.loaded = function (options) {
	var that = this.map(function(){ return this; });

	// 各要素にDeferredを結びつける。
	that.each(function () {
		var	that = this,
			name = that.nodeName && that.nodeName.toLowerCase();
		// 該当するノードがDeferredオブジェクトをまだ結び付けられていない場合、生成する。
		if (jQuery.loaded[name] && !jQuery.data(that, completeDeferredName)) {
			var	deferred = jQuery.Deferred(),
				completeDeferred = jQuery['_' + 'Deferred']();
			jQuery.data(that, deferredName, deferred);
			jQuery.data(that, completeDeferredName, completeDeferred);
			jQuery.loaded[name](that, function (status) {
				deferred[status === 'success' ? 'resolveWith' : 'rejectWith'](that, [ status ]);
				completeDeferred.resolveWith(that, [ status ]);
				jQuery.removeData(that, deferredName);
				jQuery.removeData(that, completeDeferredName);
			}, options && options.timeout > 0 ? options.timeout : 0);
		}
	});

	// jqXHRと同じ形式にする。
	// promiseの代用。
	jQuery.each(deferredCache, function (methodName) {
		that[methodName] = createDeferredMethod(deferredName, methodName);
	});
	that.success = that.done;
	that.error = that.fail;
	that.complete = createDeferredMethod(completeDeferredName, 'done');

	// オプションの設定。
	if (options) {
		for (var i in { success: 1, error: 1, complete: 1 } ) {
			that[i](options[i]);
		}
	}

	return that;
};

/**
 * 各要素に結び付けられたDeferredオブジェクトの該当メソッドを呼び出すメソッドを生成する。
 *
 * @param {String} dataName dataの名前。
 * @param {String} methodName メソッドの名前。
 */
function createDeferredMethod(dataName, methodName) {
	return function () {
		var args = arguments;
		return this.each(function () {
			var dfr = jQuery.data(this, dataName);
			dfr && dfr[methodName] && dfr[methodName].apply(dfr, args);
		});
	};
}

/**
 * jQuery.fn.loadedでラッピングされたjQueryオブジェクトを取得する。
 *
 * @param {mixed} [selector] jQueryの第一引数。
 * @param {mixed} [context] jQueryの第二引数。
 * @returns {JQuery} コールバック呼び出しが付与されたjQueryオブジェクト。
 */
jQuery.loaded = function (selector, context) {
	return jQuery(selector, context).loaded();
};

/**
 * 画像へのDeferredの付与。
 *
 * @param {DOMElement} elem DOM要素。
 * @param {Function} fn(status) 読み込み完了もしくはエラー時に呼び出す関数。
 * @param {Number} timeout タイムアウトまでの秒数。
 * @see <a href="http://d.hatena.ne.jp/uupaa/20080413/1208067631">完全に状況を掌握した画像の遅延読み込みの実現</a>
 */
jQuery.loaded.img = function (elem, fn, timeout) {
	// 完了関数の実行。
	function run(status) {
		elem.loaded = status === 'success' ? 1 : -1;
		fn && fn(status);
		elem.onload = elem.onabort = elem.onerror = fn = null;
	}

	// 画像読み込み自体は終了している。
	if (elem.loaded) {
		setTimeout(function () {
			run(elem.loaded === 1 ? 'success' : 'error');
		}, 0);
		return;
	}
	// IEに対しての実行。
	if (elem.readyState) {
		if (elem.readyState === 'complete') {
			setImageNaturalSize(elem);
			setTimeout(function () {
				run('success');
			}, 0);
			return;
		}
		setTimeout(function () {
			if (!fn) return;
			if (elem.readyState === 'uninitialized' && elem.width === 28  && elem.height === 30) {
				run('error');
			}
		}, 0);
	}
	// ファイルは読み込み終了状態。
	else if (elem.complete) {
		setTimeout(function () {
			if (!fn) return;
			if (!elem.width || ('naturalWidth' in elem && !elem.naturalWidth)) {
				run('error');
			}
			else {
				setImageNaturalSize(elem);
				run('success');
			}
		}, 0);
	}

	// 画像読み込みはまだ始まっていない。
	elem.loaded = 0;
	var timeoutTimer;

	// 読み込み完了のイベント。
	elem.onload = function () {
		timeoutTimer && clearTimeout(timeoutTimer);
		if (elem.complete || elem.readyState === 'complete') {
			setImageNaturalSize(elem);
			run('success');
		}
		else {
			run('error');
		}
	};
	// 読み込み中止もしくはエラーのイベント。
	elem.onabort = elem.onerror = function () {
		timeoutTimer && clearTimeout(timeoutTimer);
		if (!elem.loaded) {
			run('error');
		}
	};
	// タイムアウト処理。
	if (timeout) {
		timeoutTimer = setTimeout(function () {
			if (!elem.loaded) {
				run('timeout');
			}
		}, timeout);
	}
};

/**
 * iframeへのDeferredの付与。
 *
 * @function
 * @param {DOMElement} elem DOM要素。
 * @param {Function} fn(status) 読み込み完了もしくはエラー時に呼び出す関数。
 * @param {Number} timeout タイムアウトまでの秒数。
 */
jQuery.loaded.iframe = deferredEvent;

/**
 * scriptへのDeferredの付与。
 *
 * @function
 * @param {DOMElement} elem DOM要素。
 * @param {Function} fn(status) 読み込み完了もしくはエラー時に呼び出す関数。
 * @param {Number} timeout タイムアウトまでの秒数。
 */
jQuery.loaded.script = deferredEvent;

/**
 * 要素のイベントにDeferredを付与する。
 *
 * @param {DOMElement} elem DOM要素。
 * @param {Function} fn(status) 読み込み完了もしくはエラー時に呼び出す関数。
 * @param {Number} timeout タイムアウトまでの秒数。
 */
function deferredEvent(elem, fn, timeout) {
	// 完了関数の実行。
	function run(status) {
		elem.loaded = status === 'success' ? 1 : -1;
		fn && fn(status);
		elem.onload = elem.onreadystatechange = elem.onabort = elem.onerror = fn = null;
	}

	// 読み込み自体は終了している。
	if (elem.loaded) {
		setTimeout(function () {
			run(elem.loaded === 1 ? 'success' : 'error');
		}, 0);
		return;
	}

	var completeReg = /^(?:loaded|complete)$/, timeoutTimer;
	// IEに対しての実行。
	// unknownになる時がある。
	if (typeof elem.readyState === 'string' && completeReg.test(elem.readyState)) {
		setTimeout(function () {
			run('success');
		}, 0);
		return;
	}
	// 読み込みはまだ始まっていない。
	elem.loaded = 0;

	// 読み込み完了のイベント。
	elem.onload = elem.onreadystatechange = function () {
		timeoutTimer && clearTimeout(timeoutTimer);
		if (!elem.loaded && (!elem.readyState || completeReg.test(elem.readyState))) {
			run('success');
		}
	};
	// 読み込み中止もしくはエラーのイベント。
	elem.onabort = elem.onerror = function () {
		timeoutTimer && clearTimeout(timeoutTimer);
		if (!elem.loaded) {
			run('error');
		}
	};
	// タイムアウト処理。
	if (timeout) {
		timeoutTimer = setTimeout(function () {
			if (!elem.loaded) {
				run('timeout');
			}
		}, timeout);
	}
}

/**
 * 画像のオリジナルサイズを設定する。
 *
 * @param {DOMElement} img 画像ノード。
 * @see <a href="http://d.hatena.ne.jp/uupaa/20090602/1243933843">JavaScript で、画像本来のサイズ(幅, 高さ)を取得する方法</a>
 */
function setImageNaturalSize(img) {
	if ('naturalWidth' in img) {}
	else if (IS_MSIE) {
		var rs = img.runtimeStyle,
		    md = rs.display,
		    mw = rs.width,
		    mh = rs.height;
		rs.display = 'inline_block';
		rs.width = 'auto';
		rs.height = 'auto';
		img.naturalWidth = img.width;
		img.naturalHeight = img.height;
		rs.display = md;
		rs.width = mw;
		rs.height = mh;
	}
	else {
		var mw = img.width,
		    mh = img.height;
		img.removeAttribute('width');
		img.removeAttribute('height');
		img.naturalWidth = img.width;
		img.naturalHeight = img.height;
		img.width = mw;
		img.height = mh;
	}
}


}(jQuery, setTimeout, clearTimeout));