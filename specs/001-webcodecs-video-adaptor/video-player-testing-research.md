# 동영상 플레이어 라이브러리 테스트 방식 조사 및 Vega 재생 검증 방안

**목적**: 다른 Video Player 라이브러리의 테스트 코드 방식을 상세 조사하고, Vega 프로젝트에서 동영상 재생을 어떻게 검증할지 정리한다.

---

## 1. 다른 라이브러리 테스트 방식 요약

### 1.1 Video.js

- **테스트 러너**: Karma (실제 브라우저에서 실행).
- **역사**: 초기에는 PhantomJS + Grunt, 이후 **실제 브라우저**에서 단위 테스트 실행으로 전환 (Karma 연동).
- **실행**: `grunt karma:dev`, `test/karma.conf.js`에서 브라우저 목록 설정.
- **특징**: 단위 테스트를 브라우저 환경에서 돌려서 HTML5 비디오/미디어 API와 DOM을 실제로 사용. 여러 브라우저 대상 테스트 지원.
- **재생 검증**: 공개 문서상으로는 “실제 브라우저에서 단위 테스트”에 초점; 구체적 E2E/재생 시나리오 문서는 제한적.

### 1.2 hls.js

hls.js는 **단위 테스트**와 **기능(재생) 테스트**를 분리해서 둘 다 사용한다.

#### 단위 테스트 (Karma + Mocha + ChromeHeadless)

- **위치**: `tests/unit/`, `karma.conf.js`.
- **번들**: Rollup으로 테스트 진입점(`tests/index.js`)을 하나의 브라우저 번들로 만든 뒤 Karma에서 로드.
- **브라우저**: `ChromeHeadless` (로컬/CI), 단일 실행(`singleRun: true`).
- **모킹**: **MockMediaElement**, **MockMediaSource** 등으로 `HTMLMediaElement`/`MediaSource`를 대체.
- **검증 대상**: 버퍼 컨트롤러, 이벤트 플로우, 트랙/코덱 처리, SourceBuffer 생성/플러시 등 **로직과 상태**. 실제 네트워크/디코딩/화면 출력은 하지 않음.
- **예시** (`tests/unit/controller/buffer-controller.ts`):
  - `bufferController.media = new MockMediaElement()`, `mediaSource = new MockMediaSource()`.
  - `hls.trigger(Events.BUFFER_CODECS, { video: {...} })` 등으로 이벤트를 주입하고, `expect(createSbStub).to.have.been.calledOnce` 같은 **동작/호출 검증**.

#### 기능(Functional) 테스트 (Selenium WebDriver + Mocha)

- **위치**: `tests/functional/auto/setup.js`, `tests/functional/auto/index.html`.
- **실행**: `npm run test:func` (로컬 Chrome) 또는 `test:func:sauce` (Sauce Labs).
- **환경**: 로컬에서는 `http-server`로 서버 띄우고, Chromedriver로 브라우저 제어. 스트림 URL 목록은 `tests/test-streams`에서 가져옴.
- **재생 검증 방식** (실제 HLS 스트림을 로드한 뒤 브라우저 내에서 검증):
  1. **loadeddata**: `video.onloadeddata`가 발생하면 “로드 성공”으로 간주.
  2. **재생 중인지**: `FRAG_CHANGED` 후 일정 시간 뒤 `video.currentTime`가 증가했는지 확인 (`currentTime !== video.currentTime`).
  3. **버퍼**: `video.buffered`, `maxBufferLength` 등으로 버퍼가 기대만큼 쌓였는지 검사.
  4. **seek (VOD)**: `video.currentTime = seekToTime` 설정 후 `video.onseeked` 발생, 이후 `MEDIA_ENDED`까지 재생되면 성공.
  5. **seek (Live)**: `video.currentTime = video.seekable.end(0) - 5` 후 `onseeked` 발생 확인.
- **특징**: **실제 미디어 엘리먼트**와 **실제 스트림 URL**을 사용하고, **이벤트**와 **currentTime/buffered** 같은 **상태 변화**로 “재생이 됐다”를 판단. 픽셀/캔버스 비교는 하지 않음 (출력이 `<video>`이기 때문).

### 1.3 공통 패턴 정리

