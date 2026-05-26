import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent

# DB: DATABASE_URL 있으면 PostgreSQL, 없으면 SQLite
DATABASE_URL = os.getenv("DATABASE_URL", "")
DB_PATH = BASE_DIR / os.getenv("DB_PATH", "data/bom.db")

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

# Supabase Storage
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "assembly-photos")

# 프론트엔드 정적 파일 URL (KTX-1 등 Supabase에 없는 이미지용)
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://korailbom.up.railway.app")
