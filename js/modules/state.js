// VERIFIQ - Frontend State Module
// Copyright 2026 BBMW0 Technologies. All rights reserved.

'use strict';

const State = (() => {
  let _state = {
    countryMode:    'Singapore',
    sgGateway:      'Construction',
    myPurposeGroup: 'All',
    filesLoaded:    [],
    hasResults:     false,
    session:        null,
    licence:        'Trial',
    score:          0,
    designScore:    null,
    overallScore:   0,
    loading:        false,
    currentPage:    'dashboard',
    online:         true,    // Assume online until C# reports otherwise
    proxySettings:  null,    // Populated from networkStatus message
    elements3d:     [],      // Element geometry from C# modelData message
    elementSeverities: {},   // Full guid→severity map from C# elementSeverities
  };

  // Listeners: Map<key, Array<callback>>
  const _listeners = new Map();

  function get(key) {
    return key ? _state[key] : { ..._state };
  }

  function set(updates) {
    const changed = {};
    for (const [key, val] of Object.entries(updates)) {
      if (_state[key] !== val) {
        _state[key] = val;
        changed[key] = val;
      }
    }
    if (Object.keys(changed).length === 0) return; // Nothing changed - skip

    // Fire per-key subscribers first
    for (const key of Object.keys(changed)) {
      (_listeners.get(key) || []).forEach(cb => cb(changed[key], _state));
    }
    // Fire wildcard subscriber ONCE per set() call (not once per key)
    (_listeners.get('*') || []).forEach(cb => cb(changed, _state));
  }

  function subscribe(key, callback) {
    if (!_listeners.has(key)) _listeners.set(key, []);
    _listeners.get(key).push(callback);
    return () => {
      const arr = _listeners.get(key) || [];
      const idx = arr.indexOf(callback);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  return { get, set, subscribe };
})();

window.VState = State;
