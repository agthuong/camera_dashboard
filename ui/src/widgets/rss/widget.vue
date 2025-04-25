<template lang="pug">
  .content.tw-overflow-y-hidden
    .tw-flex.tw-justify-between.tw-mt-1.tw-relative.tw-z-5(style="height: 25px;")
      .tw-ml-2.tw-text-xs.tw-font-bold.text-muted {{ $t('rss_feed') }}
      .tw-ml-auto.tw-mr-2
        v-btn.text-muted(v-if="!isDashboard" icon x-small @click="reloadFeed" style="margin-top: -5px;")
          v-icon {{ icons['mdiReload'] }}
        v-btn.text-muted(v-if="isAdmin" icon x-small @click="dialog = true" style="margin-top: -5px;")
          v-icon {{ icons['mdiCog'] }}
  
    .tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading" style="height: calc(100% - 25px - 0.25rem)")
      v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
    
    .tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-else-if="!feed && isAdmin" style="height: calc(100% - 25px - 0.25rem)")
      v-btn(fab small depressed @click="dialog = true" color="var(--cui-text-hint)")
        v-icon.text-default {{ icons['mdiPlusThick'] }}
    
    .tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-else-if="!feed && !isAdmin" style="height: calc(100% - 25px - 0.25rem)")
      span.text-muted {{ $t('no_rss_feed_configured') }}
    
    .tw-w-full.tw-overflow-hidden(v-else style="height: calc(100% - 25px - 0.25rem);")
      div.tw-w-full.tw-h-full(v-if="isIframeCode" v-html="feed")
      iframe.tw-w-full.tw-h-full(
        v-else
        :src="feed"
        :key="iframeKey"
        frameborder="0"
        style="border-radius: 8px;"
      )
  
    v-dialog(v-model="dialog" width="400" scrollable)
      v-card(height="350")
        v-card-title {{ $t('rss_feed') }}
        v-divider
        v-card-text.tw-p-7.tw-flex.tw-flex-col.tw-items-center.tw-justify-center
          .tw-block(v-if="loadingDialog")
            v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
  
          .tw-w-full(v-else)
            v-sheet.tw-p-3(rounded class="mx-auto" width="100%" color="rgba(0,0,0,0.2)")
              span.text-default {{ $t('rss_feed_widget_info') }}
              
            .tw-w-full.tw-mt-5
              label.text-default {{ $t('rss_url') }}
              v-text-field(v-model="feedValue" persistent-hint prepend-inner-icon="mdi-rss" background-color="var(--cui-bg-card)" color="var(--cui-text-default)" solo)
                template(v-slot:prepend-inner)
                    v-icon.text-muted {{ icons['mdiRss'] }}
  
        v-divider
        v-card-actions.tw-flex.tw-justify-end
          v-btn.text-default(text @click='dialog = false') {{ $t('cancel') }}
          v-btn(color='var(--cui-primary)' text @click='applyData') {{ $t('apply') }}
        
  </template>

<script>
/* eslint-disable vue/require-default-prop */
import { mdiCog, mdiPlusThick, mdiReload, mdiRss } from '@mdi/js';
import { getSetting } from '@/api/settings.api';

export default {
  name: 'RssWidget',

  props: {
    item: Object,
  },

  data() {
    return {
      loading: true,
      loadingDialog: false,
      dialog: null,
      iframeKey: 0,
      checkInterval: null,
      lastUpdated: null,

      icons: {
        mdiCog,
        mdiPlusThick,
        mdiReload,
        mdiRss,
      },

      feed: '',
      feedValue: '',
      isIframeCode: false,
    };
  },

  computed: {
    isAdmin() {
      const user = this.$store.state.auth.user || {};
      return user.permissionLevel?.includes('admin');
    },
    isDashboard() {
      return this.$route.name === 'dashboard';
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
      const widgets = await getSetting('widgets');
      const items = widgets.data.items;
      const rssWidget = items.find((item) => item.id === this.item.id);

      if (rssWidget?.feed) {
        this.feedValue = rssWidget.feed;
        this.lastUpdated = rssWidget.lastUpdated;
        if (this.feedValue.trim().toLowerCase().startsWith('<iframe')) {
          const attrs = this.parseIframeCode(this.feedValue);
          if (attrs) {
            this.isIframeCode = true;
            this.feed = attrs.src || '';
          }
        } else {
          this.feed = this.feedValue;
        }
      }

      this.loading = false;
      this.startAutoRefresh();
    } catch (err) {
      console.log(err);
      this.$toast.error(err.message);
    }
  },

  beforeDestroy() {
    this.stopAutoRefresh();
  },

  methods: {
    parseIframeCode(code) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(code, 'text/html');
      const iframe = doc.querySelector('iframe');

      if (iframe) {
        const attributes = {};
        for (const attr of iframe.attributes) {
          attributes[attr.name] = attr.value;
        }
        return attributes;
      }
      return null;
    },

    async applyData() {
      // Chỉ admin mới được cấu hình RSS feed
      if (!this.isAdmin) {
        this.$toast.error(this.$t('permission_required'));
        return;
      }

      this.loadingDialog = true;
      try {
        if (this.feedValue.trim().toLowerCase().startsWith('<iframe')) {
          this.isIframeCode = true;
          this.feed = this.feedValue;
        } else {
          this.isIframeCode = false;
          this.feed = this.feedValue;
        }

        this.$emit('widgetData', {
          id: this.item.id,
          data: {
            feed: this.feedValue,
            lastUpdated: Date.now(),
            isIframeCode: this.isIframeCode,
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
        const rssWidget = items.find((item) => item.id === this.item.id);

        if (rssWidget?.feed && rssWidget.lastUpdated !== this.lastUpdated) {
          this.feedValue = rssWidget.feed;
          if (this.feedValue.trim().toLowerCase().startsWith('<iframe')) {
            const attrs = this.parseIframeCode(this.feedValue);
            if (attrs) {
              this.isIframeCode = true;
              this.feed = attrs.src || '';
            }
          } else {
            this.feed = this.feedValue;
          }
          this.lastUpdated = rssWidget.lastUpdated;
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

    reloadFeed() {
      this.iframeKey++; // Force iframe reload
    },
  },
};
</script>

<style scoped>
.content {
  width: 100%;
  height: 100%;
  min-height: 100px;
  background: var(--cui-bg-default);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

iframe {
  background: transparent;
}
</style>