| 구분 | Video.js | hls.js (unit) | hls.js (func) |
|------|-----------|----------------|---------------|
| 환경 | 실제 브라우저 (Karma) | ChromeHeadless (Karma) | 실제 브라우저 (Selenium) |
| 미디어 | 실제/모킹 혼용 가능 | MockMediaElement/Source | 실제 `<video>` + 실제 스트림 |
| “재생 검증” | 단위 수준 | 이벤트/스텁 검증 | loadeddata, currentTime 증가, seeked, ended |
| 픽셀/캔버스 | 없음 | 없음 | 없음 (video 엘리먼트) |

즉, **재생 검증**은 대부분 다음으로 이뤄진다:

- **로드 완료**: `loadeddata`(또는 유사) 이벤트.
- **실제로 재생 중**: 일정 시간 후 `currentTime`가 이전보다 커짐.
- **seek 동작**: `currentTime` 변경 후 `seeked`(또는 유사) 이벤트, 이후 재생 재개.
- **끝까지 재생**: `ended` 이벤트 또는 `currentTime`가 duration 근처까지 진행.

---

## 2. Vega와의 차이: Canvas + WebCodecs

Vega는 다음 때문에 기존 플레이어와 검증 포인트가 다르다.

- **비디오 출력**: `<video>`가 아니라 **Canvas**(2D/WebGL/WebGPU)에 그린다.
- **디코딩**: WebCodecs API로 **VideoFrame**을 만들고, 선택적으로 **어댑터**를 거쳐 렌더링한다.
- **오디오**: Web Audio API로 재생한다.

따라서 “동영상이 정말 재생되는가”를 검증하려면:

1. **상태/이벤트** (다른 플레이어와 유사): `load()` → `play()` → `state`, `currentTime`, `loadedmetadata`/`canplay`/`timeupdate`/`ended` 등.
2. **Canvas에 프레임이 그려졌는지**: 실제 디코딩 → 렌더링 파이프라인이 동작하는지 확인해야 함.
3. **(선택) 픽셀 수준 검증**: 참조 픽셀/이미지와 비교해 “올바른 화면”이 나오는지 검증 (이미 renderer-2d 테스트에서 RGBA fixture로 수행 중).

---

## 3. Vega에서 동영상 재생을 검증하는 방법

### 3.1 검증 수준 구분

- **Level 1 – 상태/이벤트만**:  
  `load(fixtureUrl)` → `play()` 후 `state === 'playing'`, `currentTime`가 증가, `timeupdate`/`seeked`/`ended` 등.  
  hls.js 기능 테스트와 유사. **실제 디코딩/캔버스 그리기**는 간접적으로만 보장.

- **Level 2 – Canvas에 무언가 그려짐**:  
  Level 1에 더해, 재생 구간 중 한 시점에 `canvas.getContext('2d').getImageData(...)`로 픽셀을 읽어, **전부 0이 아님**(또는 특정 영역이 비어 있지 않음)을 검사.  
  “디코딩 + 렌더링이 동작했다”는 것을 프로그램적으로 확인.

- **Level 3 – 픽셀 정합성 (참조와 비교)**:  
  알려진 프레임(예: 첫 I-frame을 디코딩한 RGBA)에 대해서만, `getImageData` 결과를 참조 픽셀 데이터와 비교 (허용 오차 가능).  
  이미 `renderer-2d.test.ts`에서 **raw 픽셀 fixture → VideoFrame → draw → getImageData**로 수행 중.  
  E2E에서는 “같은 fixture MP4를 로드해 특정 시점(또는 첫 프레임)의 canvas가 참조와 일치하는지”로 확장 가능.

### 3.2 권장 조합 (1종/2종 오류 최소화)

- **E2E 1 – 기본 재생 (필수)**  
  - `tests/fixtures/h264.mp4` URL을 사용해 `createVega` → `load()` → `play()`.  
  - `loadedmetadata` 또는 `canplay` 후 `mediaInfo`, `duration` 확인.  
  - 짧은 시간(예: 1~2초) 대기 후 `currentTime`가 0보다 크고, `state === 'playing'`.  
  - (선택) `timeupdate`가 한 번 이상 발생.  
  → **“로드되고 재생이 시작되며 시간이 흐른다”**를 검증. hls.js의 `testIsPlayingVOD`와 같은 역할.

