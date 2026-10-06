import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { DataContext } from '../src/v3/data/context.js';
import { YearOverYear } from '../src/v3/pro/Money.jsx';

describe('Pro generation comparison loading state', () => {
  it('renders before the live date or range responses arrive', () => {
    const source = {
      ready: false,
      mode: 'demo',
      epoch: 0,
      request: () => ({ promise: Promise.resolve(null) }),
      peek: () => undefined
    };
    const panel = createElement(DataContext.Provider, { value: source },
      createElement(YearOverYear, { pairs: [], loading: true, todayKey: null, firstDay: null }));
    expect(() => renderToString(panel)).not.toThrow();
  });
});
