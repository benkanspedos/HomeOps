declare namespace jest {
  interface Matchers<R> {
    toBeOneOf(expected: Array<any>): R;
    toBeTypeOf(expected: string): R;
  }
}