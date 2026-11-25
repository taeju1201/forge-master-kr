# APK 내장 설정 재현

이 도구는 사용자 제공 Forge Master **2.11.1 APK의 `SharedGameConfig.mpa`**를
77개의 JSON 테이블로 옮긴다. 숫자, 불리언, 문자열은 APK의 MPC 바이트에서
읽는다. 필드명·열거형 이름·다형 객체 이름은 아래 참조 스키마와 대응시킨다.

- 참조 저장소: <https://github.com/1vcian/fm>
- 고정 커밋: `8324dd087250f53fe97dd76b511c1da9b58a758d`
- 스키마: `public/parsed_configs/2026_10_27_09_45`
- `schema-lock.json`은 필요한 77개 참조 파일의 SHA-256을 고정한다. 다른
  스냅샷이나 변경된 스키마를 주면 비교와 변환을 중단한다.

**APK 내장 설정과 현재 서버의 설정이 같다고 주장하지 않는다.** 게임은
서버에서 설정을 추가로 받을 수 있다. 스키마 이름을 빌리더라도 해당
스냅샷의 수치로 APK 값을 덮어쓰지 않는다.

## 요구 사항과 입력

Python 3.10 이상과 표준 라이브러리만 필요하다. UnityPy는 이 설정 변환에는
필요하지 않다. 원본 APK/XAPK는 작업 디렉토리에 보관하고 Git에 추가하지 않는다.
명령은 KR 저장소 루트에서 실행한다. 입력·출력 경로에는 기본값이 없다.

다음 경로를 실제 파일 위치로 지정한다. `FM_SCHEMA`는 위 커밋에서 가져온
스키마 디렉토리여야 한다.

```bash
FM_PACKAGE=/absolute/path/Forge_Master_2.11.1.xapk
FM_WORK=/absolute/path/fm2111-extraction
FM_SCHEMA=/absolute/path/fm-upstream/public/parsed_configs/2026_10_27_09_45
```

## 1. APK/XAPK에서 MPA 추출

다음 명령은 APK를 그대로 읽거나 XAPK의 manifest가 지정한 `base` APK를 읽는다.
XAPK라면 표시되는 게임 버전을 확인한다. 일반 APK의 버전은 Android manifest
또는 Unity PlayerSettings에서 따로 확인한다. 뒤의 `--game-version` 인수는
호출자가 확인한 버전을 기록하며, MPA 헤더에서 게임 버전을 추측하지 않는다.

```bash
python3 - "$FM_PACKAGE" "$FM_WORK/SharedGameConfig.mpa" <<'PY'
from io import BytesIO
import json
from pathlib import Path
import sys
from zipfile import ZipFile

source, output = map(Path, sys.argv[1:])
entry = 'assets/SharedGameConfig.mpa'
with ZipFile(source) as package:
    if entry in package.namelist():
        payload = package.read(entry)
    else:
        manifest = json.loads(package.read('manifest.json'))
        print('Game version:', manifest['version_name'])
        bases = [item['file'] for item in manifest['split_apks'] if item['id'] == 'base']
        if len(bases) != 1:
            raise ValueError('Expected exactly one base APK')
        with ZipFile(BytesIO(package.read(bases[0]))) as base:
            payload = base.read(entry)
if not payload.startswith(b'MCA!'):
    raise ValueError('Unexpected config archive signature')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_bytes(payload)
print(output)
PY
```

## 2. 압축된 MPC 테이블 추출

```bash
python3 scripts/apk_config/extract_mpa.py \
  --source "$FM_WORK/SharedGameConfig.mpa" \
  --output-dir "$FM_WORK/mpc" \
  --manifest "$FM_WORK/extraction-manifest.json"
```

`MCA!` 버전 5의 디렉토리와 압축 길이를 확인한 뒤 raw-deflate를 해제한다.
예상하지 않은 압축 방식, 잘린 스트림, 중복 이름, 설명되지 않는 남은 바이트는
오류다. 원본 아카이브와 각 압축·해제 payload의 해시를 manifest에 남긴다.
MPA의 128비트 archive hash는 별도 원본 식별자이며 SHA-256으로 바꿔 부르지 않는다.

## 3. 태그 구조를 무손실 검증

```bash
python3 scripts/apk_config/tagged_wire.py \
  --input-dir "$FM_WORK/mpc" \
  --output-dir "$FM_WORK/numeric-tables" \
  --manifest "$FM_WORK/numeric-manifest.json"
```

