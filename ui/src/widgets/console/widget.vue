<template lang="pug">
  .content.tw-overflow-y-auto
    .tw-flex.tw-justify-between.tw-mt-1.tw-relative.tw-z-5(style="height: 25px;")
      .tw-ml-2.tw-text-xs.tw-font-bold.text-muted {{ $t('console') }}
      .tw-ml-auto.tw-mr-2(v-if="isAdmin")
        v-btn.text-muted.tw-mr-2(icon x-small @click="openEditor" style="margin-top: -5px;")
          v-icon {{ icons['mdiPencil'] }}
    
    .tw-w-full.tw-flex.tw-items-center.tw-justify-center(v-if="loading" style="height: calc(100% - 25px - 0.25rem)")
      v-progress-circular(indeterminate color="var(--cui-primary)" size="20")
    
    .tw-w-full.tw-h-full.tw-overflow-hidden(v-else style="height: calc(100% - 25px - 0.25rem);")
      // User view với nội dung được format (cho cả admin và user)
      .user-content.tw-h-full.tw-p-4.tw-overflow-y-auto(v-html="sanitizedContent")

    // Dialog cho phép edit
    v-dialog(v-model="showEditor" max-width="800px" persistent)
      v-card
        v-card-title.tw-flex.tw-justify-between
          span {{ $t('Edit Console Content') }}
          v-btn(icon @click="closeEditor")
            v-icon {{ icons['mdiClose'] }}
        v-card-text
          .editor-wrapper
            vue-editor.editor(
              ref="editor"
              :value="content"
              :editor-toolbar="customToolbar"
              :placeholder="$t('Type something')"
              @input="updateContent"
            )
        v-card-actions.tw-p-4
          v-spacer
          v-btn(
            text
            color="grey darken-1"
            @click="closeEditor"
          ) {{ $t('Cancel') }}
          v-btn(
            color="success"
            @click="saveAndClose"
            :loading="loading"
          ) {{ $t('Save') }}
</template>

<script>
import { mdiContentSave, mdiPencil, mdiClose } from '@mdi/js';
import { getSetting, changeSetting } from '@/api/settings.api';
import { VueEditor } from 'vue2-editor';
import DOMPurify from 'dompurify';

