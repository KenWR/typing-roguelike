# 생성 프롬프트 규칙

모든 아이콘은 내장 ImageGen을 사용해 다음 공통 프롬프트 세트로 생성했습니다.

```text
Use case: stylized-concept
Asset type: pixel-art weapon inventory icon
Style: authentic hand-pixeled 2D game inventory icon
Grid: 48×48 logical pixel grid, nearest-neighbor upscale 4× for a 192×192 source
Rendering: chunky deliberate pixel clusters, limited 12-color palette,
1-pixel dark outline on the logical grid, no anti-aliasing, no smooth gradients
Background: genuine alpha transparency
Composition: exactly one weapon, centered diagonally from bottom-left to top-right,
occupying about 80% of the square and readable at 96×96
Avoid: frame, text, watermark, hands, scenery, cropping, painting, vector smoothness,
photorealism and blur
```

각 아이콘의 `Subject`는 `manifest.csv`의 장비 이름과 장비 문서의 콘셉트에 맞게 개별 지정했습니다. 일반 장비는 단순한 재질과 실루엣, 고등급 장비는 이름을 대표하는 색·핵심 장식만 크게 표현했습니다.
