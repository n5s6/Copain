import * as nodeTest from 'node:test';
import * as assert from 'node:assert';

export interface Expectation<T = any> {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toHaveLength(length: number): void;
  toContain(item: any): void;
  toMatch(pattern: RegExp | string): void;
  toBeGreaterThan(n: number): void;
  toBeLessThan(n: number): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThanOrEqual(n: number): void;
  toThrow(expected?: string | RegExp): void;
  rejects: {
    toThrow(expected?: string | RegExp): Promise<void>;
  };
  not: {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toHaveLength(length: number): void;
    toContain(item: any): void;
    toMatch(pattern: RegExp | string): void;
  };
}

export function expect<T = any>(actual: T): any {
  if (isVitest) {
    return (globalThis as any).expect(actual);
  }
  const isPromise = actual && typeof (actual as any).then === 'function';

  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected);
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined, `Expected value to be defined, got undefined`);
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined, `Expected undefined, got ${JSON.stringify(actual)}`);
    },
    toBeNull() {
      assert.strictEqual(actual, null, `Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      assert.ok(actual, `Expected truthy value, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      assert.ok(!actual, `Expected falsy value, got ${JSON.stringify(actual)}`);
    },
    toHaveLength(expectedLength: number) {
      const len = (actual as any)?.length;
      assert.strictEqual(
        len,
        expectedLength,
        `Expected length ${expectedLength}, got ${len}`
      );
    },
    toContain(item: any) {
      if (typeof actual === 'string') {
        assert.ok(
          actual.includes(String(item)),
          `Expected string "${actual}" to contain "${item}"`
        );
      } else if (Array.isArray(actual)) {
        assert.ok(
          actual.includes(item) || actual.some((x) => JSON.stringify(x) === JSON.stringify(item)),
          `Expected array to contain ${JSON.stringify(item)}`
        );
      } else {
        assert.fail(`toContain called on non-string, non-array object: ${typeof actual}`);
      }
    },
    toMatch(pattern: RegExp | string) {
      const reg = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      assert.match(String(actual), reg);
    },
    toBeGreaterThan(n: number) {
      assert.ok(
        (actual as any) > n,
        `Expected ${actual} to be greater than ${n}`
      );
    },
    toBeLessThan(n: number) {
      assert.ok(
        (actual as any) < n,
        `Expected ${actual} to be less than ${n}`
      );
    },
    toBeGreaterThanOrEqual(n: number) {
      assert.ok(
        (actual as any) >= n,
        `Expected ${actual} to be greater than or equal to ${n}`
      );
    },
    toBeLessThanOrEqual(n: number) {
      assert.ok(
        (actual as any) <= n,
        `Expected ${actual} to be less than or equal to ${n}`
      );
    },
    toThrow(expected?: string | RegExp) {
      if (typeof actual !== 'function') {
        assert.fail(`toThrow called on non-function: ${typeof actual}`);
      }
      let threw = false;
      let errorThrown: any = null;
      try {
        (actual as any)();
      } catch (err: any) {
        threw = true;
        errorThrown = err;
      }
      assert.ok(threw, `Expected function to throw error, but it did not throw`);
      if (expected) {
        if (typeof expected === 'string') {
          assert.ok(
            errorThrown?.message?.includes(expected) || String(errorThrown).includes(expected),
            `Expected error message to include "${expected}", got "${errorThrown?.message}"`
          );
        } else {
          assert.match(errorThrown?.message || String(errorThrown), expected);
        }
      }
    },
    rejects: {
      async toThrow(expected?: string | RegExp) {
        if (!isPromise) {
          assert.fail(`rejects.toThrow called on non-promise`);
        }
        let threw = false;
        let errorThrown: any = null;
        try {
          await (actual as any);
        } catch (err: any) {
          threw = true;
          errorThrown = err;
        }
        assert.ok(threw, `Expected promise to reject, but it resolved`);
        if (expected) {
          if (typeof expected === 'string') {
            assert.ok(
              errorThrown?.message?.includes(expected) || String(errorThrown).includes(expected),
              `Expected rejection message to include "${expected}", got "${errorThrown?.message}"`
            );
          } else {
            assert.match(errorThrown?.message || String(errorThrown), expected);
          }
        }
      }
    },
    not: {
      toBe(expected: any) {
        assert.notStrictEqual(actual, expected);
      },
      toEqual(expected: any) {
        assert.notDeepStrictEqual(actual, expected);
      },
      toBeDefined() {
        assert.strictEqual(actual, undefined);
      },
      toBeUndefined() {
        assert.notStrictEqual(actual, undefined);
      },
      toBeNull() {
        assert.notStrictEqual(actual, null);
      },
      toBeTruthy() {
        assert.ok(!actual);
      },
      toBeFalsy() {
        assert.ok(actual);
      },
      toHaveLength(expectedLength: number) {
        const len = (actual as any)?.length;
        assert.notStrictEqual(len, expectedLength);
      },
      toContain(item: any) {
        if (typeof actual === 'string') {
          assert.ok(!actual.includes(String(item)));
        } else if (Array.isArray(actual)) {
          assert.ok(!actual.includes(item));
        }
      },
      toMatch(pattern: RegExp | string) {
        const reg = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        assert.ok(!reg.test(String(actual)));
      }
    }
  };
}

const isVitest =
  typeof (globalThis as any).describe === 'function' &&
  typeof (globalThis as any).expect === 'function';

export const describe = isVitest ? (globalThis as any).describe : nodeTest.describe;
export const it = isVitest ? (globalThis as any).it : nodeTest.it;
export const test = isVitest ? (globalThis as any).test : nodeTest.test;
export const beforeAll = isVitest
  ? (globalThis as any).beforeAll
  : nodeTest.before;
export const afterAll = isVitest
  ? (globalThis as any).afterAll
  : nodeTest.after;
export const beforeEach = isVitest
  ? (globalThis as any).beforeEach
  : nodeTest.beforeEach;
export const afterEach = isVitest
  ? (globalThis as any).afterEach
  : nodeTest.afterEach;
