<template lang="pug">
.content
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center.tw-text-red-500(v-else-if="error")
    span {{ error }}
  .widget.tw-h-full(v-else)
    VideoCard(:ref="camera.name" :camera="camera" title titlePosition="top" status :stream="camera.live" :refreshSnapshot="!camera.live" hideNotifications hideIndicatorFullscreen noLink preventTitleClick)
</template>

<script>
/* eslint-disable vue/require-default-prop */
import VideoCard from '@/components/camera-card.vue';
import { getCamera, getCameraSettings } from '@/api/cameras.api';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const API_TIMEOUT = 10000; // 10 seconds

export default {
  name: 'CameraWidget',

  components: {
    VideoCard,
  },

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,
    camera: null,
    error: null,
  }),

  async mounted() {
    await this.initCamera();
  },

  beforeDestroy() {
    if (this.camera) {
      this.$refs[this.camera.name]?.destroy();
    }
  },

  methods: {
    async fetchWithTimeout(promise) {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), API_TIMEOUT));
      return Promise.race([promise, timeout]);
    },

    async initCamera(retryCount = 0) {
      try {
        if (!this.item?.name) {
          throw new Error('Camera name is missing');
        }

        const [cameraResponse, settingsResponse] = await Promise.all([
          this.fetchWithTimeout(getCamera(this.item.name)),
          this.fetchWithTimeout(getCameraSettings(this.item.name)),
        ]);

        // Validate response data
        if (!cameraResponse?.data || !settingsResponse?.data) {
          throw new Error('Invalid camera data received');
        }

        this.camera = {
          ...cameraResponse.data,
          settings: settingsResponse.data,
          live: settingsResponse.data.dashboard?.live || false,
          refreshTimer: settingsResponse.data.dashboard?.refreshTimer || 60,
        };

        this.error = null;
      } catch (err) {
        console.error(`Camera initialization error (${this.item?.name}):`, err);

        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying camera initialization (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return this.initCamera(retryCount + 1);
        }

        this.error = err.message;
        this.$toast.error(`Không thể khởi động camera ${this.item?.name}: ${err.message}`);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  border-radius: 13px;
  background: rgb(17, 17, 17);
  border: 1px solid var(--cui-bg-app-bar-border);
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.widget {
}

.video-card-top-title {
  padding: 0;
  margin: 0;
  font-size: 13px;
  background: var(--cui-bg-card);
  height: 38px;
  padding: 4px;
  padding-left: 10px;
  padding-right: 10px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
}
</style>
