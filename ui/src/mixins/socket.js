import NotificationBanner from '@/components/notification-banner.vue';

export default {
  data() {
    return {
      notId: '',
      notIdInfo: '',
      notImages: [],
      registeredSocketEvents: [],
    };
  },
  computed: {
    currentUser() {
      return this.$store.state.auth.user;
    },
    isValidPage() {
      return this.$route.name !== 'Login' && this.$route.name !== 'Start';
    },
  },
  sockets: {
    connect() {
      console.log('Connected to socket');

      if (this.connected) {
        if (this.isPage('Dashboard')) {
          if (this.items && this.instances) {
            const cameras = this.items.filter((item) => item.type === 'CamerasWidget');

            for (const camera of cameras) {
              const instance = this.instances[camera.id];

              if (instance.$refs[camera.id]) {
                instance.$refs[camera.id].refreshStream(true);
              }
            }
          }
        } else if (this.isPage('Camview')) {
          if (this.cameras) {
            for (const camera of this.cameras) {
              if (camera.live) {
                if (this.$refs[camera.name] && this.$refs[camera.name][0]) {
                  this.$refs[camera.name][0].refreshStream(true);
                }
              }
            }
          }
        } else if (this.isPage('Camera')) {
          if (this.camera) {
            if (this.$refs[this.camera.name]) {
              this.$refs[this.camera.name].refreshStream(true);
            }
          }
        }
      }

      this.connected = true;
    },
    connect_error(error) {
      console.error('Socket connect_error:', error);
    },
    connect_timeout(timeout) {
      console.error('Socket connect_timeout after:', timeout);
    },
    error(error) {
      console.error('Socket general error:', error);
    },
    disconnect(reason) {
      console.log('Disconnected from socket, reason:', reason);
      //this.connected = false;
    },
    reconnect(attemptNumber) {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    },
    reconnect_attempt(attemptNumber) {
      console.log('Socket reconnection attempt #', attemptNumber);
    },
    reconnect_error(error) {
      console.error('Socket reconnection error:', error);
    },
    reconnect_failed() {
      console.error('Socket failed to reconnect after all attempts');
    },
    // eslint-disable-next-line no-unused-vars
    diskSpace(data) { },
    async unauthenticated() {
      console.log('Disconnected from socket, unauthenticated!');
      this.connected = false;

      await this.$store.dispatch('auth/logout');
      setTimeout(() => this.$router.push('/'), 500);
    },
    async invalidToken(token) {
      if (token === this.currentUser.access_token) {
        console.log('Session timed out');
        this.connected = false;

        await this.$store.dispatch('auth/logout');
        setTimeout(() => this.$router.push('/'), 500);
      }
    },
    notification(notification) {
      if (this.isValidPage && !notification.isSystemNotification) {
        this.notId = '_' + Math.random().toString(36).substr(2, 9);

        if (notification.mediaSource) {
          let mediaContainer = {
            type: 'image',
            caption: notification.title,
            src: notification.mediaSource,
            thumb: notification.thumbnail || notification.mediaSource,
          };

          if (notification.recordType === 'Video') {
            mediaContainer = {
              ...mediaContainer,
              type: 'video',
              sources: [
                {
                  src: notification.mediaSource,
                  type: 'video/mp4',
                },
              ],
              width: '100%',
              height: 'auto',
              autoplay: false,
            };
          }

          this.notImages = [mediaContainer];
        }

        let message = '';

        if (notification.isNotification) {
          let trigger = notification.message.split(' -')[0];
          trigger = this.$t(trigger);

          message = `${trigger} - ${notification.message.split('- ')[1]}`;
        } else {
          message = notification.message;
        }

        const content = {
          component: NotificationBanner,
          props: {
            headerTxt: this.$t('notifications'),
            timeTxt: this.$t('now'),
            title: notification.title,
            message: message,
            subtxt: notification.subtxt,
          },
          listeners: {
            showNotification: () => {
              this.$refs.lightboxBanner?.showImage(0);
            },
          },
        };

        this.$toast.info(content, {
          id: this.notId,
          containerClassName: 'notification-container',
          toastClassName: 'notification-toast',
        });
      }

      if (this.isPage('Notifications')) {
        if (notification.isNotification) {
          let message = this.$t('notification_text').replace('@', notification.camera).replace('%', notification.room);

          this.notifications?.unshift({
            ...notification,
            message: message,
          });

          if (notification.recordStoring) {
            let mediaContainer = {
              type: 'image',
              caption: `${notification.camera} - ${notification.time}`,
              src: `/files/${notification.fileName}`,
              thumb: `/files/${notification.fileName}`,
            };

            if (notification.recordType === 'Video') {
              delete mediaContainer.src;

              mediaContainer = {
                ...mediaContainer,
                type: 'video',
                sources: [
                  {
                    src: `/files/${notification.fileName}`,
                    type: 'video/mp4',
                  },
                ],
                thumb: `/files/${notification.name}@2.jpeg`,
                width: '100%',
                height: 'auto',
                autoplay: false,
              };
            }

            this.images?.unshift({
              id: notification.id,
              ...mediaContainer,
            });
          }
        }
      }
    },
    recording(recording) {
      if (this.isPage('Recordings')) {
        this.recordings?.unshift(recording);

        if (this.totalRecordings !== undefined) {
          this.totalRecordings++;
        }

        let mediaContainer = {
          type: 'image',
          caption: `${recording.camera} - ${recording.time}`,
          src: `/files/${recording.fileName}`,
          thumb: `/files/${recording.fileName}`,
        };

        if (recording.recordType === 'Video') {
          delete mediaContainer.src;

          mediaContainer = {
            ...mediaContainer,
            type: 'video',
            sources: [
              {
                src: `/files/${recording.fileName}`,
                type: 'video/mp4',
              },
            ],
            thumb: `/files/${recording.name}@2.jpeg`,
            width: '100%',
            height: 'auto',
            autoplay: false,
          };
        }

        this.images?.unshift(mediaContainer);
      }
    },
    updated() {
      //this.$toast.success(this.$t('system_successfully_updated'));
    },
  },
  created() {
    if (this.currentUser?.access_token) {
      // Thiết lập token trong phần auth
      this.$socket.client.io.opts.auth = {
        token: this.currentUser.access_token
      };

      // Thiết lập token trong header (cách cũ)
      this.$socket.client.io.opts.extraHeaders = {
        Authorization: `Bearer ${this.currentUser.access_token}`,
      };

      // Thêm token vào query params (cách mới)
      this.$socket.client.io.opts.query = {
        token: this.currentUser.access_token
      };

      this.$socket.client.io.opts.transports = ['websocket', 'polling'];
      this.$socket.client.io.opts.reconnection = true;
      this.$socket.client.io.opts.reconnectionAttempts = 5;
      this.$socket.client.io.opts.reconnectionDelay = 1000;
      this.$socket.client.io.opts.timeout = 20000;

      // Ngắt kết nối hiện tại (nếu có) trước khi kết nối lại với token mới
      if (this.$socket.client.connected) {
        this.$socket.client.disconnect();
      }

      // Delay nhỏ trước khi mở kết nối để đảm bảo tất cả options đã được áp dụng
      setTimeout(() => {
        this.$socket.client.open();
      }, 100);
    }
  },
  watch: {
    'currentUser.access_token': {
      handler(newToken) {
        if (newToken) {
          // Thiết lập token trong phần auth
          this.$socket.client.io.opts.auth = {
            token: newToken
          };

          // Thiết lập token trong header (cách cũ)
          this.$socket.client.io.opts.extraHeaders = {
            Authorization: `Bearer ${newToken}`,
          };

          // Thêm token vào query params (cách mới)
          this.$socket.client.io.opts.query = {
            token: newToken
          };

          this.$socket.client.io.opts.transports = ['websocket', 'polling'];
          this.$socket.client.io.opts.reconnection = true;
          this.$socket.client.io.opts.reconnectionAttempts = 5;
          this.$socket.client.io.opts.reconnectionDelay = 1000;
          this.$socket.client.io.opts.timeout = 20000;

          // Ngắt kết nối hiện tại (nếu có) trước khi kết nối lại với token mới
          if (this.$socket.client.connected) {
            this.$socket.client.disconnect();
          }

          // Delay nhỏ trước khi mở kết nối để đảm bảo tất cả options đã được áp dụng
          setTimeout(() => {
            this.$socket.client.open();
          }, 100);
        } else {
          if (this.$socket.client.connected) {
            this.$socket.client.disconnect();
          }
        }
      },
      immediate: true
    }
  },
  methods: {
    closeHandler() {
      this.$toast.dismiss(this.notId);
      this.notId = '';
    },
    isPage(page) {
      if (Array.isArray(page)) {
        return page.some((p) => p === this.$route.name || p === this.$route.meta.name);
      } else if (typeof page === 'string') {
        return this.$route.name === page || this.$route.meta.name === page;
      }

      return false;
    },
    testSocketConnection() {
      console.log('Testing socket connection...');

      if (!this.$socket.client.connected) {
        console.error('Socket is not connected. Cannot send test ping.');
        return false;
      }

      this.$socket.client.emit('ping_test', {
        clientTime: new Date().toISOString(),
        browser: navigator.userAgent,
        page: this.$route.name
      });

      // Register one-time listener for pong response
      this.$socket.client.once('pong_test', (response) => {
        console.log('Socket test successful! Server responded:', response);
        this.$toast.success(`Socket kết nối thành công! Phản hồi: ${response.message}`);
      });

      // Set timeout to handle no response
      setTimeout(() => {
        if (this.$socket.client.hasListeners('pong_test')) {
          console.error('Socket test failed - no response from server after 3 seconds');
          this.$toast.error('Socket không phản hồi sau 3 giây');
          this.$socket.client.off('pong_test'); // Remove the listener
        }
      }, 3000);

      return true;
    },
    registerSocketEvent(eventName, callback) {
      this.$socket.client.on(eventName, callback);
      this.registeredSocketEvents.push({ event: eventName, handler: callback });
    },
    unregisterSocketEvent(eventName) {
      const eventIndex = this.registeredSocketEvents.findIndex((item) => item.event === eventName);
      if (eventIndex !== -1) {
        const { event, handler } = this.registeredSocketEvents[eventIndex];
        this.$socket.client.off(event, handler);
        this.registeredSocketEvents.splice(eventIndex, 1);
      }
    },
    unregisterAllSocketEvents() {
      this.registeredSocketEvents.forEach(({ event, handler }) => {
        this.$socket.client.off(event, handler);
      });
      this.registeredSocketEvents = [];
    },
  },
  beforeDestroy() {
    this.unregisterAllSocketEvents();
  },
};
