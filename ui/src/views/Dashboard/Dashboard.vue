<template lang="pug">
.tw-flex.tw-justify-center.tw-items-center.page-loading(v-if="loading")
  v-progress-circular(indeterminate color="var(--cui-primary)")
.tw-py-6.tw-px-3(v-else)
  .pl-safe.pr-safe

    Sidebar(ref="widgetBar" :items="items" @refreshDrag="setupDrag")
  
    .tw-flex.tw-justify-between.tw-items-center
      .tw-block(style="margin-left: 10px;")
        h2.tw-leading-10 {{ $t($route.name.toLowerCase()) }}
        span.tw-leading-3.subtitle {{ $t('welcome_back') }}, 
          b {{ currentUser.username }}

      .tw-block.widgets-included.tw-ml-auto.tw-mr-1(v-if="!showWidgetsNavi && !isBaseUser && !isDashboardOnlyUser")
        v-btn.text-muted.tw-mr-1(icon height="38px" width="38px" @click="toggleLock" :color="locked ? 'error' : 'var(--cui-text-hint)'")
          v-icon {{ locked ? icons['mdiLock'] : icons['mdiLockOpen'] }}

      .tw-block.widgets-included(v-if="!showWidgetsNavi && !isBaseUser && !isDashboardOnlyUser")
        v-btn.text-muted.tw-mr-1(icon height="38px" width="38px" @click="toggleWidgetsNavi")
          v-icon {{ icons['mdiWidgets'] }}
          
      // Nút setting cho người dùng dashboard
      .tw-block.widgets-included.tw-ml-auto(v-if="isDashboardOnlyUser")
        v-menu(v-model="showSettingsMenu" :close-on-content-click="false" offset-y)
          template(v-slot:activator="{ on, attrs }")
            v-btn.text-muted.tw-mr-1(icon height="38px" width="38px" v-bind="attrs" v-on="on")
              v-icon {{ icons['mdiCog'] }}
          v-card(min-width="200")
            v-list
              v-list-item(@click="toggleTheme")
                v-list-item-icon
                  v-icon {{ isDarkTheme ? icons['mdiBrightness7'] : icons['mdiBrightness4'] }}
                v-list-item-content
                  v-list-item-title {{ isDarkTheme ? $t('light/dark mode') : $t('light/dark mode') }}
              v-divider
              v-list-item(@click="logout")
                v-list-item-icon
                  v-icon {{ icons['mdiLogout'] }}
                v-list-item-content
                  v-list-item-title {{ $t('logout') }}
    
    #dashboard.tw-mt-5.tw-relative.tw-max-w-10xl(:class="itemChange || !items.length ? 'grid-stack-dragging-border' : ''")
      .drag-info.tw-text-center(v-if="!items.length") {{ $t('drop_widgets_here') }}
      .grid-stack(ref="gridStack")
          
  LightBox(
    ref="lightboxBanner"
    :media="notImages"
    :showLightBox="false"
    :showThumbs="false"
    showCaption
    disableScroll
  )

</template>

<script>
import Vue from 'vue';
import { i18n } from '@/i18n';
import vuetify from '@/plugins/vuetify';
import router from '@/router';
import store from '@/store';

import LightBox from 'vue-it-bigger';
import 'vue-it-bigger/dist/vue-it-bigger.min.css';
import 'gridstack/dist/jq/gridstack-dd-jqueryui';
import 'gridstack/dist/gridstack.min.css';
import 'gridstack/dist/gridstack-extra.min.css';
import { GridStack } from 'gridstack';
import { mdiLock, mdiLockOpen, mdiWidgets, mdiCog, mdiLogout, mdiBrightness4, mdiBrightness7 } from '@mdi/js';

import { getCameras, getCameraSettings } from '@/api/cameras.api';
import { getSetting, changeSetting } from '@/api/settings.api';

