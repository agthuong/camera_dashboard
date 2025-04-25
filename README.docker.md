# Hướng dẫn sử dụng Docker với Camera.UI

## Yêu cầu
- Docker đã được cài đặt
- Docker Compose đã được cài đặt (tùy chọn, nhưng được khuyến nghị)

## Cách build và chạy với Docker

### Sử dụng Docker Compose (Khuyến nghị)

1. Clone repository:
```bash
git clone https://github.com/SeydX/camera.ui.git
cd camera.ui
```

2. Build và chạy container:
```bash
docker-compose up -d
```

3. Truy cập ứng dụng tại: http://localhost:8080

### Sử dụng Docker trực tiếp

1. Clone repository:
```bash
git clone https://github.com/SeydX/camera.ui.git
cd camera.ui
```

2. Build Docker image:
```bash
docker build -t camera-ui .
```

3. Chạy container:
```bash
docker run -d --name camera-ui -p 8080:8080 -v camera-ui-data:/app/.camera.ui camera-ui
```

4. Truy cập ứng dụng tại: http://localhost:8080

## Cấu hình

Bạn có thể thay đổi các biến môi trường trong file `docker-compose.yml` hoặc khi chạy lệnh `docker run`:

- `NODE_ENV`: Môi trường chạy (mặc định: production)
- `TZ`: Múi giờ (mặc định: Asia/Ho_Chi_Minh)

## Quản lý dữ liệu

Dữ liệu của ứng dụng được lưu trữ trong volume Docker có tên `camera-ui-data`. Điều này đảm bảo dữ liệu của bạn được giữ lại ngay cả khi container bị xóa.

## Cập nhật

Để cập nhật lên phiên bản mới:

```bash
# Với Docker Compose
git pull
docker-compose down
docker-compose up -d --build

# Với Docker trực tiếp
git pull
docker stop camera-ui
docker rm camera-ui
docker build -t camera-ui .
docker run -d --name camera-ui -p 8080:8080 -v camera-ui-data:/app/.camera.ui camera-ui
``` 