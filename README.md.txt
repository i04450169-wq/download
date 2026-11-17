# VideoDL — منزّل الفيديو

منصة مفتوحة لتحميل الفيديو من أي رابط. عربي/إنجليزي. مبنية بـ FastAPI + yt-dlp.

## المميزات / Features

- لصق أي رابط فيديو (يوتيوب، فيسبوك، تويتر، تيك توك، وأكتر من 1000 موقع)
- اختيار الجودة والصيغة
- شريط تقدم لايف
- واجهة عربي/إنجليزي
- مجاني ومفتوح — بدون تسجيل دخول

## التشغيل المحلي / Local Run

### Backend

```bash
cd frontend/backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000