import { bus } from '@/main';
import socket from '@/mixins/socket';
import Sidebar from '@/components/sidebar-widgets.vue';

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  name: 'Dashboard',

  components: {
    LightBox,
    Sidebar,
  },

  mixins: [socket],

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    next();
  },

  data: () => ({
    itemChange: false,

    icons: {
      mdiLock,
      mdiLockOpen,
      mdiWidgets,
      mdiCog,
      mdiLogout,
      mdiBrightness4,
      mdiBrightness7,
    },

    instances: {},
    items: [],
    widgets: [],
    widgetsTimeout: null,
    autoRefreshInterval: null,
    lastWidgetsHash: '',

    cameras: [],
    notifications: [],

    loading: true,
    locked: false,
    showWidgetsNavi: false,
    showSettingsMenu: false,

    resizedBack: false,
  }),

  computed: {
    currentUser() {
      return this.$store.state.auth.user || {};
    },
    isBaseUser() {
      return (
        this.currentUser.permissionLevel?.includes('cameras:access') &&
        !this.currentUser.permissionLevel?.includes('admin')
      );
    },
    isDashboardOnlyUser() {
      return (
        this.currentUser.permissionLevel?.includes('dashboard:access') &&
        !this.currentUser.permissionLevel?.includes('admin') &&
        !this.currentUser.permissionLevel?.includes('base')
      );
    },
    isDarkTheme() {
      return localStorage.getItem('theme') === 'dark';
    },
  },

  async mounted() {
    try {
      const cameras = await getCameras();

      for (const camera of cameras.data.result) {
        camera.id = camera.name;
        const settings = await getCameraSettings(camera.name);
        camera.settings = settings.data;
        camera.live = camera.settings.dashboard.live || false;
        camera.refreshTimer = camera.settings.dashboard.refreshTimer || 60;
      }

      const widgets = await getSetting('widgets');
      this.items = widgets.data.items;
      this.locked = widgets.data.options.locked;

      // Tự động khóa grid cho người dùng dashboard
      if (this.isDashboardOnlyUser) {
        this.locked = true;

        // Thiết lập auto refresh cho người dùng dashboard
        this.setupAutoRefresh();
      }

      this.showWidgetsNavi = this.windowWidth() < 768;

      this.loading = false;

      await timeout(100);

      this.$refs.widgetBar.widgets.forEach((widget) => {
        if (widget.type === 'CamerasWidget') {
          widget.items = cameras.data.result;
        }
      });

      this.widgets = this.$refs.widgetBar.widgets;

      this.items = this.items
        .filter((item) => {
          const widget = this.widgets.find(
            (widget) => widget.type === item.type || widget.items.some((widgetItem) => widgetItem.id === item.id)
          );
          return !!widget;
        })
        .map((item) => {
          const widget = this.widgets.find(
            (widget) => widget.type === item.type || widget.items.some((widgetItem) => widgetItem.id === item.id)
          );
          return {
            ...item,
            minW: widget.defaultWidgetData.minW,
            maxW: widget.defaultWidgetData.maxW,
            minH: widget.defaultWidgetData.minH,
            maxH: widget.defaultWidgetData.maxH,
            disableDrag: widget.defaultWidgetData.disableDrag,
            disableResize: widget.defaultWidgetData.disableResize,
          };
        });

      this.grid = GridStack.init({
        alwaysShowResizeHandle: true,
        disableOneColumnMode: true,
        acceptWidgets: true,
        float: true,
        column: 12,
        cellHeight: this.cellHeight(),
        margin: 10,
        removable: true,
        resizable: {
          autoHide: false,
          handles: 'all',
        },
        horizontalScroll: true,
        maxWidth: 12,
      });

      if (this.locked) {
        this.grid.disable();
      } else {
        this.grid.enable();
      }

      // Xử lý các sự kiện grid
      const handleGridChange = (event, changedItems) => {
        if (changedItems && !this.resizedBack) {
          // Kiểm tra nếu widget được di chuyển ra ngoài vùng nhìn thấy
          changedItems.forEach((changedItem) => {
            const gridWidth = this.grid.getColumn();
            if (changedItem.x > gridWidth - changedItem.w) {
              this.$toast.warning('Widget đang di chuyển ra ngoài vùng hiển thị. Bạn sẽ cần cuộn ngang để xem.', {
                duration: 3000,
              });
            }
          });

          this.items = this.items.map((item) => {
            const changedItem = changedItems.find((changed) => changed.id === item.id);
            if (changedItem) {
              return {
                ...item,
                x: changedItem.x,
                y: changedItem.y,
                w: changedItem.w,
                h: changedItem.h,
              };
            }
            return item;
          });
        }
      };

      const handleGridDrop = async (event, previousWidget, newWidget) => {
        if (event.type === 'dropped') {
          this.setupDrag();

          // Lấy widgetType từ attribute
          const widgetType = newWidget.el.getAttribute('data-widget-type') || newWidget.el.getAttribute('gs-type');
          const cameraName = newWidget.el.getAttribute('data-camera-name');

          // Nếu là widget camera, kiểm tra và xóa widget cũ nếu có
          if (widgetType === 'CamerasWidget' && cameraName) {
            const existingWidget = this.items.find(
              (item) => item.type === 'CamerasWidget' && item.cameraName === cameraName
            );

            if (existingWidget) {
              // Xóa widget cũ
              const gridItem = this.grid.engine.nodes.find((node) => node.id === existingWidget.id);
              if (gridItem) {
                this.grid.removeWidget(gridItem.el);
                this.items = this.items.filter((item) => item.id !== existingWidget.id);
                this.destroyInstance(existingWidget.id);
              }
            }
          }

          const uid = this.generateUID();

          // Tạo item mới với đầy đủ thông tin
          const widget = this.widgets.find((w) => w.type === widgetType);
          if (!widget) {
            console.warn(`Widget type ${widgetType} not found`);
            return;
          }

          const item = {
            id: uid,
            uid,
            type: widgetType,
            x: newWidget.x,
            y: newWidget.y,
            w: newWidget.w,
            h: newWidget.h,
            minW: widget.defaultWidgetData.minW,
            maxW: widget.defaultWidgetData.maxW,
            minH: widget.defaultWidgetData.minH,
            maxH: widget.defaultWidgetData.maxH,
            disableDrag: widget.defaultWidgetData.disableDrag,
            disableResize: widget.defaultWidgetData.disableResize,
          };

          // Nếu là widget camera, thêm thông tin camera
          if (widgetType === 'CamerasWidget' && cameraName) {
            const camera = widget.items.find((cam) => cam.name === cameraName);
            if (camera) {
              item.cameraName = camera.name;
              item.name = camera.name;
            }
          }

          // Xóa widget cũ và tạo instance mới
          this.grid.removeWidget(newWidget.el, true, false);
          const instance = this.createInstance(uid, widgetType, item);

          if (instance) {
            this.grid.addWidget({
              ...item,
              content: instance.div.outerHTML,
            });

            document.getElementById(instance.div.id).appendChild(instance.instance.$el);
            this.items.push(item);
          }
        }
        this.itemChange = false;
      };

      // Đăng ký các sự kiện
      this.grid.on('drag dragstart resizestart', () => {
        this.toggleWidgetsNavi(false);
        this.itemChange = true;
      });

      this.grid.on('dropped dragstop resizestop', handleGridDrop);
      this.grid.on('change', handleGridChange);
      this.grid.on('removed', async (event, items) => {
        const [removedItem] = items;
        this.items = this.items.filter((item) => item.id !== removedItem.id);
        this.destroyInstance(removedItem.id);
        await timeout(100);
        this.setupDrag();
      });

      this.createLayout();
      this.setupDrag();
      this.onResize();

      ['resize', 'orientationchange'].forEach((event) => {
        window.addEventListener(event, this.onResize);
      });

      this.$watch('items', this.widgetsWatcher, { deep: true });
      this.$watch('locked', this.lockWatcher, { deep: true });
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    // Dọn dẹp event listeners để tránh memory leak
    ['resize', 'orientationchange'].forEach((event) => {
      window.removeEventListener(event, this.onResize);
    });

    // Nếu grid tồn tại, hủy tất cả event listeners
    if (this.grid) {
      this.grid.off('drag dragstart resizestart');
      this.grid.off('dropped dragstop resizestop');
      this.grid.off('change');
      this.grid.off('removed');
    }

    // Hủy mọi timeout đang chạy
    if (this.widgetsTimeout) {
      clearTimeout(this.widgetsTimeout);
      this.widgetsTimeout = null;
    }

    // Hủy interval auto refresh
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }

    this.destroyInstance();
  },

  methods: {
    generateUID() {
      return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    cellHeight() {
      const width = this.windowWidth() < 1100 ? this.windowWidth() : 1100;
      return width / 12 < 75 ? 75 : width / 12;
    },
    createInstance(uid, widgetType, item) {
      // Cache widget để tránh tìm kiếm nhiều lần
      const widget = this.widgets.find((w) => w.type === widgetType);

      if (!widget) {
        console.warn(`Widget type ${widgetType} not found`);
        return null;
      }

      // Tạo instance với đầy đủ thông tin
      const instance = new (Vue.extend(widget.widgetComponent))({
        router,
        store,
        vuetify,
        i18n,
        propsData: {
          item: {
            id: uid,
            type: widgetType,
            uid,
            name: item.name,
            // Thêm các thuộc tính mặc định từ widget
            minW: widget.defaultWidgetData.minW,
            maxW: widget.defaultWidgetData.maxW,
            minH: widget.defaultWidgetData.minH,
            maxH: widget.defaultWidgetData.maxH,
            disableDrag: widget.defaultWidgetData.disableDrag,
            disableResize: widget.defaultWidgetData.disableResize,
          },
          grid: this.grid,
        },
      });

      const div = document.createElement('div');
      div.id = `widget-container-${uid}`;
      div.classList.add('tw-h-full', 'tw-w-full', 'tw-relative', 'tw-z-1');

      instance.$on('refreshDrag', this.setupDrag);
      instance.$on('widgetData', this.widgetData);
      instance.$mount(div);

      this.instances[uid] = instance;
      return { instance, div };
    },
    async createLayout() {
      // Xử lý tất cả items cùng một lúc
      const validItems = this.items.filter((item) => {
        const instance = this.createInstance(item.uid || item.id, item.type, item);
        if (!instance) return false;

        const widget = this.widgets.find((w) => w.type === item.type);
        if (!widget) return false;

        // Cập nhật item với thông tin mới
        Object.assign(item, {
          content: instance.div.outerHTML,
          minW: widget.defaultWidgetData.minW,
          maxW: widget.defaultWidgetData.maxW,
          minH: widget.defaultWidgetData.minH,
          maxH: widget.defaultWidgetData.maxH,
          disableDrag: widget.defaultWidgetData.disableDrag,
          disableResize: widget.defaultWidgetData.disableResize,
        });

        // Thêm widget vào grid và mount component
        this.grid.addWidget(item);
        document.getElementById(instance.div.id).appendChild(instance.instance.$el);
        return true;
      });

      this.items = validItems;
    },
    destroyInstance(id) {
      if (id) {
        this.instances[id]?.$destroy();
        delete this.instances[id];
      } else {
        for (const instance of Object.keys(this.instances)) {
          this.instances[instance].$destroy();
        }
      }
    },
    isMobile() {
      return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.platform) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      );
    },
    async lockWatcher() {
      try {
        await changeSetting('widgets', {
          options: {
            locked: this.locked,
          },
        });
      } catch (err) {
        if (err.response && err.response.status === 403) {
          this.$toast.error('Bạn không có quyền để làm điều này');
          // Revert lock state if permission denied
          //this.locked = !this.locked;
        } else {
          this.$toast.error(err.message);
        }
        console.log(err);
      }
    },
    async onResize() {
      this.toggleWidgetsNavi(false);
      this.showWidgetsNavi = this.windowWidth() < 768;

      if (this.grid) {
        const items = [...this.items];

        if (this.windowWidth() < 576 && this.grid.getColumn() !== 1) {
          this.grid.margin('10px 0px 10px 0px');
          this.grid.column(1).cellHeight(100).compact().disable();
        } else if (this.windowWidth() >= 576 && this.windowWidth() < 768 && this.grid.getColumn() !== 2) {
          this.grid.margin('10px 5px 10px 5px');
          this.grid.column(2).cellHeight(75).compact().disable();
        } else if (this.windowWidth() >= 768 && this.grid.getColumn() !== 12) {
          this.resizedBack = true;

          this.grid.margin('10px 10px 10px 10px');
          this.grid.column(12).cellHeight(this.cellHeight());

          if (this.locked) {
            this.grid.disable();
          } else {
            this.grid.enable();
          }

          // Đảm bảo điều khiển resize vẫn hiển thị nếu cần
          if (this.windowWidth() >= 1200) {
            this.grid.opts.resizable = {
              autoHide: false, // Luôn hiển thị điều khiển resize
              handles: 'all',
            };
          }

          const gridItems = this.grid.getGridItems();
          items.forEach((item) => {
            const el = gridItems.find((el) => el.gridstackNode.id === item.id);
            if (el) {
              el.setAttribute('gs-x', item.x);
              el.setAttribute('gs-y', item.y);
              el.setAttribute('gs-w', item.w);
              el.setAttribute('gs-h', item.h);
              this.grid.batchUpdate();
            }
          });

          this.grid.commit();

          this.resizedBack = false;
        }
      }
    },
    setupDrag() {
      GridStack.setupDragIn('.widget .grid-stack-item', {
        revert: 'invalid',
        scroll: false,
        appendTo: '.grid-stack',
        helper: (e) => {
          const el = e.target.closest('.grid-stack-item');
          const clone = el.cloneNode(true);
          // Đảm bảo clone có attribute data-widget-type
          clone.setAttribute('data-widget-type', el.getAttribute('data-widget-type') || el.getAttribute('gs-type'));
          return clone;
        },
      });
    },
    toggleLock() {
      this.locked = !this.locked;

      if (this.locked) {
        this.grid.disable();
      } else {
        this.grid.enable();
      }
    },
    toggleWidgetsNavi(state) {
      bus.$emit('showWidgetsNavi', state);
      this.setupDrag();
    },
    windowWidth() {
      return window.innerWidth && document.documentElement.clientWidth
        ? Math.min(window.innerWidth, document.documentElement.clientWidth)
        : window.innerWidth ||
            document.documentElement.clientWidth ||
            document.getElementsByTagName('body')[0].clientWidth;
    },
    windowHeight() {
      return document.getElementById('dashboard')?.offsetHeight;
    },
    widgetData(widget) {
      this.items = this.items.map((item) => {
        if (item.id === widget.id) {
          return {
            ...item,
            ...widget.data,
          };
        }

        return item;
      });
    },
    async widgetsWatcher(items) {
      // Nếu là người dùng dashboard thì không cần gọi API settings
      if (this.isDashboardOnlyUser) {
        return;
      }

      if (this.widgetsTimeout) {
        clearTimeout(this.widgetsTimeout);
        this.widgetsTimeout = null;
      }

      items.forEach((item) => {
        delete item.minW;
        delete item.maxW;
        delete item.minH;
        delete item.maxH;
        delete item.disableDrag;
        delete item.disableResize;
        delete item.content;
      });

      this.widgetsTimeout = setTimeout(async () => {
        try {
          await changeSetting('widgets', {
            items: items,
          });
        } catch (err) {
          if (err.response && err.response.status === 403) {
            this.$toast.error('Bạn không có quyền để làm điều này');
          } else {
            this.$toast.error(err.message);
          }
          console.log(err);
        }
      }, 250);
    },
    toggleTheme() {
      const currentTheme = localStorage.getItem('theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      const color = localStorage.getItem('theme-color') || 'pink';

      localStorage.setItem('theme', newTheme);
      localStorage.setItem('darkmode', 'manual');

      this.$store.commit('config/setTheme', `${newTheme}-${color}`);
      this.showSettingsMenu = false;
    },

    async logout() {
      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 200);
    },

    // Thêm phương thức để thiết lập auto refresh
    setupAutoRefresh() {
      // Tạo hash ban đầu
      this.lastWidgetsHash = this.calculateWidgetsHash(this.items);

      // Thiết lập interval để kiểm tra thay đổi mỗi 30 giây
      this.autoRefreshInterval = setInterval(async () => {
        try {
          // Lấy dữ liệu widgets từ server
          const widgets = await getSetting('widgets');
          const serverItems = widgets.data.items;

          // Tính toán hash mới
          const newHash = this.calculateWidgetsHash(serverItems);

          // So sánh với hash cũ
          if (newHash !== this.lastWidgetsHash) {
            console.log('Phát hiện thay đổi widgets, đang cập nhật...');

            // Cập nhật hash
            this.lastWidgetsHash = newHash;

            // Cập nhật items
            this.updateWidgetsFromServer(serverItems);
          }
        } catch (err) {
          console.error('Lỗi khi tự động làm mới widgets:', err);
        }
      }, 30000); // 30 giây
    },

    // Tính toán hash từ danh sách widgets
    calculateWidgetsHash(items) {
      // Tạo bản sao của items và loại bỏ các thuộc tính không cần thiết
      const cleanItems = items.map((item) => {
        // Tạo một bản sao mới không bao gồm thuộc tính content
        const cleanItem = { ...item };
        delete cleanItem.content;
        delete cleanItem.minW;
        delete cleanItem.maxW;
        delete cleanItem.minH;
        delete cleanItem.maxH;
        delete cleanItem.disableDrag;
        delete cleanItem.disableResize;
        return cleanItem;
      });

      // Chuyển đổi thành chuỗi JSON và tạo hash đơn giản
      return JSON.stringify(cleanItems);
    },

    // Cập nhật widgets từ server
    async updateWidgetsFromServer(serverItems) {
      // Xóa tất cả widget hiện tại
      this.grid.removeAll();

      // Xóa tất cả instance
      this.destroyInstance();

      // Cập nhật items
      this.items = serverItems;

      // Tạo lại layout
      await this.createLayout();

      // Thông báo cho người dùng
      this.$toast.info('Dashboard đã được cập nhật theo thay đổi mới nhất', {
        duration: 3000,
      });
    },
  },
};
</script>

