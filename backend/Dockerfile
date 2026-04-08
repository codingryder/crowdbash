FROM python:3.12-slim

WORKDIR /app

# Install setuptools first (needed by razorpay SDK for pkg_resources)
RUN pip install --no-cache-dir setuptools>=70.0.0

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