- **E2E 2 – Canvas에 프레임이 그려짐 (Level 2)**  
  - 위와 동일하게 로드·재생 후, 일정 시간 뒤에 `canvas`에서 `getImageData`로 픽셀을 읽어,  
    예: 중앙 일부 영역이나 전체 픽셀 합이 0이 아님을 검사.  
  → **“실제로 디코딩된 프레임이 Canvas에 그려졌다”**를 검증. 2종 오류(재생 안 되는데 통과)를 줄임.

- **E2E 3 – Pause / Seek**  
  - 재생 중 `pause()` → `state === 'paused'`, `currentTime` 고정.  
  - `seek(time)` → `seeking`/`seeked` 이벤트, 이후 `currentTime` 근사치 일치.  
  - 필요 시 다시 `play()` 후 `currentTime`가 진행하는지 확인.  
  → spec의 “pause/seek 후 상태 갱신 및 재개” 검증.

- **E2E 4 – 어댑터 적용 시 재생**  
  - identity(또는 단순) 어댑터를 `setAdapter`로 설정한 뒤, 동일한 load/play.  
  - Level 1(상태/이벤트) 또는 Level 2(캔버스 비공백) 중 하나 이상 통과하면 “어댑터를 끼워도 재생이 된다”를 검증.

- **기존 유지 – 픽셀 정합성 (Level 3)**  
  - `renderer-2d.test.ts` 등에서 **raw fixture → VideoFrame → draw → getImageData 비교**는 그대로 두고,  
  - 필요하면 “같은 h264.mp4에서 특정 시점의 첫 프레임”을 참조 픽셀으로 두고 E2E에서 한 번만 비교하는 테스트를 추가할 수 있음.  
  - GPU/드라이버 차이를 고려해 **허용 오차**(예: WPT 스타일 `assert_approx_equals`)를 두는 것이 안전.

### 3.3 오디오 검증

- “소리가 난다”를 자동으로 검증하려면 오디오 캡처/분석이 필요해 설정이 무겁다.
- 실용적 최소: **오디오 트랙이 있는 소스**를 로드했을 때 `mediaInfo.audioTrack` 존재, `state`가 `ready`/`playing`으로 넘어가고, **에러가 나지 않는지**만 검사.  
  “실제로 스피커로 들린다”는 수준은 선택적으로만(별도 도구/환경) 도입 가능.

### 3.4 잘못된 파일 / 에러 처리

- 지원하지 않는 형식이나 깨진 파일을 `load()`에 넘겼을 때:
  - `load()`가 reject 하거나, `error` 이벤트가 발생하고 `state === 'error'`.
  - 에러 메시지/코드가 비어 있지 않음.
- 이걸 E2E 한 건으로 두면 “재생만 되는 경우”와 “명확히 실패하는 경우”를 구분할 수 있어 1종/2종 오류를 줄이는 데 도움이 된다.

---

## 4. 정리: 테스트 구조 제안

| 테스트 종류 | 목적 | 재생 검증 방식 |
|-------------|------|----------------|
| 기존 단위/통합 | 유틸, 렌더러 픽셀 정합성, 팩토리 | raw → VideoFrame → draw → getImageData (참조 픽셀 비교) |
| E2E – 기본 재생 | spec “로드 후 재생” | load(fixture MP4) → play → state, currentTime 증가, 이벤트 |
| E2E – Canvas 그리기 | 디코딩+렌더링 실제 동작 | 위 + getImageData로 비공백 픽셀 확인 |
| E2E – Pause/Seek | 제어 API | pause/seek 후 state, currentTime, seeking/seeked |
| E2E – 어댑터 | 커스텀 프레임 처리 | identity 어댑터 설정 후 재생·캔버스 검증 |
| E2E – 에러 | FR-006 | 잘못된 입력 → error 이벤트, state === 'error' |

다른 비디오 플레이어들은 주로 **이벤트 + currentTime/버퍼**로 재생을 검증하고, Vega는 **동일한 개념**에 **Canvas 픽셀(비공백 또는 참조 비교)**를 더해 “실제로 동영상이 재생되고 있다”를 더 확실히 검증할 수 있다.

이 문서는 `research.md` 및 `contracts/vega-api.md`의 테스트 전략을 구체화한 것이며, 실제 E2E 테스트 구현 시 위 시나리오를 기준으로 작성하면 된다.
