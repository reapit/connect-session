export const sessionStorageCache = {
  get: function (key: string) {
    const v = sessionStorage.getItem(key)
    return v ? JSON.parse(v) : undefined
  },

  set: function (key: string, value: any) {
    sessionStorage.setItem(key, JSON.stringify(value))
  },

  remove: function (key: string) {
    sessionStorage.removeItem(key)
  },

  // Optional
  allKeys: function () {
    return Object.keys(sessionStorage)
  },
}
