<template lang="pug">
.content
  .tw-h-full.tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading")
    v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  
  .tw-flex.tw-justify-between.tw-mt-1.tw-mb-1.tw-relative.tw-z-5(v-if="customChart" style="height: 25px;")
    .tw-ml-2.tw-text-xs.tw-font-bold.text-muted {{ chartTitle || $t('chart') }}
    .tw-ml-auto.tw-mr-2
      v-btn.text-muted(icon x-small @click="reloadChart" style="margin-top: -5px;")
        v-icon {{ icons['mdiReload'] }}
      v-btn.text-muted(v-if="isAdmin" icon x-small @click="dialog = true" style="margin-top: -5px;")
        v-icon {{ icons['mdiCog'] }}

  .tw-w-full.tw-overflow-hidden(v-if="customChart" :style="chartContentStyle")
    div.tw-w-full.tw-h-full(v-if="maintainAspectRatio" :style="iframeContainerStyle")
      div.tw-w-full.tw-h-full.tw-flex.tw-items-center.tw-justify-center.tw-absolute(v-if="iframeLoading")
        v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
      div.tw-w-full.tw-h-full.tw-flex.tw-items-center.tw-justify-center.tw-absolute.tw-z-10(v-if="iframeError")
        .tw-text-center.tw-p-4
          v-icon(color="error" size="40") {{ icons['mdiAlert'] }}
          .tw-mt-2.tw-text-sm.tw-text-red-500 {{ $t('cannot_load_chart') }}
          .tw-mt-1.tw-text-xs.tw-text-gray-500.tw-max-w-xs.tw-break-words {{ chartUrl }}
          .tw-flex.tw-mt-3
            v-btn(small color="var(--cui-primary)" dark @click="retryIframeLoad" class="tw-mr-2") {{ $t('retry') }}
            v-btn(small outlined @click="openInNewWindow" color="var(--cui-primary)") {{ $t('open_in_new_window') }}
          .tw-mt-3.tw-text-xs.tw-text-gray-500 {{ $t('iframe_error_info') }}
      iframe(
        :src="chartUrl" 
        :key="iframeKey"
        frameborder="0"
        width="100%"
        height="100%"
        :style="iframeStyle"
        scrolling="no"
        seamless
        @load="handleIframeLoad"
        @error="handleIframeError"
        ref="chartIframe"
      )
    iframe.tw-w-full.tw-h-full(
      v-else
      :src="chartUrl"
      :key="iframeKey"
      frameborder="0"
      style="border-radius: 8px;"
      @load="handleIframeLoad"
      @error="handleIframeError"
    )

  .chart-content.tw-relative.tw-overflow-hidden(v-else)
    .tw-text-xs.tw-absolute.tw-top-2.tw-left-2.tw-font-bold.text-muted {{ dataset.label ? dataset.label : '' }}
    .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="item.id === 'cpuLoad'") {{ dataset.data.length ? `${Math.round(dataset.data[dataset.data.length-1].value)}%` : '' }}
    .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="item.id === 'cpuTemperature'") {{ dataset.data.length ? `${Math.round(dataset.data[dataset.data.length-1].value)}°` : '' }}
    .chart-badge.tw-flex.tw-justify-center.tw-items-center.text-default(v-if="item.id === 'memory'" style="font-size: 1.3rem !important;") {{ dataset.data.length ? dataset.data[dataset.data.length-1].available : '-' }} GB / {{ dataset.data.length ? dataset.data[dataset.data.length-1].total : '-' }} GB
    Chart(:dataset="dataset" :options="chartOptions")

  v-dialog(v-model="dialog" width="500" scrollable)
    v-card(height="400")
      v-card-title {{ $t('chart_configuration') }}
      v-divider
      v-card-text.tw-p-7.tw-flex.tw-flex-col.tw-items-center.tw-justify-center
        .tw-block(v-if="loadingDialog")
          v-progress-circular(indeterminate color="var(--cui-primary)" size="20")

        .tw-w-full(v-else)
          v-sheet.tw-p-3(rounded class="mx-auto" width="100%" color="rgba(0,0,0,0.2)")
            span.text-default {{ $t('chart_widget_info') }}
            
          .tw-w-full.tw-mt-5
            label.text-default {{ $t('chart_title') }}
            v-text-field(v-model="chartTitleInput" persistent-hint background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
              
          .tw-w-full.tw-mt-3
            label.text-default {{ $t('chart_url_or_iframe') }}
            v-textarea(v-model="chartUrlInput" persistent-hint background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo :rows="5")
              
          .tw-w-full.tw-mt-3
            v-switch(v-model="useCustomChart" :label="$t('use_custom_chart')" color="var(--cui-primary)")

      v-divider
      v-card-actions.tw-flex.tw-justify-end
        v-btn.text-default(text @click='dialog = false') {{ $t('cancel') }}
        v-btn(color='var(--cui-primary)' text @click='applyData') {{ $t('apply') }}
</template>

<script>
/* eslint-disable vue/require-default-prop */
import Chart from '@/components/utilization-charts.vue';
import { mdiCog, mdiReload } from '@mdi/js';
import { getSetting } from '@/api/settings.api';

export default {
  name: 'ChartWidget',

  components: {
    Chart,
  },

  props: {
    item: Object,
  },

  data: () => ({
    loading: true,
    loadingDialog: false,
    dialog: false,
    customChart: false,
    useCustomChart: false,
    chartUrl: '',
    chartUrlInput: '',
    chartTitle: '',
    chartTitleInput: '',
    iframeKey: 0,
    isIframeCode: false,
    iframeAttributes: null,
    originalInput: '',
    processedIframeCode: '',
    maintainAspectRatio: false,
    aspectRatio: 56.25, // Mặc định tỷ lệ 16:9
    widgetHeight: null,
    widgetWidth: null,
    resizeObserver: null,
    checkInterval: null,
    lastUpdated: null,

    icons: {
      mdiCog,
      mdiReload,
      mdiAlert: 'mdi-alert-circle-outline',
      mdiOpenInNew: 'mdi-open-in-new',
    },

    dataset: {
      label: '',
      data: [],
    },

    chartOptions: {
      responsive: true,
      maintainAspectRatio: false,
      elements: {
        point: {
          radius: 0,
        },
      },
      legend: {
        display: false,
        labels: {
          boxWidth: 0,
        },
      },
      tooltips: {
        enabled: false,
      },
      scales: {
        xAxes: [
          {
            display: false,
            gridLines: {
              display: false,
            },
            scaleLabel: {
              display: false,
            },
          },
        ],
        yAxes: [
          {
            display: false,
            gridLines: {
              display: false,
            },
            scaleLabel: {
              display: false,
            },
            ticks: {
              min: 0,
              max: 100,
              stepSize: 10,
            },
            type: 'linear',
          },
        ],
      },
    },

    iframeLoading: true,
    iframeError: false,
    iframeErrorCount: 0,
    iframeLoadTimeout: null,
  }),

  computed: {
    isAdmin() {
      const user = this.$store.state.auth.user || {};
      return user.permissionLevel?.includes('admin');
    },
    isDashboard() {
      return this.$route.name === 'dashboard';
    },
    chartContentStyle() {
      return {
        height: this.customChart ? 'calc(100% - 25px - 0.5rem)' : '100%',
        width: '100%',
      };
    },
    iframeContainerStyle() {
      return {
        position: 'relative',
        paddingBottom: `${this.aspectRatio}%`,
        overflow: 'hidden',
        width: '100%',
      };
    },
    iframeStyle() {
      return {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        borderRadius: '8px',
      };
    },
  },

  watch: {
    '$route.path': {
      handler() {
        this.dialog = false;
      },
    },
  },

  async mounted() {
    try {
      // Thiết lập theo dõi kích thước widget
      this.setupResizeObserver();
      
      // Kiểm tra cài đặt từ widget
      const widgets = await getSetting('widgets');
      const items = widgets.data.items;
      const chartWidget = items.find((item) => item.id === this.item.id);

      if (chartWidget?.chartUrl) {
        this.chartUrlInput = chartWidget.chartUrl;
        this.originalInput = chartWidget.chartUrl;
        this.chartTitleInput = chartWidget.chartTitle || '';
        this.useCustomChart = chartWidget.useCustomChart || false;
        this.lastUpdated = chartWidget.lastUpdated;
        this.maintainAspectRatio = chartWidget.maintainAspectRatio !== undefined ? chartWidget.maintainAspectRatio : false;
        this.aspectRatio = chartWidget.aspectRatio || 56.25;
        
        if (this.useCustomChart) {
          this.customChart = true;
          this.processChart();
        } else {
          this.initializeDefaultChart();
        }
      } else {
        this.initializeDefaultChart();
      }

      this.loading = false;
      this.startAutoRefresh();
    } catch (err) {
      console.error(err);
      this.$toast.error(err.message);
      this.initializeDefaultChart();
      this.loading = false;
    }
  },

  beforeDestroy() {
    this.stopAutoRefresh();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (!this.customChart) {
      if (this.item.id === 'cpuLoad') {
        this.$socket.client.off('cpuLoad', this.cpuLoad);
      } else if (this.item.id === 'cpuTemperature') {
        this.$socket.client.off('cpuTemp', this.cpuTemp);
      } else {
        this.$socket.client.off('memory', this.memory);
      }
    }
  },

  methods: {
    initializeDefaultChart() {
      if (this.item.id === 'cpuLoad') {
        this.dataset.label = this.$t('load');
        this.$socket.client.on('cpuLoad', this.cpuLoad);
        this.$socket.client.emit('getCpuLoad');
      } else if (this.item.id === 'cpuTemperature') {
        this.dataset.label = this.$t('temperature');
        this.$socket.client.on('cpuTemp', this.cpuTemp);
        this.$socket.client.emit('getCpuTemp');
      } else {
        this.dataset.label = this.$t('memory');
        this.$socket.client.on('memory', this.memory);
        this.$socket.client.emit('getMemory');
      }
      this.customChart = false;
    },

    parseIframeCode(code) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(code, 'text/html');
      const iframe = doc.querySelector('iframe');

      if (iframe) {
        const attributes = {};
        for (const attr of iframe.attributes) {
          attributes[attr.name] = attr.value;
        }
        
        // Kiểm tra nếu có width và height, tính toán tỷ lệ khung hình
        if (attributes.width && attributes.height) {
          const width = parseInt(attributes.width, 10);
          const height = parseInt(attributes.height, 10);
          
          if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
            this.maintainAspectRatio = true;
            this.aspectRatio = (height / width) * 100;
          }
        }
        
        return attributes;
      }
      return null;
    },

    setupResizeObserver() {
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(entries => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            this.widgetWidth = width;
            this.widgetHeight = height;
          }
        });
        
        // Theo dõi phần tử container
        const contentElement = this.$el.querySelector('.content');
        if (contentElement) {
          this.resizeObserver.observe(contentElement);
        }
      }
    },

    detectUrlType(url) {
      // Kiểm tra xem input có phải là tag iframe
      if (url.trim().toLowerCase().startsWith('<iframe')) {
        console.log('Phát hiện tag iframe, đang trích xuất URL...');
        // Trích xuất URL từ thuộc tính src
        const srcMatch = url.match(/src=["']([^"']+)["']/i);
        if (srcMatch && srcMatch[1]) {
          const extractedUrl = srcMatch[1];
          console.log('Đã trích xuất URL từ iframe:', extractedUrl);
          
          // Tự động bật chế độ duy trì tỷ lệ khung hình
          this.maintainAspectRatio = true;
          
          // Trích xuất width và height từ iframe nếu có
          const widthMatch = url.match(/width=["']([^"']+)["']/i);
          const heightMatch = url.match(/height=["']([^"']+)["']/i);
          
          if (widthMatch && heightMatch) {
            const width = parseInt(widthMatch[1], 10);
            const height = parseInt(heightMatch[1], 10);
            
            if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
              this.aspectRatio = (height / width) * 100;
              console.log('Đã thiết lập tỷ lệ khung hình từ iframe:', this.aspectRatio);
            }
          } else {
            // Nếu không tìm thấy width và height trong iframe, thử lấy từ tham số URL
            try {
              const urlObj = new URL(extractedUrl);
              const heightParam = urlObj.searchParams.get('height');
              const height = heightParam ? parseInt(heightParam, 10) : 400;
              const width = 600; // Giá trị mặc định cho width
              
              this.aspectRatio = (height / width) * 100;
              console.log('Đã thiết lập tỷ lệ khung hình từ tham số URL:', this.aspectRatio);
            } catch (e) {
              // Nếu lỗi phân tích URL, sử dụng tỷ lệ mặc định 16:9
              this.aspectRatio = 56.25;
              console.log('Sử dụng tỷ lệ khung hình mặc định 16:9');
            }
          }
          
          return { isIframe: true, url: extractedUrl };
        }
        
        console.error('Không tìm thấy thuộc tính src trong iframe');
        return { isIframe: false, url: '' };
      }
      
      // Nếu không phải tag iframe, xử lý như URL thông thường
      try {
        // Tạo URL đầy đủ nếu chưa có protocol
        const urlWithProtocol = url.includes('://') ? url : `http://${url}`;
        const urlObj = new URL(urlWithProtocol);
        
        // Lấy tham số height từ URL nếu có
        const heightParam = urlObj.searchParams.get('height');
        if (heightParam) {
          const height = parseInt(heightParam, 10);
          const width = 600; // Giá trị mặc định cho width
          
          this.aspectRatio = (height / width) * 100;
          this.maintainAspectRatio = true;
          console.log('Đã thiết lập tỷ lệ khung hình từ tham số height:', this.aspectRatio);
        }
        
        return { isIframe: false, url: urlWithProtocol };
      } catch (e) {
        console.error('Invalid URL:', e);
        return { isIframe: false, url };
      }
    },

    processChart() {
      if (this.useCustomChart) {
        // Lưu trữ giá trị nhập ban đầu
        this.originalInput = this.chartUrlInput;
        
        const { isIframe, url } = this.detectUrlType(this.chartUrlInput);
        
        // Lưu lại thông tin về loại input
        this.isIframeCode = isIframe;
        this.chartUrl = url;
        
        if (isIframe) {
          // Nếu là iframe, cập nhật giá trị hiển thị trong ô input thành URL đã trích xuất
          console.log('Đang chuyển đổi iframe thành URL:', url);
          this.chartUrlInput = url;
        }
        
        this.chartTitle = this.chartTitleInput;
        
        // Reset iframe status
        this.iframeLoading = true;
        this.iframeError = false;
        
        // Đặt timeout kiểm tra iframe load
        if (this.iframeLoadTimeout) {
          clearTimeout(this.iframeLoadTimeout);
        }
        
        this.iframeLoadTimeout = setTimeout(() => {
          if (this.iframeLoading) {
            this.handleIframeError();
          }
        }, 15000); // 15 giây timeout
      } else {
        this.initializeDefaultChart();
        this.maintainAspectRatio = false;
      }
    },

    async applyData() {
      // Chỉ admin mới được cấu hình Chart
      if (!this.isAdmin) {
        this.$toast.error(this.$t('permission_required'));
        return;
      }

      this.loadingDialog = true;
      try {
        this.customChart = this.useCustomChart;
        
        this.processChart();
        
        // Ngắt kết nối socket của chart mặc định nếu đang sử dụng custom chart
        if (this.useCustomChart) {
          if (this.item.id === 'cpuLoad') {
            this.$socket.client.off('cpuLoad', this.cpuLoad);
          } else if (this.item.id === 'cpuTemperature') {
            this.$socket.client.off('cpuTemp', this.cpuTemp);
          } else {
            this.$socket.client.off('memory', this.memory);
          }
        }

        // Lưu lại cấu hình, sử dụng URL đã trích xuất nếu là iframe
        this.$emit('widgetData', {
          id: this.item.id,
          data: {
            chartUrl: this.chartUrlInput, // Đã được cập nhật thành URL trong processChart nếu là iframe
            chartTitle: this.chartTitleInput,
            useCustomChart: this.useCustomChart,
            lastUpdated: Date.now(),
            isIframeCode: this.isIframeCode,
            maintainAspectRatio: this.maintainAspectRatio, 
            aspectRatio: this.aspectRatio
          },
        });

        this.iframeKey++;
      } catch (err) {
        this.$toast.error(err.message);
      }
      this.dialog = false;
      this.loadingDialog = false;
    },

    async checkForUpdates() {
      try {
        const widgets = await getSetting('widgets');
        const items = widgets.data.items;
        const chartWidget = items.find((item) => item.id === this.item.id);

        if (chartWidget?.lastUpdated && chartWidget.lastUpdated !== this.lastUpdated) {
          this.chartUrlInput = chartWidget.chartUrl || '';
          this.originalInput = chartWidget.chartUrl || '';
          this.chartTitleInput = chartWidget.chartTitle || '';
          this.useCustomChart = chartWidget.useCustomChart || false;
          this.maintainAspectRatio = chartWidget.maintainAspectRatio !== undefined ? chartWidget.maintainAspectRatio : false;
          this.aspectRatio = chartWidget.aspectRatio || 56.25;
          
          if (this.useCustomChart) {
            this.customChart = true;
            this.processChart();
          } else {
            this.initializeDefaultChart();
          }
          
          this.lastUpdated = chartWidget.lastUpdated;
          this.iframeKey++; // Force iframe reload
        }
      } catch (err) {
        console.error('Error checking for updates:', err);
      }
    },

    startAutoRefresh() {
      // Kiểm tra cập nhật mỗi 30 giây
      this.checkInterval = setInterval(this.checkForUpdates, 30000);
    },

    stopAutoRefresh() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    },

    reloadChart() {
      // Tạo lại iframe key để buộc iframe reload
      this.iframeKey++;
      this.retryIframeLoad();
    },

    // Các hàm xử lý dữ liệu từ socket cho chart mặc định
    cpuLoad(data) {
      this.dataset.data = data;
    },
    cpuTemp(data) {
      this.dataset.data = data;
    },
    memory(data) {
      this.dataset.data = data;
    },

    handleIframeLoad() {
      this.iframeLoading = false;
      this.iframeError = false;
      this.iframeErrorCount = 0;
      
      // Xóa timeout nếu có
      if (this.iframeLoadTimeout) {
        clearTimeout(this.iframeLoadTimeout);
        this.iframeLoadTimeout = null;
      }
    },
    
    handleIframeError() {
      this.iframeLoading = false;
      this.iframeError = true;
      this.iframeErrorCount++;
      console.error(`Không thể tải iframe (lần thử ${this.iframeErrorCount}):`, this.chartUrl);
    },
    
    retryIframeLoad() {
      this.iframeLoading = true;
      this.iframeError = false;
      this.iframeKey++; // Force iframe reload
      
      // Đặt timeout phòng khi iframe không kích hoạt event load hoặc error
      this.iframeLoadTimeout = setTimeout(() => {
        if (this.iframeLoading) {
          this.handleIframeError();
        }
      }, 15000); // 15 giây timeout
    },

    openInNewWindow() {
      if (this.chartUrl) {
        window.open(this.chartUrl, '_blank');
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
  background: var(--cui-bg-default);
  border: 1px solid var(--cui-bg-app-bar-border);
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
}

.widget {
}

.chart-content {
  width: 100%;
  height: 100%;
  border-radius: 13px;
  overflow: hidden;
}

.chart-badge {
  font-size: 1.8rem;
  position: absolute;
  width: 100%;
  height: 100%;
  text-shadow: 1px 0px 0px rgba(0, 0, 0, 0.7);
}

iframe {
  background: transparent;
}

/* Ẩn thanh cuộn nhưng vẫn giữ chức năng cuộn */
:deep(.hide-scrollbar),
iframe,
.tw-overflow-hidden,
.chart-content {
  /* Cho Firefox */
  scrollbar-width: none;
  /* Cho IE và Edge */
  -ms-overflow-style: none;
}

/* Cho Chrome, Safari và Opera */
:deep(.hide-scrollbar::-webkit-scrollbar),
iframe::-webkit-scrollbar,
.tw-overflow-hidden::-webkit-scrollbar,
.chart-content::-webkit-scrollbar {
  width: 0px;
  height: 0px;
  display: none;
}

/* Đảm bảo nội dung iframe không bị che bởi thanh cuộn */
.iframeContainerStyle {
  padding-right: 0 !important;
  padding-bottom: 0 !important;
}
</style>