<style scoped>
.subtitle {
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.drag-info {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: rgba(var(--cui-text-default-rgb), 0.03);
  font-weight: bolder;
  font-size: 1.5rem;
}

#dashboard {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 15px; /* Thêm padding để tránh thanh cuộn che mất nội dung */
  min-width: 100%;
}

.grid-stack {
  /* 100vh - navbar - saveAreaTop - paddingTop - paddingBottom - title - footer */
  min-height: calc(
    100vh - 64px - env(safe-area-inset-top, 12px) - env(safe-area-inset-bottom, 12px) - 1.5rem - 1.5rem - 64px - 44px -
      50px
  );
  min-width: 1200px; /* Chiều rộng tối thiểu để đảm bảo có thể cuộn ngang */
}

.grid-stack-dragging-border {
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='10' ry='10' stroke='%2371717133' stroke-width='4' stroke-dasharray='6%2c 14' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
  border-radius: 10px;
}

.grid-stack >>> .grid-stack-item-content {
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0px 0px 10px 3px rgb(0 0 0 / 10%);
}

.grid-stack >>> .grid-stack-placeholder {
  /*border: 2px solid var(--cui-bg-disabled) !important;*/
}

.grid-stack >>> .placeholder-content {
  border: none !important;
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='10' ry='10' stroke='%2371717133' stroke-width='4' stroke-dasharray='6%2c 14' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
  border-radius: 10px;
  background-color: rgba(var(--cui-text-default-rgb), 0.05) !important;
}

