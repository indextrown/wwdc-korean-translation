# AGENTS.md

## 프로젝트

WWDC 영상 중에는 한국어 자막이 제공되지 않는 강의가 있다. 이 프로젝트는 WWDC 영상의 사용 가능한 자막 텍스트를 실시간으로 읽고, 한국어로 번역한 뒤, 영상 위에 조절 가능한 자막 오버레이로 보여주는 Chrome 확장 프로그램을 만든다.

우선 지원 대상:

- `developer.apple.com/videos/play/...`

제품명:

- WWDC 한글 번역

## 제품 목표

- 영어 자막만 있는 WWDC 영상에 읽기 좋은 한국어 자막을 제공한다.
- 사용자가 텍스트를 복사하거나, 다른 탭을 열거나, 영상을 계속 멈추지 않아도 되게 한다.
- 무료 사용 경로를 먼저 제공하고, 필요하면 더 안정적이거나 품질이 좋은 유료 API를 선택할 수 있게 한다.
- 별도 백엔드를 도입하기 전까지 API 키는 사용자의 브라우저 로컬에만 저장한다.

## MVP에서 하지 않을 일

- 처음부터 범용 웹페이지 번역기를 만들지 않는다.
- MVP에서는 음성 직접 번역을 하지 않는다. 먼저 기존 자막 또는 timed text track을 사용한다.
- 확장 프로그램 안에 공용 유료 API 키를 심지 않는다.
- 비공식 스크래핑 엔드포인트를 기본 번역 경로로 사용하지 않는다.

## MVP 범위

1. 지원 가능한 WWDC 영상 페이지를 감지한다.
2. 페이지 또는 비디오 플레이어에서 자막 소스를 찾는다.
3. timed text를 자막 세그먼트로 파싱한다.
4. 영어 자막 세그먼트를 한국어로 번역한다.
5. 다음 설정을 가진 자막 오버레이를 렌더링한다.
   - 켜기/끄기
   - 번역 제공자 선택
   - 자막 모드: 영어 + 한국어, 한국어만, 영어만
   - 자막 크기 조절
   - 자막 세로 위치 조절
6. 영상 id, 번역 제공자, 원문 언어, 대상 언어, 원문 텍스트 해시를 기준으로 번역 결과를 캐시한다.

## 선호 아키텍처

- Chrome Extension Manifest V3를 사용한다.
- Content script:
  - 페이지 감지
  - 자막 추출
  - 비디오 재생 시간 동기화
  - 오버레이 렌더링
- Service worker:
  - CORS 또는 host permission 때문에 background 요청이 필요한 번역 API 호출
  - rate limit 처리
  - 번역 요청 batching
- Options page:
  - 번역 제공자 설정
  - API 키 저장
  - 기본 자막 설정
- Storage:
  - API 키와 캐시는 `chrome.storage.local`에 저장한다.
  - secret은 절대 하드코딩하지 않는다.

번역 제공자는 작은 adapter로 분리하고, 공통 인터페이스를 맞춘다.

```ts
type TranslateProviderId =
  | "chrome_builtin"
  | "google_cloud"
  | "azure_translator"
  | "deepl"
  | "papago"
  | "aws_translate"
  | "libretranslate";

interface TranslateProvider {
  id: TranslateProviderId;
  label: string;
  requiresApiKey: boolean;
  translate(input: {
    texts: string[];
    sourceLanguage: "en" | "auto";
    targetLanguage: "ko";
  }): Promise<string[]>;
}
```

## 번역 API 후보

조사일: 2026-05-30.

| 우선순위 | 제공자 | 무료 경로 | 유료 경로 | 이 프로젝트와의 적합도 | 메모 |
| --- | --- | --- | --- | --- | --- |
| 1 | Chrome built-in Translator API | 지원 브라우저에서 로컬/브라우저 제공 모델 사용 가능 | 없음 | 사용 가능하면 가장 좋은 기본값 | Chrome desktop에서 runtime feature detection 필요. 개인정보와 비용 측면에서 좋지만 지원 여부와 언어쌍은 환경에 따라 달라질 수 있다. |
| 2 | Azure AI Translator | F0 기준 월 200만 문자 무료 | 무료 한도 초과 또는 S1 이상 유료 tier | 개인 사용자를 위한 가장 합리적인 cloud fallback | 무료 한도가 크고 공식 API다. 기본 cloud 제공자로 가장 유력하다. |
| 3 | Google Cloud Translation | 월 50만 문자 무료 크레딧 | NMT basic/advanced text 기준 초과분 $20/100만 문자 | 품질과 설정 친숙도가 좋음 | 비공식 Google Translate 웹 엔드포인트가 아니라 공식 Cloud Translation API만 사용한다. |
| 4 | DeepL API Free/Pro | API Free 기준 월 50만 문자 | API Pro/Growth 사용량 기반 요금 | 고품질 선택지 | 번역 품질은 강점이지만, WWDC 기술 자막의 영어->한국어 품질은 Google/Azure/Papago와 직접 비교해야 한다. |
| 5 | NAVER Cloud Papago Translation | 현재 가격 페이지 기준 명확한 무료 API tier 없음 | Text Translation API 20,000원/100만 글자, VAT 별도 | 한국어 번역 후보로 강함 | 영어->한국어 품질은 기대할 만하지만, 100만 글자 단위 올림 과금이라 소량 사용에는 불리할 수 있다. |
| 6 | AWS Translate | 첫 요청 후 12개월 동안 월 200만 문자 | Standard text 기준 $15/100만 문자 | AWS 사용자에게 유용 | 무료 tier가 시간 제한형이고, 일반 사용자에게 설정이 다소 무겁다. |
| 7 | LibreTranslate | self-hosted 오픈소스 경로 | hosted instance는 키/제한이 있을 수 있음 | privacy/dev 옵션 | 품질과 언어쌍 성능은 상용 API보다 약할 수 있다. 고급/self-hosted 옵션으로 둔다. |

