# Feature Specification: Multi-Kind Media Load Inputs

**Feature Branch**: `002-multi-input-types`  
**Created**: 2025-03-23  
**Status**: Draft  
**Input**: User description: "VEGA를 사용하는 사용자들은 File/Blob, ArrayBuffer/Uint8Array, URL, ReadableStream을 입력으로 사용할 수 있어야 한다."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load from files and in-memory binary data (Priority: P1)

As an integrator, I want to pass **File**, **Blob**, **ArrayBuffer**, or **Uint8Array** (and other byte views over the same buffer) as the media source when loading the player, so that I can play content from a file picker, generated blobs, or decoded buffers without converting everything into a single non-standard shape.

**Why this priority**: These are the most common ways to hold MP4 bytes in the browser; supporting them removes friction for apps that already have bytes in memory or from user selection.

**Independent Test**: For each supported binary shape, load a known-good MP4 sample and verify metadata loads and playback can start.

**Acceptance Scenarios**:

1. **Given** a valid MP4 as a **File**, **When** the user loads it into the player, **Then** the player reports media metadata and can reach a ready-to-play state.
2. **Given** a valid MP4 as a **Blob**, **When** the user loads it, **Then** behavior matches the File case for metadata and readiness.
3. **Given** a valid MP4’s bytes in an **ArrayBuffer** or **Uint8Array**, **When** the user loads that buffer, **Then** behavior matches the Blob case for metadata and readiness.

---

### User Story 2 - Load from a URL (Priority: P2)

As an integrator, I want to pass a **URL**—either as a string or as a standard **URL** object—so that the player can load media the same way users think about “open this link,” including `blob:` and `http(s):` URLs where the environment allows.

**Why this priority**: Many apps already store sources as URLs; aligning with the web URL type avoids extra string handling and matches platform APIs.

**Independent Test**: Load the same reference MP4 via an `http(s)` URL string, then via a `URL` instance pointing at the same resource; verify equivalent readiness.

**Acceptance Scenarios**:

1. **Given** a string URL that resolves to a valid MP4 in the current environment, **When** the user loads it, **Then** the player reaches a ready state with correct duration/track info (when present in the file).
2. **Given** a `URL` object equivalent to that string, **When** the user loads it, **Then** outcomes match the string URL case.

---

### User Story 3 - Load from a byte stream (Priority: P3)

As an integrator, I want to pass a **ReadableStream** of bytes representing the media, so that I can pipe data from fetch, workers, or other producers without buffering the entire file first when streaming is appropriate.

**Why this priority**: Streaming inputs enable progressive delivery and integration with modern async data sources; it is additive after blob/buffer and URL paths work.

**Independent Test**: Provide a `ReadableStream` that yields the same MP4 bytes as in Story 1; verify load completes and playback can start.

**Acceptance Scenarios**:

1. **Given** a `ReadableStream` whose chunks assemble a valid MP4, **When** the user loads it, **Then** the player can complete load and expose metadata consistent with loading the same bytes as a Blob.

---

### Edge Cases

- What happens when the URL is invalid, the resource is missing (404), or CORS/network policy blocks reading? The player should fail with a clear error and a stable error state, not hang indefinitely.
- What happens when a **ReadableStream** errors mid-read or is canceled? The load should fail predictably and release resources where possible.
- What happens when **ArrayBuffer**/**Uint8Array** is empty or truncated? The player should report failure rather than appearing ready with no playable content.
- What happens when the bytes are not a supported container/codec? The player should surface the same class of error as for unsupported files today (clear failure, no silent blank playback).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The player MUST accept **File** as a load input and treat its contents as the media source.
- **FR-002**: The player MUST accept **Blob** as a load input and treat its contents as the media source.
- **FR-003**: The player MUST accept **ArrayBuffer** as a load input representing the full media byte sequence.
- **FR-004**: The player MUST accept **Uint8Array** (and, when supplied, other `ArrayBufferView` types that reference the same logical byte sequence) as a load input equivalent to passing the underlying buffer for load purposes.
- **FR-005**: The player MUST accept a resource locator as **string URL** or as a **`URL` object** (same semantics as the web platform URL type) as a load input, subject to environment fetch and security rules.
- **FR-006**: The player MUST accept a **ReadableStream** whose chunks are interpreted as a byte sequence of the media (e.g. `ReadableStream<Uint8Array>` in typical environments) as a load input.
- **FR-007**: For every input kind in FR-001–FR-006, if the payload is not valid or not playable media, the player MUST surface a clear failure consistent with existing invalid-media behavior (no silent success).
- **FR-008**: Existing load inputs that the product already supports (e.g. URL string and/or **File**/**Blob** as today) MUST remain supported; this feature extends rather than narrows accepted inputs.

### Key Entities

- **Load input**: The value passed when starting a load—one of the accepted shapes (file-like object, in-memory bytes, URL, or byte stream).
- **Media byte sequence**: The contiguous bytes of the container file (e.g. MP4) interpreted by the player, regardless of whether they arrived from file, buffer, fetch, or stream.
- **Playback session**: Same as the existing product concept: load, decode, optional processing, and output for one source.

## Assumptions

- “User” in the original request means **developers or integrators** using VEGA in a browser or browser-like runtime where **File**, **Blob**, **ArrayBuffer**, **Uint8Array**, **URL**, and **ReadableStream** exist and behave per web platform conventions.
- The media format expectations match the existing product (e.g. MP4 as in the baseline specification); new inputs are **delivery shapes** for the same kind of media, not a new codec mandate.
- **ReadableStream** support assumes the stream eventually provides the full byte sequence required for demux/decode, unless a future feature explicitly defines true progressive demux; until then, failure modes for incomplete streams are acceptable if clearly reported.
- URL loading respects the same-origin, CORS, and mixed-content constraints of the host environment; the player cannot bypass them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For one reference media asset, integrators can complete a successful load using every delivery form required in FR-001 through FR-006 (where the host environment allows fetching or streaming), without introducing a project-specific wrapper type solely to satisfy the loader.
- **SC-002**: For invalid or unreachable sources (bad locator, empty binary payload, corrupt media bytes), every delivery form in FR-001 through FR-006 surfaces a detectable error within the same order of magnitude of time as today’s baseline loader failures for comparable cases (no indefinite hang under normal network conditions).
- **SC-003**: Published guidance lists accepted delivery forms and environment limitations (e.g. streams must supply a complete decodable byte sequence, URL access follows host security rules) so integrators can choose a supported form on first attempt; readiness is confirmed by documentation review or support-ticket trend review.
- **SC-004**: Integrators who already load media successfully today can do so without changing their code for the same sources (backward compatibility).