.grid-stack >>> .ui-resizable-ne {
  transform: none;
  background: none;
  right: 10px !important;
  top: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
}

.grid-stack >>> .ui-resizable-nw {
  transform: none;
  background: none;
  left: 10px !important;
  top: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
}

.grid-stack >>> .ui-resizable-se {
  transform: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' style='width:24px;height:24px' viewBox='0 0 24 24'%3E%3Cpath fill='rgba(109, 109, 109, 0.7)' d='M22,22H20V20H22V22M22,18H20V16H22V18M18,22H16V20H18V22M18,18H16V16H18V18M14,22H12V20H14V22M22,14H20V12H22V14Z' /%3E%3C/svg%3E");
  background-size: 100%;
  background-position: -5px -5px;
  right: 10px !important;
  bottom: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
  opacity: 0.8;
}

.grid-stack >>> .ui-resizable-sw {
  transform: none;
  background: none;
  left: 10px !important;
  bottom: 10px !important;
  width: 20px;
  height: 20px;
  z-index: 2 !important;
}

.grid-stack >>> .ui-resizable-e {
  z-index: 1 !important;
  right: 10px !important;
  top: 20px !important;
  bottom: 20px !important;
  width: 8px !important; /* Làm dày handler để dễ bắt hơn */
  background-color: rgba(var(--cui-text-default-rgb), 0.1);
  border-radius: 4px;
}

