"""사용자 제공 아이콘을 PWA 3개 사이즈로 변환 — 단순 리사이즈만."""
from PIL import Image
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')

SRC = Path(r'C:\Users\shg98\Desktop\철도공사\4차\아이콘2.png')
DST_DIR = Path(__file__).resolve().parent.parent / 'frontend' / 'public'


def main():
    print(f'소스: {SRC}')
    im = Image.open(SRC).convert('RGBA')
    print(f'원본: {im.size}')

    # 정사각이 아니면 더 긴 쪽 기준으로 짧은 쪽에 투명 패딩 추가
    w, h = im.size
    if w != h:
        side = max(w, h)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
        im = canvas
        print(f'정사각화: {im.size}')

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
