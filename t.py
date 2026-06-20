import sys
from sqlalchemy import create_engine, text

# 1. Your hardcoded connection string using the recommended pooler port (6543)
DB_URI = "postgresql://postgres.zhuizipxcnstkqkapkjh:dyhva3-kuqkun-tubXip@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

def test_connection():
    print("Connecting to Supabase...")
    try:
        # 2. Create the database engine
        engine = create_engine(DB_URI)

        # 3. Open a connection and execute a simple diagnostic query
        with engine.connect() as connection:
            # text() ensures the raw SQL is safely executed in SQLAlchemy 2.0
            result = connection.execute(text("SELECT version();"))
            row = result.fetchone()

            print("\n SUCCESS: Connection established!")
            print(f"Database Version Info: {row[0]}\n")

    except Exception as e:
        print("\n CONNECTION FAILED!")
        print(f"Error details: {e}\n")
        print("Troubleshooting checklist:")
        print("1. Did you change the database password in Supabase recently? (Wait 2 minutes to sync)")
        print("2. Is your computer behind a restrictive network or VPN blocking port 6543?")

if __name__ == "__main__":
    test_connection()
