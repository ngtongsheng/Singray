/** Chrome's AudioContext.setSinkId (output device routing) isn't in lib.dom yet. */
type Sinkable<T extends AudioContext> = T & { setSinkId(id: string): Promise<void> }

/** Routes `ctx`'s output to `deviceId` if given; no-op for the system default (''). */
export function setSink<T extends AudioContext>(ctx: T, deviceId: string): Promise<void> {
  return deviceId ? (ctx as Sinkable<T>).setSinkId(deviceId) : Promise.resolve()
}
