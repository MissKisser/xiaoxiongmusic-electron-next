import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/onboarding",
      name: "onboarding",
      component: () => import("@/pages/Onboarding.vue"),
    },
    {
      path: "/agreement-update",
      name: "agreement-update",
      component: () => import("@/pages/AgreementUpdate.vue"),
    },
    {
      path: "/",
      component: () => import("@/layouts/MainLayout.vue"),
      children: [
        {
          path: "",
          name: "home",
          component: () => import("@/pages/Home.vue"),
        },
        {
          path: "library",
          name: "library",
          component: () => import("@/pages/Library.vue"),
        },
        {
          path: "liked",
          name: "liked",
          component: () => import("@/pages/Liked.vue"),
        },
        {
          path: "history",
          name: "history",
          component: () => import("@/pages/History.vue"),
        },
        {
          path: "download",
          name: "download",
          component: () => import("@/pages/Download.vue"),
        },
        {
          path: "daily",
          name: "daily",
          component: () => import("@/pages/Daily.vue"),
        },
        {
          path: "favorites",
          name: "favorites",
          component: () => import("@/pages/Favorites.vue"),
        },
        {
          path: "cloud",
          name: "cloud",
          component: () => import("@/pages/Cloud.vue"),
        },
        {
          path: "collection/:source/:type/:id",
          name: "collection",
          component: () => import("@/pages/Collection.vue"),
        },
        {
          path: "artist/:source/:id",
          name: "artist",
          component: () => import("@/pages/Artist.vue"),
        },
        {
          path: "artists/local",
          name: "artist-list",
          component: () => import("@/pages/LocalList.vue"),
        },
        {
          path: "albums/local",
          name: "album-list",
          component: () => import("@/pages/LocalList.vue"),
        },
        {
          path: "folders",
          name: "folders",
          component: () => import("@/pages/Folders.vue"),
        },
        {
          path: "stats",
          name: "stats",
          component: () => import("@/pages/Stats.vue"),
        },
        {
          path: "search",
          name: "search",
          component: () => import("@/pages/Search.vue"),
        },
        {
          path: "streaming",
          component: () => import("@/pages/Streaming/Index.vue"),
          redirect: "/streaming/songs",
          children: [
            {
              path: "songs",
              name: "streaming-songs",
              component: () => import("@/pages/Streaming/Songs.vue"),
            },
            {
              path: "albums",
              name: "streaming-albums",
              component: () => import("@/pages/Streaming/Albums.vue"),
            },
            {
              path: "artists",
              name: "streaming-artists",
              component: () => import("@/pages/Streaming/Artists.vue"),
            },
            {
              path: "playlists",
              name: "streaming-playlists",
              component: () => import("@/pages/Streaming/Playlists.vue"),
            },
          ],
        },
      ],
    },
    // 管理后台（隐藏入口）：无 admin_token 时跳登录页并携带 redirect
    {
      path: "/bamger/login",
      name: "admin-login",
      component: () => import("@/pages/Admin/Login.vue"),
    },
    {
      path: "/bamger",
      component: () => import("@/pages/Admin/Layout.vue"),
      redirect: "/bamger/dashboard",
      beforeEnter: (to, _from, next) => {
        if (!localStorage.getItem("admin_token")) {
          next({ name: "admin-login", query: { redirect: to.fullPath } });
        } else {
          next();
        }
      },
      children: [
        {
          path: "dashboard",
          name: "admin-dashboard",
          component: () => import("@/pages/Admin/Dashboard.vue"),
        },
        {
          path: "codes",
          name: "admin-codes",
          component: () => import("@/pages/Admin/Codes.vue"),
        },
        {
          path: "versions",
          name: "admin-versions",
          component: () => import("@/pages/Admin/Versions.vue"),
        },
        {
          path: "logs",
          name: "admin-logs",
          component: () => import("@/pages/Admin/Logs.vue"),
        },
      ],
    },
  ],
});

export default router;