.grid-stack >>> .ui-resizable-w {
  z-index: 1 !important;
  left: 10px !important;
  top: 20px !important;
  bottom: 20px !important;
  width: 8px !important; /* Làm dày handler để dễ bắt hơn */
  background-color: rgba(var(--cui-text-default-rgb), 0.1);
  border-radius: 4px;
}

.grid-stack >>> .ui-resizable-n {
  z-index: 1 !important;
  left: 20px !important;
  right: 20px !important;
  top: 10px !important;
}

.grid-stack >>> .ui-resizable-s {
  z-index: 1 !important;
  left: 20px !important;
  right: 20px !important;
  bottom: 10px !important;
}

div >>> .grid-stack-item-removing .grid-stack-item-content {
  opacity: 0.5 !important;
  border: 2px solid rgba(255, 0, 0, 0.5);
  border-radius: 12px;
}

div >>> .ui-draggable-dragging .grid-stack-item-content,
div >>> .ui-resizable-resizing .grid-stack-item-content {
  box-shadow: none !important;
}

/* animate new box */
.grid-stack >>> .grid-stack-item:not(.grid-stack-placeholder) {
  -webkit-animation: slide-in-fwd-center 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
  animation: slide-in-fwd-center 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}

/* ----------------------------------------------
 * Generated by Animista on 2021-12-17 18:18:5
 * Licensed under FreeBSD License.
 * See http://animista.net/license for more info. 
 * w: http://animista.net, t: @cssanimista
 * ---------------------------------------------- */

