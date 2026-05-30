# WWDC 한글 번역

WWDC 영상 페이지의 영어 자막 전문을 읽어 한국어로 번역하고, 비디오 위에 동기화된 자막 오버레이를 띄우는 Chrome 확장 프로그램입니다.

## 왜 만드는가

Apple Developer의 WWDC 강의 중에는 한국어 자막이 없는 영상이 많습니다. 이 확장 프로그램은 사용자가 영상을 보면서 별도 탭이나 번역기를 열지 않아도 되도록, WWDC 페이지의 기존 영어 자막을 한국어로 실시간 번역해 표시합니다.

## 주요 기능

- WWDC 영상 페이지 자동 감지
- Apple Developer 페이지에 포함된 transcript 기반 자막 추출
- 비디오 재생 시간에 맞춘 한국어 번역 자막 표시
- 한국어/영어 동시 표시, 한국어만 표시, 영어만 표시 모드
- 한국어 자막을 영어 자막 위 또는 아래에 배치하는 옵션
- 전체 자막 크기, 한국어 크기, 영어 크기 개별 조절
- 자막의 세로 위치 조절
- 자막 켜기/끄기 단축키
  - macOS: `Option+Shift+S`
  - Windows/Linux: `Alt+Shift+S`
- 자막이 함께 보이는 별도 전체화면 모드
  - macOS: `Option+Shift+F`
  - Windows/Linux: `Alt+Shift+F`
- 동일한 문장을 반복 번역하지 않도록 번역 결과 캐시
- Chrome 내장 번역과 여러 cloud 번역 API 선택 지원
- API 키와 설정을 브라우저 로컬 저장소에 저장

## 지원 범위

현재는 Apple Developer의 WWDC 영상 페이지를 우선 지원합니다.

지원 URL 예시:

- `https://developer.apple.com/videos/play/wwdc2021/10022/`
- `https://developer.apple.com/kr/videos/play/wwdc2021/10022/`

이 확장 프로그램은 범용 웹페이지 번역기가 아니라 WWDC 영상 자막 시청 경험에 집중합니다.

## 현재 구현 방식

Apple Developer 영상 페이지에는 HLS 영상 URL뿐 아니라, 페이지 하단의 "Transcript / 자막 전문" 영역에 자막 문장이 HTML로 이미 포함되어 있습니다.

예시 구조:

```html
<section id="transcript-content">
  <span class="sentence">
    <span data-start="9.0">Matt Ricketson: Hi, I'm Matt, </span>
  </span>
  <span class="sentence">
    <span data-start="10.0">and later on I'll be joined by Luca and Raj.</span>
  </span>
</section>
```

그래서 MVP에서는 HLS의 `subtitles/eng/prog_index.m3u8`나 WebVTT 조각을 직접 파싱하지 않습니다. 대신 content script가 `#transcript-content [data-start]`를 읽고, `data-start`를 기준으로 자막 세그먼트를 만듭니다.

구현 흐름:

1. WWDC 영상 페이지에서 `video` 요소를 찾습니다.
2. `#transcript-content [data-start]` 요소들을 읽습니다.
3. 짧게 쪼개진 transcript 조각을 문장부호, 시간 간격, 길이를 기준으로 적당한 자막 세그먼트로 묶습니다.
4. 비디오의 `currentTime`과 세그먼트의 `start/end`를 비교해 현재 자막을 찾습니다.
5. 현재 재생 위치 주변의 세그먼트만 lazy translate합니다.
6. 번역 결과를 `chrome.storage.local`에 캐시합니다.
7. 영상 위에 한국어/영어 자막 오버레이를 렌더링합니다.

이 방식의 장점:

- HLS playlist와 segment format 변화에 덜 민감합니다.
- Apple 페이지에 이미 렌더링된 transcript를 사용하므로 구현이 단순합니다.
- 전체 영상을 한 번에 번역하지 않고 현재 위치 근처만 번역해 API 비용을 줄일 수 있습니다.
- 같은 영상/같은 provider/같은 문장은 캐시를 재사용합니다.

주의할 점:

- Apple이 transcript DOM 구조를 바꾸면 파서 수정이 필요합니다.
- transcript가 없는 영상은 MVP에서 지원하지 않습니다.
- 자막 end time은 transcript에 직접 들어있지 않으므로 다음 `data-start` 또는 추정 duration으로 계산합니다.

