<template lang="pug">
.tw-w-full
  v-progress-linear.loader(:active="loadingProgress" :indeterminate="loadingProgress" fixed top color="var(--cui-primary)")

  .tw-mb-7.tw-mt-5(v-if="!loading")
    .page-subtitle {{ $t('theme') }}
    .page-subtitle-info {{ $t('interface_appearance') }}

    .tw-w-full.tw-mt-4
      label.form-input-label {{ $t('color') }}
      v-select(v-model="appearance.color" :items="colors" prepend-inner-icon="mdi-palette" background-color="var(--cui-bg-card)" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiPalette'] }}

    v-divider.tw-mt-4.tw-mb-8

    .page-subtitle.tw-mt-8 {{ $t('language') }}
    .page-subtitle-info {{ $t('interface_language') }}

    .tw-w-full.tw-mt-4.tw-mb-8
      label.form-input-label {{ $t('language') }}
      v-select(v-model="appearance.lang" :items="langs" prepend-inner-icon="mdi-translate" background-color="var(--cui-bg-card)" required solo)
        template(v-slot:prepend-inner)
          v-icon.text-muted {{ icons['mdiTranslate'] }}

</template>

<script>
import { mdiPalette, mdiThemeLightDark, mdiTranslate } from '@mdi/js';

export default {
  name: 'AppearanceSettings',

  beforeRouteLeave(to, from, next) {
    this.loading = true;
    this.loadingProgress = true;
    next();
  },

  data() {
    return {
      icons: { mdiPalette, mdiThemeLightDark, mdiTranslate },

      loading: false,

      appearance: {
        color: 'pink',
        lang: 'en',
        mode: 'light',
      },

      modes: [
        {
          text: this.$t('dark'),
          value: 'dark',
        },
        {
          text: this.$t('light'),
          value: 'light',
        },
        {
          text: this.$t('auto'),
          value: 'auto',
        },
      ],
      colors: [],
      langs: [],
    };
  },

  computed: {
    uiConfig() {
      return this.$store.state.config.ui;
    },
  },

  async created() {
    for (const [key, value] of Object.entries(this.uiConfig.validLangs)) {
      this.langs.push({
        text: value,
        value: key,
      });
    }

    this.colors = [
      ...new Set(
        this.uiConfig.validThemes.map((color) => {
          return {
            text: this.$t(color.split('-')[1]),
            value: color.split('-')[1],
          };
        })
      ),
    ];

    this.appearance.color = localStorage.getItem('theme-color') || 'dbplus';
    this.appearance.lang = this.uiConfig.currentLanguage || 'en';
    this.appearance.mode = 'light';
    
    localStorage.setItem('theme', 'light');
    localStorage.setItem('darkmode', 'manual');
    document.documentElement.setAttribute('data-theme', 'light');

    this.$watch('appearance', this.appearanceWatcher, { deep: true });

    this.loading = false;
    this.loadingProgress = false;
  },

  methods: {
    async appearanceWatcher(newValue) {
      this.loadingProgress = true;

      let color = newValue.color;

      localStorage.setItem('darkmode', 'manual');
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');

      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this.matchMediaListener);

      const theme = `light-${color}`;
      this.$store.commit('config/setTheme', theme);

      const lang = newValue.lang;
      this.$store.commit('config/setLang', lang);

      this.loadingProgress = false;
    },
    matchMediaListener() {
    },
  },
};
</script>
