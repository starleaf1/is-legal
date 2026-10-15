import 'vue-router'

export {}

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    // Reachable while signed out (the login page).
    noAuth?: boolean
    // Only org admins (custom claim role: 'admin').
    requiresAdmin?: boolean
    layout?: string
  }
}