## 디렉터리 구조

```text
AGENTS.md
README.md
package.json
public/
  manifest.json
  content/content-style.css
  options/
  popup/
src/
  background/service-worker.ts
  content/content-script.ts
  providers/cloud-providers.ts
  shared/
  subtitles/
```

주요 파일:

- `src/content/content-script.ts`: WWDC 페이지 감지, transcript 파싱, 비디오 시간 동기화, 오버레이 렌더링, lazy translation
- `src/subtitles/transcript.ts`: Apple transcript DOM을 자막 세그먼트로 변환
- `src/subtitles/matching.ts`: 현재 재생 시간에 맞는 자막 찾기
- `src/background/service-worker.ts`: cloud 번역 provider 호출 처리
- `src/providers/cloud-providers.ts`: Azure, Google, DeepL, Papago, AWS, LibreTranslate adapter
- `public/options/index.html`: API 키와 자막 설정 화면
- `public/popup/index.html`: 빠른 켜기/끄기와 provider 선택

## 번역 API 리스트

조사 기준일: 2026-05-30.

| 우선순위 | Provider | 무료 사용 경로 | 유료 경로 | 공식 문서 |
| --- | --- | --- | --- | --- |
| 1 | Chrome built-in Translator API | Chrome 지원 환경에서 브라우저 내장 모델 사용 | 별도 API 과금 없음 | https://developer.chrome.com/docs/ai/translator-api |
| 2 | Azure AI Translator | F0 기준 월 200만 문자 무료 | Azure Translator 유료 tier | https://azure.microsoft.com/en-us/pricing/details/translator/ |
| 3 | Google Cloud Translation | 월 50만 문자 무료 크레딧 | NMT 기준 초과분 과금 | https://cloud.google.com/translate/pricing |
| 4 | DeepL API | API Free 기준 월 50만 문자 | API Pro/Growth | https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans |
| 5 | NAVER Cloud Papago | 현재 공식 가격표 기준 명확한 무료 API tier 없음 | Text Translation API 20,000원/100만 글자, VAT 별도 | https://www.ncloud.com/charge/price/us |
| 6 | AWS Translate | 첫 요청 후 12개월 동안 월 200만 문자 | Standard text 기준 $15/100만 문자 | https://aws.amazon.com/translate/pricing/ |
| 7 | LibreTranslate | self-host 가능 | hosted instance별 정책 다름 | https://docs.libretranslate.com/ |

MVP 기본 추천 순서:

1. Chrome built-in Translator API
2. Azure AI Translator
3. Google Cloud Translation
4. DeepL
5. Papago

## Google 번역 사용 방침

일부 확장 프로그램은 비공식 Google Translate 웹 엔드포인트를 사용해 무료처럼 동작합니다. 이 프로젝트에서는 그 방식을 기본 provider로 넣지 않습니다.

사용하는 Google 계열 방식:

- Chrome built-in Translator API
- 공식 Google Cloud Translation API

이유:

- 비공식 엔드포인트는 예고 없이 깨질 수 있습니다.
- 약관 리스크가 있습니다.
- Chrome Web Store 심사 리스크가 커질 수 있습니다.
- 사용자가 데이터 처리 방식을 명확히 이해하기 어렵습니다.

## 로컬에서 실행하기

필요 조건:

- Node.js 20 이상 권장
- Chrome 또는 Chromium 계열 브라우저

설치:

```bash
npm install
```

빌드:

```bash
npm run build
```

Chrome에 로드:

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 오른쪽 위의 `Developer mode`를 켭니다.
3. `Load unpacked`를 클릭합니다.
4. 이 프로젝트의 `dist` 폴더를 선택합니다.
5. Apple Developer WWDC 영상 페이지를 엽니다.
   - 예: `https://developer.apple.com/videos/play/wwdc2021/10022/`
   - 예: `https://developer.apple.com/kr/videos/play/wwdc2021/10022/`

설정:

1. 확장 프로그램 아이콘을 클릭합니다.
2. 기본 provider는 `Chrome 내장 번역`입니다.
3. cloud provider를 쓰려면 `API 키 설정`을 열고 해당 provider의 키를 입력합니다.
4. 자막 모드, 한국어 위치, 전체/한국어/영어 글자 크기, 세로 위치를 조절합니다.
5. 캡처할 때는 popup의 `자막 켜기`를 끄거나 단축키를 눌러 자막을 숨기고, 다시 볼 때 켭니다.
6. WWDC 영상 페이지를 새로고침합니다.

