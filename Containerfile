FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv bash \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY python-runtime/requirements.txt /app/python-runtime/requirements.txt
RUN python3 -m pip install --no-cache-dir -r /app/python-runtime/requirements.txt

COPY . .

EXPOSE 4173 8100

CMD ["bash", "/app/container/start.sh"]
