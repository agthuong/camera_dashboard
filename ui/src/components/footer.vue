<template lang="pug">
v-footer.footer.tw-text-xs.tw-z-0(padless app absolute)
  .footer-wrapper.tw-flex.tw-items-center.tw-justify-end
    span.footer-link {{ new Date().getFullYear() }} - DBplus camera
</template>

<script>
export default {
  name: 'Footer',
};
</script>

<style scoped>
.footer {
  height: 44px;
  background: rgba(var(--cui-bg-app-bar-rgb)) !important;
  color: rgba(var(--cui-text-third-rgb)) !important;
}

.footer-wrapper {
  width: 100%;
  text-align: right;
  padding-right: 1rem;
}

.footer-link {
  text-decoration: none;
  color: var(--cui-text-default);
}
</style>
