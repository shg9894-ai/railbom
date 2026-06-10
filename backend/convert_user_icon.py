"""사용자 제공 아이콘에서 흰/회색 여백을 자동 제거 후 PWA 사이즈로 변환.

원본 이미지 분석:
- 2816x1536, RGBA지만 알파는 전부 255
- 4 코너가 (~240, ~248, ~248) 흰/회색 — 흰색 배경 위에 카드형 아이콘
- 가운데에 둥근 사각형 파란 배경 + KTX 일러스트

처리:
1) 픽셀이 '거의 흰색/회색'인지 판정 (밝기 230 이상 + 채도 낮음)
2) 그 픽셀이 아닌 첫 행/열을 찾아 가장자리 트림
3) 가로 직사각이라 좌우만 잘라도 정사각화. 안전하게 가로 트림 후 중앙 정사각 크롭.
"""
from PIL import Image
import numpy as np
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')

SRC = Path(r'C:\Users\shg98\Desktop\철도공사\4차\아이콘.png')
DST_DIR = Path(__file__).resolve().parent.parent / 'frontend' / 'public'


def trim_whitespace(im: Image.Image) -> Image.Image:
    """채도 기반으로 컬러풀한 영역(아이콘 본체)만 남기고 잘라낸다.
    원본은 회/흰 배경 위에 카드형 컬러 아이콘이 놓여 있음. 채도 임계값으로
    배경/컨텐츠 경계를 찾는 게 가장 안정적."""
    arr = np.array(im.convert('RGB'))
    sat = arr.max(axis=-1).astype(int) - arr.min(axis=-1).astype(int)

    # 각 행/열에서 채도 25 이상인 픽셀이 충분히 있으면 컨텐츠 영역
    # row mean을 쓰면 가는 한 줄도 잡으니 평균 5 이상으로 컷
    mean_sat_rows = sat.mean(axis=1)
    mean_sat_cols = sat.mean(axis=0)
    rows = np.where(mean_sat_rows > 5)[0]
    cols = np.where(mean_sat_cols > 5)[0]
    if len(rows) == 0 or len(cols) == 0:
        print('  ⚠️ 컬러 영역 못 찾음 — 트림 안 함')
        return im
    top, bottom = rows[0], rows[-1]
    left, right = cols[0], cols[-1]
    print(f'  컬러 영역: x=[{left}..{right}] y=[{top}..{bottom}]  '
          f'→ {right-left+1}x{bottom-top+1}')
    return im.crop((left, top, right + 1, bottom + 1))


def fit_to_square(im: Image.Image, bg_color=(255, 255, 255, 0)) -> Image.Image:
    """가로/세로가 다르면 더 짧은 쪽에 패딩을 줘서 정사각으로 맞춤.
    이렇게 하면 아이콘 본체가 잘리지 않고 꽉 차게 들어감."""
    w, h = im.size
    side = max(w, h)
    canvas = Image.new('RGBA', (side, side), bg_color)
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im.convert('RGBA'))
    return canvas


def main():
    print(f'소스: {SRC}')
    im = Image.open(SRC).convert('RGBA')
    print(f'원본: {im.size}')

    trimmed = trim_whitespace(im)
    # 아이콘 본체가 둥근 사각형이라 모서리 색이 살짝 빠질 수 있음 → 약간 외부 패딩 추가
    pad = max(trimmed.size) // 30
    padded = Image.new('RGBA', (trimmed.width + 2*pad, trimmed.height + 2*pad), (255, 255, 255, 0))
    padded.paste(trimmed, (pad, pad))
    sq = fit_to_square(padded)
    print(f'정사각 변환 후: {sq.size}')

    targets = [
        # rounded=True → 모서리 둥글게 깎아 PC에서도 둥근 앱 아이콘
        # apple-touch-icon은 iOS가 자체 마스킹하므로 정사각 그대로
        ('pwa-512.png', 512, True),
        ('pwa-192.png', 192, True),
        ('apple-touch-icon.png', 180, False),
    ]
    DST_DIR.mkdir(parents=True, exist_ok=True)
    print()
    print('PWA 아이콘 출력:')
    for fname, size, rounded in targets:
        out = sq.resize((size, size), Image.LANCZOS).convert('RGBA')
        if rounded:
            # iOS 스타일 코너 반경 (≈22%) — 둥근 사각형 모서리
            radius = int(size * 0.22)
            mask = Image.new('L', (size, size), 0)
            from PIL import ImageDraw
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
            # 알파를 mask로 곱함 (기존 알파 보존)
            r, g, b, a = out.split()
            new_a = Image.eval(a, lambda v: v)
            from PIL import ImageChops
            new_a = ImageChops.multiply(new_a, mask)
            out = Image.merge('RGBA', (r, g, b, new_a))
        path = DST_DIR / fname
        out.save(path, 'PNG', optimize=True)
        print(f'  ✓ {fname:25s} {size}x{size}  rounded={rounded}  ({path.stat().st_size:,} bytes)')

    print()
    print('완료. 빌드 후 홈 화면 재추가하면 새 아이콘 적용.')


if __name__ == '__main__':
    main()
