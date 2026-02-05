/**
 * RingBuffer for lock-free audio data transfer between threads.
 * Based on the ringbuf.js pattern used in W3C WebCodecs samples.
 * Uses SharedArrayBuffer for cross-thread communication.
 */

/**
 * Get the storage needed for a RingBuffer of the given capacity.
 * @param capacity - Number of elements to store
 * @param Type - TypedArray constructor (e.g., Float32Array)
 */
export function getStorageForCapacity(
  capacity: number,
  Type: Float32ArrayConstructor,
): SharedArrayBuffer {
  if (!crossOriginIsolated) {
    console.warn(
      "SharedArrayBuffer requires cross-origin isolation. " +
        "Set COOP/COEP headers for optimal audio performance.",
    );
  }

  // Storage layout:
  // - 4 bytes for read pointer (Uint32)
  // - 4 bytes for write pointer (Uint32)
  // - capacity * Type.BYTES_PER_ELEMENT for data
  const bytes = 8 + capacity * Type.BYTES_PER_ELEMENT;
  return new SharedArrayBuffer(bytes);
}

/**
 * Lock-free ring buffer for single-producer single-consumer scenarios.
 * Designed for audio data transfer between worker and AudioWorklet.
 */
export class RingBuffer {
  private storage: SharedArrayBuffer;
  private capacity: number;
  private readPtr: Uint32Array;
  private writePtr: Uint32Array;
  private storageView: Float32Array;

  /**
   * Create a RingBuffer from existing storage.
   * @param storage - SharedArrayBuffer created by getStorageForCapacity
   * @param Type - TypedArray constructor matching what was used for storage
   */
  constructor(storage: SharedArrayBuffer, Type: Float32ArrayConstructor) {
    this.storage = storage;

    // Calculate capacity from storage size
    this.capacity = (storage.byteLength - 8) / Type.BYTES_PER_ELEMENT;

    // Create views for read/write pointers and data
    this.readPtr = new Uint32Array(storage, 0, 1);
    this.writePtr = new Uint32Array(storage, 4, 1);
    this.storageView = new Float32Array(storage, 8, this.capacity);
  }

  /**
   * Get the underlying SharedArrayBuffer (for transferring to AudioWorklet).
   */
  get buf(): SharedArrayBuffer {
    return this.storage;
  }

  /**
   * Push elements into the ring buffer.
   * @param elements - Float32Array of elements to push
   * @returns Number of elements actually written
   */
  push(elements: Float32Array): number {
    const read = Atomics.load(this.readPtr, 0);
    const write = Atomics.load(this.writePtr, 0);

    const availableWrite = this.availableWriteInternal(read, write);
    const toWrite = Math.min(availableWrite, elements.length);

    if (toWrite === 0) {
      return 0;
    }

    const writeIndex = write % this.capacity;
    const firstPart = Math.min(toWrite, this.capacity - writeIndex);
    const secondPart = toWrite - firstPart;

    // Write first part (from writeIndex to end of buffer or toWrite)
    this.storageView.set(elements.subarray(0, firstPart), writeIndex);

    // Write second part (wrap around to beginning)
    if (secondPart > 0) {
      this.storageView.set(elements.subarray(firstPart, toWrite), 0);
    }

    // Update write pointer atomically
    Atomics.store(this.writePtr, 0, write + toWrite);

    return toWrite;
  }

  /**
   * Pop elements from the ring buffer.
   * @param elements - Float32Array to fill with popped elements
   * @returns Number of elements actually read
   */
  pop(elements: Float32Array): number {
    const read = Atomics.load(this.readPtr, 0);
    const write = Atomics.load(this.writePtr, 0);

    const availableRead = this.availableReadInternal(read, write);
    const toRead = Math.min(availableRead, elements.length);

    if (toRead === 0) {
      return 0;
    }

    const readIndex = read % this.capacity;
    const firstPart = Math.min(toRead, this.capacity - readIndex);
    const secondPart = toRead - firstPart;

    // Read first part
    elements.set(this.storageView.subarray(readIndex, readIndex + firstPart));

    // Read second part (wrap around)
    if (secondPart > 0) {
      elements.set(this.storageView.subarray(0, secondPart), firstPart);
    }

    // Update read pointer atomically
    Atomics.store(this.readPtr, 0, read + toRead);

    return toRead;
  }

  /**
   * Write to the buffer using a callback.
   * Useful for interleaving audio data.
   * @param amount - Number of elements to write
   * @param callback - Function called with buffer regions to write to
   * @returns Number of elements actually written
   */
  writeCallback(
    amount: number,
    callback: (firstPart: Float32Array, secondPart: Float32Array) => void,
  ): number {
    const read = Atomics.load(this.readPtr, 0);
    const write = Atomics.load(this.writePtr, 0);

    const availableWrite = this.availableWriteInternal(read, write);
    const toWrite = Math.min(availableWrite, amount);

    if (toWrite === 0) {
      return 0;
    }

    const writeIndex = write % this.capacity;
    const firstPartLength = Math.min(toWrite, this.capacity - writeIndex);
    const secondPartLength = toWrite - firstPartLength;

    const firstPart = this.storageView.subarray(writeIndex, writeIndex + firstPartLength);
    const secondPart = this.storageView.subarray(0, secondPartLength);

    callback(firstPart, secondPart);

    Atomics.store(this.writePtr, 0, write + toWrite);

    return toWrite;
  }

  /**
   * Get number of elements available to read.
   */
  available_read(): number {
    const read = Atomics.load(this.readPtr, 0);
    const write = Atomics.load(this.writePtr, 0);
    return this.availableReadInternal(read, write);
  }

  /**
   * Get number of elements that can be written.
   */
  available_write(): number {
    const read = Atomics.load(this.readPtr, 0);
    const write = Atomics.load(this.writePtr, 0);
    return this.availableWriteInternal(read, write);
  }

  /**
   * Get the total capacity of the buffer.
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Reset the buffer to empty state.
   */
  reset(): void {
    Atomics.store(this.readPtr, 0, 0);
    Atomics.store(this.writePtr, 0, 0);
  }

  private availableReadInternal(read: number, write: number): number {
    return write - read;
  }

  private availableWriteInternal(read: number, write: number): number {
    return this.capacity - (write - read);
  }
}
