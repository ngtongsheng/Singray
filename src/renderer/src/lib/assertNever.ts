/** Compile-time exhaustiveness check: a reachable call site means a union case was missed. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`)
}