/**
 * ----------------------------------------
 * animation slide-in-fwd-center
 * ----------------------------------------
 */
@-webkit-keyframes slide-in-fwd-center {
  0% {
    -webkit-transform: translateZ(-1400px);
    transform: translateZ(-1400px);
    opacity: 0;
  }

  100% {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    opacity: 1;
  }
}

@keyframes slide-in-fwd-center {
  0% {
    -webkit-transform: translateZ(-1400px);
    transform: translateZ(-1400px);
    opacity: 0;
  }

  100% {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    opacity: 1;
  }
}

/* Hiển thị rõ hơn khi hover */
.grid-stack >>> .ui-resizable-handle:hover {
  background-color: rgba(var(--cui-primary-rgb), 0.3);
}

/* Điều chỉnh màu chữ cho pop up editor */
:deep(.ql-editor) {
  color: var(--cui-text-default) !important;
}

:deep(.ql-editor[data-placeholder]::before) {
  color: var(--cui-text-hint) !important;
  opacity: 0.6;
}

:deep(.ql-tooltip) {
  background-color: var(--cui-bg-default) !important;
  color: var(--cui-text-default) !important;
  border-color: var(--cui-border-color) !important;
}

:deep(.ql-tooltip input[type='text']) {
  color: var(--cui-text-default) !important;
  background-color: var(--cui-bg-default) !important;
  border-color: var(--cui-border-color) !important;
}