export default {
  name: 'ConsoleWidget',

  components: {
    VueEditor,
  },

  props: {
    item: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      loading: true,
      content: '',
      showEditor: false,
      checkInterval: null,
      lastUpdated: null,
      customToolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        ['blockquote', 'code-block'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        [{ align: [] }],
        ['clean'],
      ],
      icons: {
        mdiContentSave,
        mdiPencil,
        mdiClose,
      },
    };
  },

  computed: {
    isAdmin() {
      const user = this.$store.state.auth.user || {};
      return user.permissionLevel?.includes('admin');
    },
    sanitizedContent() {
      return DOMPurify.sanitize(this.content);
    },
  },

  async mounted() {
    await this.loadContent();
    this.startAutoRefresh();
  },

  beforeDestroy() {
    this.stopAutoRefresh();
  },

  methods: {
    updateContent(value) {
      if (typeof value === 'string') {
        this.content = value;
        // Lưu nội dung vào localStorage với key là widget ID
        localStorage.setItem(`console-widget-${this.item.id}`, value);
      }
    },

    openEditor() {
      this.showEditor = true;
    },

    closeEditor() {
      this.showEditor = false;
      this.loadContent(); // Reset content to last saved state
    },

    async saveAndClose() {
      await this.saveContent();
      this.showEditor = false;
    },

    async loadContent() {
      try {
        // Trước tiên thử lấy từ localStorage
        const cachedContent = localStorage.getItem(`console-widget-${this.item.id}`);

        const response = await getSetting('widgets');
        if (response && response.data) {
          const items = response.data.items || [];
          const consoleWidget = items.find((item) => item.id === this.item.id);
          if (consoleWidget && typeof consoleWidget.content === 'string') {
            this.content = consoleWidget.content;
            // Cập nhật cache
            localStorage.setItem(`console-widget-${this.item.id}`, consoleWidget.content);
          } else if (cachedContent) {
            // Nếu không có dữ liệu từ API nhưng có trong cache
            this.content = cachedContent;
          }
        } else if (cachedContent) {
          // Nếu không có response từ API nhưng có trong cache
          this.content = cachedContent;
        }
        this.loading = false;
      } catch (err) {
        console.error('Error loading console content:', err);
        // Nếu có lỗi, thử lấy từ cache
        const cachedContent = localStorage.getItem(`console-widget-${this.item.id}`);
        if (cachedContent) {
          this.content = cachedContent;
        }
        this.$toast.error(err.message);
        this.loading = false;
      }
    },

    async saveContent() {
      if (!this.isAdmin) {
        this.$toast.error(this.$t('permission_required'));
        return;
      }

      try {
        this.loading = true;
        const response = await getSetting('widgets');
        const currentItems = response.data.items || [];
        const updatedItems = currentItems.map((item) => {
          if (item.id === this.item.id) {
            return {
              ...item,
              content: this.content,
              lastUpdated: Date.now(),
            };
          }
          return item;
        });

        await changeSetting('widgets', {
          items: updatedItems,
        });

        this.$toast.success(this.$t('content_saved'));
      } catch (err) {
        console.error('Error saving console content:', err);
        this.$toast.error(err.message);
      } finally {
        this.loading = false;
      }
    },

    async checkForUpdates() {
      try {
        const response = await getSetting('widgets');
        if (response && response.data) {
          const items = response.data.items || [];
          const consoleWidget = items.find((item) => item.id === this.item.id);
          if (consoleWidget && typeof consoleWidget.content === 'string') {
            // Kiểm tra nếu có cập nhật mới
            if (consoleWidget.lastUpdated !== this.lastUpdated) {
              this.content = consoleWidget.content;
              this.lastUpdated = consoleWidget.lastUpdated;
            }
          }
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
  },
};
</script>

<style lang="scss">
.content {
  width: 100%;
  min-height: 100%;
  height: auto;
  background: rgba(var(--cui-bg-card-border-rgb), 0.5);
  border-radius: 10px;
  -webkit-box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  box-shadow: 0px 0px 10px 3px rgba(0, 0, 0, 0.1);
  border: 2px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
}

.editor-wrapper {
  height: 100%;
  min-height: 300px;

  :deep(.quill-editor) {
    height: 100%;
    background: rgba(var(--cui-bg-card-border-rgb), 0.5);
    border-radius: 8px;
    border: 1px solid rgba(var(--cui-bg-card-border-rgb), 0.5);

    .ql-toolbar {
      position: sticky;
      top: 0;
      z-index: 1;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      border-bottom: 1px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
      background: rgba(var(--cui-bg-card-border-rgb), 0.5);

      .ql-formats {
        button {
          color: var(--cui-text-default);

          &:hover {
            color: var(--cui-primary);
          }

          &.ql-active {
            color: var(--cui-primary);
          }
        }

        .ql-picker {
          color: var(--cui-text-default);

          &:hover .ql-picker-label {
            color: var(--cui-primary);
          }

          &.ql-expanded .ql-picker-label {
            color: var(--cui-primary);
          }
        }
      }
    }

    .ql-container {
      height: auto;
      min-height: calc(100% - 42px);
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
      background: rgba(var(--cui-bg-card-border-rgb), 0.5);
      color: var(--cui-text-default);

      .ql-editor {
        &.ql-blank::before {
          color: var(--cui-text-hint);
        }

        p {
          color: var(--cui-text-default);
        }
      }
    }
  }
}

.user-content {
  height: auto;
  min-height: 100%;
  color: var(--cui-text-default);
  padding: 0;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 1em 0 0.5em;
    color: var(--cui-text-default);
  }

  p {
    margin: 0.5em 0;
    line-height: 1.6;
  }

  ul,
  ol {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }

  code {
    background: rgba(var(--cui-bg-card-border-rgb), 0.2);
    padding: 0.2em 0.4em;
    border-radius: 4px;
    font-family: monospace;
  }

  blockquote {
    border-left: 3px solid var(--cui-primary);
    padding-left: 1em;
    margin: 1em 0;
    color: var(--cui-text-hint);
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
    margin: 1em 0;
  }

  a {
    color: var(--cui-primary);
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;

    th,
    td {
      border: 1px solid rgba(var(--cui-bg-card-border-rgb), 0.5);
      padding: 0.5em;
      text-align: left;
    }

    th {
      background: rgba(var(--cui-bg-card-border-rgb), 0.1);
    }
  }
}

.v-dialog {
  .editor-wrapper {
    min-height: 400px;
    margin: 1rem 0;

    :deep(.quill-editor) {
      background: rgba(var(--cui-bg-card-border-rgb), 0.5);

      .ql-toolbar {
        background: rgba(var(--cui-bg-card-border-rgb), 0.5);
      }

      .ql-container {
        background: rgba(var(--cui-bg-card-border-rgb), 0.5);
      }
    }
  }
}
</style>
