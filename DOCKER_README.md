# Hướng dẫn sử dụng Docker cho Camera.UI

## Giới thiệu

Tài liệu này hướng dẫn cách triển khai Camera.UI sử dụng Docker. Chúng tôi cung cấp hai cách để triển khai:
1. Sử dụng Dockerfile để build image
2. Sử dụng docker-compose để triển khai nhanh chóng

## Yêu cầu

- Docker đã được cài đặt
- Docker Compose (nếu sử dụng phương pháp docker-compose)
- Ít nhất 2GB RAM và 1GB dung lượng ổ đĩa trống

## Cách 1: Sử dụng Dockerfile

### Build image

```bash
docker build -t camera-ui:latest .
```

### Chạy container

```bash
docker run -d \
  --name camera-ui \
  -p 8082:80 \
  -p 3600:3600 \
  -v camera-ui-data:/app/.camera.ui \
  -v camera-ui-logs:/app/logs \
  -e NODE_ENV=production \
  -e TZ=Asia/Ho_Chi_Minh \
  --restart unless-stopped \
  camera-ui:latest
```

## Cách 2: Sử dụng Docker Compose

### Triển khai

```bash
docker-compose up -d
```

### Dừng dịch vụ

```bash
docker-compose down
```

## Cấu hình

Dữ liệu của Camera.UI được lưu trữ trong volume Docker. Bạn có thể truy cập vào dữ liệu này bằng cách:

```bash
docker exec -it camera-ui sh
cd /app/.camera.ui
```

## Logs

Xem logs của container:

```bash
docker logs -f camera-ui
```

Logs cũng được lưu trong volume Docker và có thể truy cập tại:

```bash
docker exec -it camera-ui sh
cd /app/logs
```

## Cập nhật

Để cập nhật lên phiên bản mới:

```bash
# Nếu sử dụng Dockerfile
docker pull camera-ui:latest
docker stop camera-ui
docker rm camera-ui
# Sau đó chạy lại container như hướng dẫn ở trên

# Nếu sử dụng Docker Compose
git pull  # Cập nhật mã nguồn
docker-compose down
docker-compose up -d --build
```

## Vấn đề thường gặp

### Không thể truy cập giao diện web

- Kiểm tra xem cổng 8082 đã được mở chưa
- Kiểm tra logs của container để xem lỗi

### Không thể kết nối với camera

- Kiểm tra cấu hình camera trong phần cài đặt
- Đảm bảo camera có thể truy cập được từ container Docker

## Hỗ trợ

Nếu bạn gặp vấn đề, vui lòng tạo issue trên GitHub hoặc liên hệ với chúng tôi qua các kênh hỗ trợ chính thức. 