:deep(.ql-clipboard) {
  color: var(--cui-text-default) !important;
}

:deep(.ql-container.ql-snow) {
  border-color: var(--cui-border-color) !important;
}

:deep(.ql-toolbar.ql-snow) {
  border-color: var(--cui-border-color) !important;
  background-color: var(--cui-bg-default) !important;
}

:deep(.ql-toolbar) {
  color: var(--cui-text-default) !important;
}

:deep(.ql-picker-label) {
  color: var(--cui-text-default) !important;
}

:deep(.ql-picker-options) {
  background-color: var(--cui-bg-default) !important;
  color: var(--cui-text-default) !important;
  border-color: var(--cui-border-color) !important;
}

:deep(.ql-picker-item) {
  color: var(--cui-text-default) !important;
}

:deep(.ql-stroke) {
  stroke: var(--cui-text-default) !important;
}

:deep(.ql-fill) {
  fill: var(--cui-text-default) !important;
}

:deep(.ql-picker-options .ql-picker-item:hover) {
  color: var(--cui-primary) !important;
}

:deep(.ql-toolbar button:hover .ql-stroke) {
  stroke: var(--cui-primary) !important;
}

:deep(.ql-toolbar button:hover .ql-fill) {
  fill: var(--cui-primary) !important;
}

:deep(.ql-tooltip a.ql-action),
:deep(.ql-tooltip a.ql-remove) {
  color: var(--cui-primary) !important;
}

:deep(.ql-tooltip a.ql-preview) {
  color: var(--cui-text-default) !important;
}
</style>