단축키:

- macOS 기본값: `⌥⇧S` (`Option+Shift+S`)
- Windows/Linux 기본값: `Alt+Shift+S`
- 동작: `자막 켜기` 설정을 토글합니다.
- 변경: Chrome에서 `chrome://extensions/shortcuts`를 열고 `WWDC 한글 번역`의 단축키를 바꿉니다.

자막 포함 전체화면:

- Apple 기본 전체화면 버튼은 `video` 요소만 native fullscreen으로 올릴 수 있어, 페이지 DOM에 붙은 자막 오버레이가 보이지 않을 수 있습니다.
- 이 확장은 `.developer-video-player` 전체를 fullscreen으로 올리는 `자막 전체화면`을 별도로 제공합니다.
- 영상 오른쪽 위의 `⛶` 버튼을 누르면 가장 안정적으로 동작합니다.
- popup의 `자막 전체화면` 버튼 또는 `⌥⇧F` / `Alt+Shift+F`도 제공하지만, 브라우저 fullscreen 정책이나 단축키 충돌에 따라 막힐 수 있습니다.

## 개발 명령어

```bash
npm run build
npm run typecheck
npm run test
```

`npm run build`는 TypeScript 타입체크를 먼저 수행한 뒤, esbuild로 content script/background/popup/options entry를 번들링하고, `public` 폴더의 manifest/options/popup/css/icon 파일을 `dist`로 복사합니다. MV3 content script는 ES module import를 그대로 두면 로드가 깨질 수 있어, `dist/content/content-script.js`는 단일 IIFE 파일로 번들링합니다.

## 배포 준비

Chrome Web Store에 업로드할 zip은 `manifest.json`이 zip의 최상위에 있어야 합니다. `dist` 폴더 자체를 zip 안에 넣으면 Web Store가 패키지를 제대로 읽지 못할 수 있습니다.

```bash
npm run build
cd dist
zip -r ../wwdc-korean-translation.zip .
cd ..
```

업로드 파일:

- `wwdc-korean-translation.zip`

스토어 등록에 필요한 기본 항목:

- 이름: `WWDC 한글 번역`
- 요약: `WWDC 영상의 영어 자막을 한국어로 실시간 번역해 영상 위에 표시합니다.`
- 카테고리: `생산성`
- 언어: `한국어`
- 스토어 아이콘: `dist/icons/icon128.png`
- 스크린샷: `screenshot-1280x800.jpg`
- 개인정보처리방침: `PRIVACY.md`를 공개 URL로 게시한 뒤 해당 URL 입력

## 현재 제한 사항

- transcript DOM이 없는 영상은 아직 지원하지 않습니다.
- Chrome built-in Translator API는 Chrome 버전과 환경에 따라 사용할 수 없을 수 있습니다.
- cloud provider는 사용자가 직접 API 키를 넣어야 합니다.
- AWS Translate는 브라우저에서 SigV4 서명을 수행하므로, 실제 배포 전에 권한/키 관리 UX를 더 신중히 다듬어야 합니다.
- 자막 end time은 Apple transcript에 명시되어 있지 않아 다음 시작 시간 기준으로 추정합니다.

## 개인정보와 키 저장

- API 키는 `chrome.storage.local`에 저장합니다.
- production code에서 API 키나 전체 자막을 로그로 남기지 않는 것을 원칙으로 합니다.
- MVP에서는 별도 analytics를 수집하지 않습니다.

## Chrome Web Store 스크린샷 변환

Chrome Web Store 캡처화면은 정확히 `1280x800` 또는 `640x400`이어야 합니다. Retina 캡처처럼 `5120x3200`으로 저장된 이미지는 비율이 맞아도 거절됩니다.

기본 입력 파일 `screenshot.png`를 `screenshot-1280x800.jpg`로 변환:

```bash
sh scripts/store-screenshot.sh
```

입력/출력 파일을 직접 지정:

```bash
sh scripts/store-screenshot.sh screenshot.png screenshot-1280x800.jpg
```

`npm`으로 실행하고 싶으면 같은 스크립트를 호출하는 아래 명령도 사용할 수 있습니다.

```bash
npm run store:screenshot
```
