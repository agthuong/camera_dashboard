FROM node:18-alpine

# Tạo thư mục ứng dụng
WORKDIR /app

# Cài đặt các dependencies
COPY package*.json ./
RUN npm install --only=production

# Sao chép mã nguồn ứng dụng
COPY . .

# Mở cổng mà ứng dụng sẽ chạy
EXPOSE 8082

# Cài đặt ffmpeg
# RUN apk add --no-cache npm i ffmpeg-for-homebridge@0.0.9

# Tạo volume cho dữ liệu
VOLUME ["/app/.camera.ui"]

# Khởi động ứng dụng
CMD ["node", "bin/camera.ui.js"] 