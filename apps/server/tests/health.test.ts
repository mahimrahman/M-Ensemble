import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('app', () => {
  it('builds without throwing', () => {
    expect(createApp()).toBeDefined();
  });
});
