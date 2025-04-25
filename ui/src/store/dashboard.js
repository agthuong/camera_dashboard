const initialState = {
  layout: JSON.parse(localStorage.getItem('dashboard-layout')) || [],
};

export const dashboard = {
  namespaced: true,
  state: initialState,
  actions: {
    addWidget({ commit }, widget) {
      const newWidget = {
        ...widget,
        uid: `widget-${Date.now()}`, // Thêm UID
      };
      commit('addWidget', newWidget);
    },
  },
  mutations: {
    addWidget(state, widget) {
      state.layout.push(widget);
      localStorage.setItem('dashboard-layout', JSON.stringify(state.layout));
    },
  },
};
