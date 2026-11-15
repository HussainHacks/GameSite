/**
 * Neon Arcade // Safe Storage Guard
 * Safe in-memory fallback for localStorage when access is restricted, blocked,
 * or throws SecurityError / DOMException (e.g. cross-origin iframes, private browsing).
 */
(function(global) {
  'use strict';

  var memStore = {};
  var storageAvailable = false;
  var nativeStorage = null;

  try {
    nativeStorage = global.localStorage;
    var testKey = '__neon_storage_test__';
    nativeStorage.setItem(testKey, '1');
    nativeStorage.removeItem(testKey);
    storageAvailable = true;
  } catch (err) {
    storageAvailable = false;
  }

  var safeStorage = {
    getItem: function(key) {
      if (storageAvailable && nativeStorage) {
        try {
          return nativeStorage.getItem(key);
        } catch (e) {}
      }
      return Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : null;
    },
    setItem: function(key, val) {
      var strVal = String(val);
      if (storageAvailable && nativeStorage) {
        try {
          nativeStorage.setItem(key, strVal);
          return;
        } catch (e) {}
      }
      memStore[key] = strVal;
    },
    removeItem: function(key) {
      if (storageAvailable && nativeStorage) {
        try {
          nativeStorage.removeItem(key);
        } catch (e) {}
      }
      delete memStore[key];
    },
    clear: function() {
      if (storageAvailable && nativeStorage) {
        try {
          nativeStorage.clear();
        } catch (e) {}
      }
      memStore = {};
    },
    key: function(index) {
      if (storageAvailable && nativeStorage) {
        try {
          return nativeStorage.key(index);
        } catch (e) {}
      }
      return Object.keys(memStore)[index] || null;
    },
    get length() {
      if (storageAvailable && nativeStorage) {
        try {
          return nativeStorage.length;
        } catch (e) {}
      }
      return Object.keys(memStore).length;
    }
  };

  global.safeStorage = safeStorage;

  // If native localStorage threw or is blocked, attempt to shim window.localStorage
  if (!storageAvailable) {
    try {
      Object.defineProperty(global, 'localStorage', {
        get: function() { return safeStorage; },
        configurable: true,
        enumerable: true
      });
    } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : this);
