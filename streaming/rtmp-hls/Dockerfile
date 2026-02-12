FROM ubuntu:22.04

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
     nginx \
     libnginx-mod-rtmp \
     ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY nginx.conf /etc/nginx/nginx.conf
COPY hls-transcode.sh /usr/local/bin/hls-transcode.sh
RUN chmod +x /usr/local/bin/hls-transcode.sh \
  && mkdir -p /var/www/hls/live

EXPOSE 1935 8080
CMD ["nginx", "-g", "daemon off;"]
