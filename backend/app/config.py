import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "billing_inventory.db"
JWT_SECRET = os.getenv("JWT_SECRET", "inventory-flow-demo-secret-key-2026")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 12
PBKDF2_ITERATIONS = 120_000
