<template lang="pug">
.loader.tw-flex.tw-justify-center.tw-align-center
  inline-svg.tw-object-contain(:src="require('../assets/img/logo_loading_circle.svg')" alt="DBplus camera" style="width: 400px;")
</template>

<script>
import InlineSvg from 'vue-inline-svg';

export default {
  name: 'Loader',

  components: {
    InlineSvg,
  },

  props: {
    reload: Boolean,
  },

  data: () => ({
    loaderTimeout: null,
  }),

  mounted() {
    if (this.reload) {
      this.loaderTimeout = setInterval(() => {
        const dbplusLens = document.getElementById('lens');
        dbplusLens?.classList.remove('cameraLens');

        setTimeout(() => {
          dbplusLens?.classList.add('cameraLens');
        }, 100);
      }, 2300);
    }
  },

  beforeDestroy() {
    if (this.loaderTimeout) {
      clearInterval(this.loaderTimeout);
      this.loaderTimeout = null;
    }
  },
};
</script>

<style scoped>
.loader {
  background: rgba(var(--cui-bg-default-rgb));
  width: 100vw;
  min-width: 100vw;
  max-width: 100vw;
  height: 100vh;
  min-height: 100vh;
  max-height: 100vh;
}

div >>> .cameraLens {
  -webkit-animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards,
    lensRotate 0.8s ease-in-out 0.4s forwards, lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  -moz-animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards, lensRotate 0.8s ease-in-out 0.4s forwards,
    lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  -o-animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards, lensRotate 0.8s ease-in-out 0.4s forwards,
    lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  animation: lensMove 0.8s cubic-bezier(0.47, 1.84, 0.21, 0.8) forwards, lensRotate 0.8s ease-in-out 0.4s forwards,
    lensMoveBack 0.6s cubic-bezier(0.47, 1.84, 0.21, 0.8) 1.3s forwards;
  -webkit-transform-origin: 69px 80px;
  -moz-transform-origin: 69px 80px;
  -o-transform-origin: 69px 80px;
  transform-origin: 69px 80px;
}

@keyframes lensMove {
  0% {
    -webkit-transform: translateY(0px);
    -moz-transform: translateY(0px);
    -o-transform: translateY(0px);
    transform: translateY(0px);
  }
  100% {
    -webkit-transform: translateY(-15px);
    -moz-transform: translateY(-15px);
    -o-transform: translateY(-15px);
    transform: translateY(-15px);
  }
}

@keyframes lensMoveBack {
  0% {
    -webkit-transform: translateY(-15px);
    -moz-transform: translateY(-15px);
    -o-transform: translateY(-15px);
    transform: translateY(-15px);
  }
  100% {
    -webkit-transform: translateY(0px);
    -moz-transform: translateY(0px);
    -o-transform: translateY(0px);
    transform: translateY(0px);
  }
}

@keyframes lensRotate {
  0% {
    -webkit-transform: translateY(-15px) rotate(0deg);
    -moz-transform: translateY(-15px) rotate(0deg);
    -o-transform: translateY(-15px) rotate(0deg);
    transform: translateY(-15px) rotate(0deg);
  }
  100% {
    -webkit-transform: translateY(-15px) rotate(360deg);
    -moz-transform: translateY(-15px) rotate(360deg);
    -o-transform: translateY(-15px) rotate(360deg);
    transform: translateY(-15px) rotate(360deg);
  }
}
</style>