각 테이블의 전체 바이트를 소비하고 다시 직렬화한 바이트가 원본과 정확히
같은지 검사한다. 모르는 wire type, 비정상 필드 태그, 지원하지 않는 표현은
중단한다. 출력의 숫자 태그와 `_type_code`는 진단용이며 게임의 표시 이름이 아니다.
특히 일반 zigzag 보기만으로 unsigned 필드나 고정 소수점 값을 해석하면 안 된다.

## 4. 참조와 실제 차이 확인

```bash
python3 scripts/apk_config/compare_named_json.py \
  --input-dir "$FM_WORK/mpc" \
  --schema-dir "$FM_SCHEMA" \
  --report "$FM_WORK/comparison.json" \
  --schema-report "$FM_WORK/schema-correlations.json"
```

배열 길이, 객체 구성, 멤버 태그 대응, 숫자·문자열을 대조한다. 열거형 코드와
참조 이름의 대응은 같은 문맥에서 일관돼야 한다. 이 과정은 대응 스키마의
이름을 사용한 검증이며, 모든 열거형 선언을 IL2CPP에서 독립 복원했다는 뜻은 아니다.
참조와 숫자가 다른 것은 유효한 비교 결과다.

## 5. APK 값을 유지한 이름 있는 JSON 생성

```bash
python3 scripts/apk_config/build_named_tables.py \
  --input-dir "$FM_WORK/mpc" \
  --schema-dir "$FM_SCHEMA" \
  --output-dir "$FM_WORK/named-tables" \
  --archive-manifest "$FM_WORK/extraction-manifest.json" \
  --manifest "$FM_WORK/named-manifest.json" \
  --schema-manifest "$FM_WORK/named-schema.json" \
  --game-version 2.11.1
```

77개 모두에서 무손실 디코딩, 참조 스키마의 해시·구조, 추출 manifest의 MPC
해시를 확인한 후 JSON을 출력한다. 참조와 다른 수치는 APK 값으로 유지한다.
참조가 빈 문자열로 표현한 원본 null 문자열도 null로 보존한다.

### 수치 해석 근거

| 표현 | 변환 |
| --- | --- |
| 일반 wire 2 | signed zigzag 정수. 불리언은 관찰된 0/−1 표현만 허용 |
| wire 7 | big-endian signed Q32.32, `raw / 2^32` |
| wire 8 | Q32.32 좌표 두 개 |
| F1D | unsigned varint를 복원한 후 APK metadata의 `Multi = 100`으로 나눔 |
| FD6 | 관찰된 UInt64 두 word를 128비트 값으로 결합한 후 `Precision = 1000000`으로 나눔 |
| MetaDuration | 단일 signed `Milliseconds` 필드 |

F1D는 APK metadata v31에서 `EnemyAgeScalingConfig.get_Damage/get_Health`의
반환 타입이 F1D인 것과 `F1D.get_Raw`의 반환 타입이 UInt64인 것을 확인했다.
따라서 첫 Damage payload `e8 07`은 unsigned 원시값 1000, 게임값 10이다.
진단용 zigzag 보기의 500을 게임값으로 쓰거나 임의 배율로 맞춘 결과가 아니다.
원본 타입·상수의 method/field index는 출력 manifest에 기록한다.

MPA typed tree에 대한 round-trip은 바이트 단위로 정확하다. 일반 JSON의
고정 소수점 숫자는 Python/JavaScript 부동 소수점 표현으로 투영되므로,
원시 비트가 필요하면 원본 MPC와 추출 manifest도 함께 보관한다.

## 확인된 2.11.1 결과

검사한 내장 MPA는 84,215 bytes, SHA-256
`1415ce389e9771769f103eca03f02e10f71603f79f845303a3b0ae30d1a66c6c`이다.
아카이브 생성 시각은 `2026-10-20T11:38:07.060Z`이며, 게임 배포 버전과
원본 스냅샷 폴더의 날짜를 같은 것으로 취급하지 않는다.

77개 테이블 모두 디코딩과 바이트 round-trip을 통과했다. 10월 27일 참조와
71개 테이블의 수치·구성이 같고, 아래 6개에는 실제 APK 수치 차이 31건이 있다.

| 테이블 | 다른 수치 수 |
| --- | ---: |
| AchievementLibrary | 7 |
| AscensionStarsBonusLibrary | 12 |
| GuildBaseConfig | 1 |
| GuildTechRaceRewardLibrary | 7 |
| MissionRallyTimeLibrary | 1 |
| WorldIndexConfigLibrary | 3 |

이 차이를 서버 스냅샷의 값으로 수정하지 않는다. 변환된 값의 출처는
**사용자 제공 APK의 내장 설정**이다.
