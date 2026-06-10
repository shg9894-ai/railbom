"""사용자 제공 아이콘을 PWA 3개 사이즈로 변환 — 단순 리사이즈만."""
from PIL import Image
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')

SRC = Path(r'C:\Users\shg98\Desktop\철도공사\4차\아이콘2.png')
DST_DIR = Path(__file__).resolve().parent.parent / 'frontend' / 'public'


ZOOM = 1.08  # 8% 확대 후 가운데 크롭 → 둘레의 얇은 흰 테두리 제거


def main():
    print(f'소스: {SRC}')
    im = Image.open(SRC).convert('RGBA')
    print(f'원본: {im.size}')

    # 정사각이 아니면 더 짧은 쪽 기준으로 가운데 크롭 (긴 쪽 잘라내기)
    w, h = im.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top  = (h - side) // 2
        im = im.crop((left, top, left + side, top + side))
        print(f'정사각 크롭: {im.size}')

    # 살짝 확대 후 가운데에서 같은 크기로 크롭 → 흰 테두리 제거
    w0, h0 = im.size
    new_w = int(w0 * ZOOM)
    new_h = int(h0 * ZOOM)
    im = im.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - w0) // 2
    top  = (new_h - h0) // 2
    im = im.crop((left, top, left + w0, top + h0))
    print(f'{int((ZOOM-1)*100)}% 확대+크롭 후: {im.size}')

    targets = [
        ('pwa-512.png', 512),
        ('pwa-192.png', 192),
        ('apple-touch-icon.png', 180),
    ]
    DST_DIR.mkdir(parents=True, exist_ok=True)
    print()
    print('PWA 아이콘 출력:')
    for fname, size in targets:
        out = im.resize((size, size), Image.LANCZOS)
        path = DST_DIR / fname
        out.save(path, 'PNG', optimize=True)
        print(f'  ✓ {fname:25s} {size}x{size}  ({path.stat().st_size:,} bytes)')

    print('\n완료.')


if __name__ == '__main__':
    main()