MVP 권장 제공자 순서:

1. Chrome built-in Translator API
2. Azure AI Translator
3. Google Cloud Translation
4. DeepL
5. Papago

## Google API에 대한 입장

일부 확장 프로그램이나 패키지는 비공식 웹 엔드포인트를 통해 "무료 Google Translate"처럼 동작하는 경우가 있다. 이 프로젝트에서는 그것을 기본 경로로 사용하지 않는다.

사용 가능한 Google 계열 경로:

- 브라우저에서 지원하는 Chrome built-in Translator API
- 공식 Google Cloud Translation API

이유:

- 비공식 엔드포인트는 예고 없이 깨질 수 있다.
- 서비스 약관 위반 가능성이 있다.
- Chrome Web Store 심사 리스크가 커진다.
- 사용자가 데이터 처리 방식을 명확히 이해하기 어렵다.

## 비용 절감 규칙

- 타이밍이 크게 망가지지 않는 범위에서 짧은 자막 세그먼트를 묶어 cloud API에 요청한다.
- 반복되는 텍스트는 번역 전에 deduplication한다.
- 영상과 provider 기준으로 번역 결과를 적극적으로 캐시한다.
- 빈 문자열, speaker label만 있는 텍스트, 번역하면 안 되는 코드 조각은 요청하지 않는다.
- provider별 rate limit과 exponential backoff를 둔다.
- quota 초과 또는 API 키 오류는 사용자에게 명확하게 표시한다.

## 자막 UX 규칙

- 오버레이는 영상의 주요 컨트롤을 가리지 않아야 한다.
- 기본 모드는 한국어 자막을 크게 보여주고, 필요하면 영어 원문을 더 작은 줄로 함께 보여준다.
- 설정은 페이지에 주입한 UI에만 의존하지 말고, extension popup 또는 side panel에서도 접근 가능해야 한다.
- 자막 크기와 세로 위치는 조절 가능해야 한다.
- 설정은 탭 단위가 아니라 브라우저 로컬에 저장되어야 한다.

## 보안 및 개인정보

- API 키는 `chrome.storage.local`에 저장한다.
- production log에 API 키, 전체 자막, 번역 결과를 남기지 않는다.
- host permission은 좁게 유지한다.
  - Apple Developer 영상 페이지
  - 선택된 번역 API origin
- MVP에서는 analytics를 수집하지 않는다.
- 나중에 백엔드를 도입한다면 어떤 자막 텍스트가 왜 전송되는지 문서화한다.

## 개발 기준

- 확장 프로그램 코드는 TypeScript를 우선 사용한다.
- provider adapter는 독립적으로 테스트 가능하게 유지한다.
- DOM 통합 코드는 번역 로직과 분리한다.
- 자막 포맷 파싱은 가능하면 구조화된 parser를 사용하고, regex만으로 무리하게 처리하지 않는다.
- 다음 항목은 테스트를 추가한다.
  - 자막 파싱
  - provider batching/deduplication
  - cache key 생성
  - 현재 재생 시간에 맞는 자막 매칭

## 초기 파일/디렉터리 방향

구현을 시작하면 다음 구조를 기준으로 삼는다.

```text
src/
  background/
  content/
  options/
  popup/
  providers/
  subtitles/
  storage/
public/
tests/
manifest.json
```

## 조사 출처

- Chrome built-in Translator API: https://developer.chrome.com/docs/ai/translator-api
- Google Cloud Translation pricing: https://cloud.google.com/translate/pricing
- Azure AI Translator pricing: https://azure.microsoft.com/en-us/pricing/details/translator/
- DeepL API plans: https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans
- AWS Translate pricing: https://aws.amazon.com/translate/pricing/
- NAVER Cloud Papago pricing: https://www.ncloud.com/charge/price/us
- NAVER Cloud Papago API guide: https://guide.ncloud-docs.com/docs/en/papagotranslation-api
- LibreTranslate docs: https://docs.libretranslate.com/
